-- Migration: 20261017120000_controlled_authentication_hardening.sql
-- Completes controlled authentication hardening:
-- 1. Patient activation status transition (patients.activated_at and activate_patient_account function)
-- 2. Hardened provision_invited_profile function (search_path, input validation, role checks, revoked public grants)
-- 3. Audit storage enhancements (metadata column with SQL-level constraints excluding sensitive secrets)
-- 4. Repeatable, workspace-scoped orphan reconciliation function (reconcile_workspace_orphans)

-- ─── 1. Patient Activation Status Transition ──────────────────────────────────
alter table public.patients
  add column if not exists activated_at timestamptz;

create index if not exists idx_patients_activated_at
  on public.patients(activated_at);

comment on column public.patients.activated_at is
  'Timestamp when the invited patient completed password creation and account activation.';

create or replace function public.activate_patient_account(
  p_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient_id text;
begin
  if coalesce(auth.role(), current_setting('request.jwt.claim.role', true), current_user) not in ('service_role', 'postgres') then
    raise exception 'Only server-side activation is allowed';
  end if;

  if p_profile_id is null then
    raise exception 'Profile ID cannot be null';
  end if;

  update public.patients
  set status = 'active',
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
  where profile_id = p_profile_id
    and status = 'pending'
    and is_deleted = false
  returning id into v_patient_id;

  return v_patient_id;
end;
$$;

revoke all on function public.activate_patient_account(uuid) from public, anon, authenticated;
grant execute on function public.activate_patient_account(uuid) to service_role;

-- ─── 2. Harden provision_invited_profile ───────────────────────────────────────
create or replace function public.provision_invited_profile(
  p_id uuid,
  p_workspace_id uuid,
  p_role user_role,
  p_full_name text,
  p_email text,
  p_approval_status profile_approval_status,
  p_invited_by_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), current_setting('request.jwt.claim.role', true), current_user) not in ('service_role', 'postgres') then
    raise exception 'Only server-side provisioning is allowed';
  end if;

  if p_id is null then
    raise exception 'Profile ID is required';
  end if;

  if p_workspace_id is null then
    raise exception 'Workspace ID is required';
  end if;

  if not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception 'Workspace does not exist';
  end if;

  if p_role is null then
    raise exception 'User role is required';
  end if;

  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required';
  end if;

  if p_email is null or p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'A valid email address is required';
  end if;

  if p_approval_status is null then
    raise exception 'Approval status is required';
  end if;

  if p_invited_by_profile_id is not null and not exists (
    select 1 from public.profiles where id = p_invited_by_profile_id and workspace_id = p_workspace_id
  ) then
    raise exception 'Inviting profile not found in workspace';
  end if;

  insert into public.profiles (
    id,
    workspace_id,
    role,
    full_name,
    email,
    approval_status,
    invited_by_profile_id
  )
  values (
    p_id,
    p_workspace_id,
    p_role,
    trim(p_full_name),
    lower(trim(p_email)),
    p_approval_status,
    p_invited_by_profile_id
  );

  return p_id;
end;
$$;

revoke all on function public.provision_invited_profile(
  uuid, uuid, user_role, text, text, profile_approval_status, uuid
) from public, anon, authenticated;
grant execute on function public.provision_invited_profile(
  uuid, uuid, user_role, text, text, profile_approval_status, uuid
) to service_role;

-- ─── 3. Audit Storage Enhancements & Secret Prevention ───────────────────────
alter table public.audit_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_events_no_sensitive_data'
  ) then
    alter table public.audit_events
      add constraint audit_events_no_sensitive_data check (
        not (
          metadata ? 'password' or
          metadata ? 'temporaryPassword' or
          metadata ? 'temporary_password' or
          metadata ? 'token' or
          metadata ? 'accessToken' or
          metadata ? 'refreshToken' or
          metadata ? 'access_token' or
          metadata ? 'refresh_token' or
          metadata ? 'secret' or
          metadata ? 'secret_key'
        )
      );
  end if;
end;
$$;

-- ─── 4. Repeatable, Workspace-Scoped Orphan Reconciliation ───────────────────
create or replace function public.reconcile_workspace_orphans(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_orphaned_patients jsonb;
  v_orphaned_profiles jsonb;
begin
  if coalesce(auth.role(), current_setting('request.jwt.claim.role', true), current_user) not in ('service_role', 'postgres') then
    raise exception 'Only server-side execution is allowed';
  end if;

  if p_workspace_id is null then
    raise exception 'Workspace ID is required';
  end if;

  -- 1. Patients in this workspace whose profile_id is not in profiles
  select coalesce(jsonb_agg(jsonb_build_object(
    'patient_id', p.id,
    'full_name', p.full_name,
    'contact_email', p.contact_email,
    'profile_id', p.profile_id,
    'status', p.status,
    'issue', 'missing_or_unlinked_profile'
  )), '[]'::jsonb)
  into v_orphaned_patients
  from public.patients p
  where p.workspace_id = p_workspace_id
    and p.is_deleted = false
    and (p.profile_id is null or not exists (
      select 1 from public.profiles pr where pr.id = p.profile_id
    ));

  -- 2. Profiles with role 'patient' that have no matching patient record
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', pr.id,
    'full_name', pr.full_name,
    'email', pr.email,
    'role', pr.role,
    'issue', 'patient_profile_without_clinical_record'
  )), '[]'::jsonb)
  into v_orphaned_profiles
  from public.profiles pr
  where pr.workspace_id = p_workspace_id
    and pr.role = 'patient'
    and not exists (
      select 1 from public.patients p where p.profile_id = pr.id and p.is_deleted = false
    );

  v_result := jsonb_build_object(
    'workspace_id', p_workspace_id,
    'reconciled_at', now(),
    'orphaned_patients', v_orphaned_patients,
    'orphaned_profiles', v_orphaned_profiles,
    'total_orphans', jsonb_array_length(v_orphaned_patients) + jsonb_array_length(v_orphaned_profiles)
  );

  return v_result;
end;
$$;

revoke all on function public.reconcile_workspace_orphans(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_workspace_orphans(uuid) to service_role;
