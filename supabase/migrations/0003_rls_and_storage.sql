-- Migration: 0003_rls_and_storage.sql
-- Enables Row-Level Security (RLS) across all clinical tables, defines
-- authorization helper functions, sets fine-grained security policies,
-- and configures the private medical-reports storage bucket.

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Check if current authenticated user is an active doctor assigned to patient
create or replace function is_assigned_doctor(p_patient_id text)
returns boolean as $$
  select exists (
    select 1 from care_team_assignments cta
    where cta.patient_id = p_patient_id
      and cta.doctor_profile_id = auth.uid()
      and cta.revoked_at is null
  );
$$ language sql security definer stable;

-- Check if current authenticated user has an active care grant with required scope
create or replace function has_active_care_grant(p_patient_id text, p_scope text default 'all')
returns boolean as $$
  select exists (
    select 1 from care_grants cg
    join consent_records cr on cr.patient_id = cg.patient_id
    where cg.patient_id = p_patient_id
      and cg.grantee_profile_id = auth.uid()
      and cg.revoked_at is null
      and (cg.scope = p_scope or cg.scope = 'all' or p_scope = 'all')
      and cr.share_with_care_team = true
  );
$$ language sql security definer stable;

-- Check if current authenticated user is the patient associated with the record
create or replace function is_patient_self(p_patient_id text)
returns boolean as $$
  select exists (
    select 1 from patients p
    where p.id = p_patient_id
      and p.profile_id = auth.uid()
  );
$$ language sql security definer stable;

-- Get current authenticated user role
create or replace function get_current_user_role()
returns user_role as $$
  select role from profiles where id = auth.uid() limit 1;
$$ language sql security definer stable;

-- Get current authenticated user workspace
create or replace function get_current_user_workspace()
returns uuid as $$
  select workspace_id from profiles where id = auth.uid() limit 1;
$$ language sql security definer stable;

-- ─── Enable RLS On All Clinical Tables ─────────────────────────────────────────
alter table workspaces enable row level security;
alter table profiles enable row level security;
alter table patients enable row level security;
alter table care_team_assignments enable row level security;
alter table care_grants enable row level security;
alter table consent_records enable row level security;
alter table notification_preferences enable row level security;
alter table conditions enable row level security;
alter table visits enable row level security;
alter table medications enable row level security;
alter table prescriptions enable row level security;
alter table prescription_revisions enable row level security;
alter table dose_schedules enable row level security;
alter table dose_logs enable row level security;
alter table patient_reports enable row level security;
alter table ai_analyses enable row level security;
alter table ai_citations enable row level security;
alter table escalations enable row level security;
alter table jobs enable row level security;
alter table notifications enable row level security;
alter table correction_requests enable row level security;
alter table audit_events enable row level security;

-- ─── Policies: Workspaces ─────────────────────────────────────────────────────
create policy "Workspaces viewable by members"
  on workspaces for select
  using (id = get_current_user_workspace());

-- ─── Policies: Profiles ───────────────────────────────────────────────────────
create policy "Profiles viewable by self and colleagues in same workspace"
  on profiles for select
  using (
    id = auth.uid() or
    (workspace_id = get_current_user_workspace() and get_current_user_role() in ('doctor', 'care_team', 'admin'))
  );

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- ─── Policies: Patients ───────────────────────────────────────────────────────
create policy "Patients viewable by assigned doctor, granted care-team, admin, or self"
  on patients for select
  using (
    is_patient_self(id) or
    is_assigned_doctor(id) or
    has_active_care_grant(id) or
    (workspace_id = get_current_user_workspace() and get_current_user_role() = 'admin')
  );

create policy "Patients insertable by doctors and admins"
  on patients for insert
  with check (
    workspace_id = get_current_user_workspace() and
    get_current_user_role() in ('doctor', 'admin')
  );

create policy "Patients updatable by assigned doctors and admins"
  on patients for update
  using (
    is_assigned_doctor(id) or
    (workspace_id = get_current_user_workspace() and get_current_user_role() = 'admin')
  );

-- ─── Policies: Care Team Assignments ──────────────────────────────────────────
create policy "Assignments viewable by patient, doctor, and admin"
  on care_team_assignments for select
  using (
    doctor_profile_id = auth.uid() or
    is_patient_self(patient_id) or
    get_current_user_role() = 'admin'
  );

create policy "Assignments manageable by doctors and admins"
  on care_team_assignments for all
  using (get_current_user_role() in ('doctor', 'admin'));

-- ─── Policies: Care Grants ────────────────────────────────────────────────────
create policy "Care grants viewable by grantee, patient, and doctor"
  on care_grants for select
  using (
    grantee_profile_id = auth.uid() or
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    get_current_user_role() = 'admin'
  );

create policy "Care grants manageable by assigned doctors and admins"
  on care_grants for all
  using (
    is_assigned_doctor(patient_id) or
    get_current_user_role() = 'admin'
  );

-- ─── Policies: Consent Records ────────────────────────────────────────────────
create policy "Consent viewable by patient, assigned doctor, and care-team"
  on consent_records for select
  using (
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    has_active_care_grant(patient_id)
  );

create policy "Consent updatable by patient self"
  on consent_records for update
  using (is_patient_self(patient_id));

create policy "Consent insertable by patient or doctor"
  on consent_records for insert
  with check (
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    get_current_user_role() = 'admin'
  );

-- ─── Policies: Notification Preferences ───────────────────────────────────────
create policy "Notification preferences viewable and manageable by patient"
  on notification_preferences for all
  using (is_patient_self(patient_id));

-- ─── Policies: Conditions & Visits ────────────────────────────────────────────
create policy "Conditions viewable by authorized users"
  on conditions for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Conditions manageable by assigned doctors"
  on conditions for all
  using (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin');

create policy "Visits viewable by authorized users"
  on visits for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Visits manageable by assigned doctors"
  on visits for all
  using (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin');

-- ─── Policies: Medications & Prescriptions ────────────────────────────────────
create policy "Medications viewable by authorized users"
  on medications for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Medications manageable by doctors"
  on medications for all
  using (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin');

create policy "Prescriptions viewable by authorized users"
  on prescriptions for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Prescriptions updatable only by assigned doctors"
  on prescriptions for update
  using (is_assigned_doctor(patient_id));

create policy "Prescriptions insertable by assigned doctors and service"
  on prescriptions for insert
  with check (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin');

create policy "Prescription revisions viewable by authorized users"
  on prescription_revisions for select
  using (
    exists (
      select 1 from prescriptions p
      where p.id = prescription_revisions.prescription_id
        and (is_patient_self(p.patient_id) or is_assigned_doctor(p.patient_id) or has_active_care_grant(p.patient_id))
    )
  );

-- ─── Policies: Dose Schedules & Logs ──────────────────────────────────────────
create policy "Dose schedules viewable by authorized users"
  on dose_schedules for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Dose logs viewable by authorized users"
  on dose_logs for select
  using (is_patient_self(patient_id) or is_assigned_doctor(patient_id) or has_active_care_grant(patient_id));

create policy "Dose logs insertable by patient self or assigned doctor"
  on dose_logs for insert
  with check (is_patient_self(patient_id) or is_assigned_doctor(patient_id));

-- ─── Policies: Patient Reports ────────────────────────────────────────────────
create policy "Reports viewable by patient, assigned doctor, and care-team (if shared)"
  on patient_reports for select
  using (
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    (has_active_care_grant(patient_id) and shared_with_care_team = true)
  );

create policy "Reports insertable by patient self or doctor"
  on patient_reports for insert
  with check (is_patient_self(patient_id) or is_assigned_doctor(patient_id));

create policy "Reports reviewable by assigned doctor"
  on patient_reports for update
  using (is_assigned_doctor(patient_id));

-- ─── Policies: AI Analyses & Citations ────────────────────────────────────────
create policy "AI analyses viewable by patient, doctor, and care-team"
  on ai_analyses for select
  using (
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    has_active_care_grant(patient_id)
  );

create policy "AI analyses updatable by doctor (for review status)"
  on ai_analyses for update
  using (is_assigned_doctor(patient_id));

create policy "AI citations viewable by users who can view the analysis"
  on ai_citations for select
  using (
    exists (
      select 1 from ai_analyses a
      where a.id = ai_citations.analysis_id
        and (is_patient_self(a.patient_id) or is_assigned_doctor(a.patient_id) or has_active_care_grant(a.patient_id))
    )
  );

-- ─── Policies: Escalations ────────────────────────────────────────────────────
create policy "Escalations viewable by doctor, care-team, and admin"
  on escalations for select
  using (
    is_assigned_doctor(patient_id) or
    has_active_care_grant(patient_id) or
    get_current_user_role() = 'admin'
  );

create policy "Escalations acknowledgeable by assigned doctor and care team"
  on escalations for update
  using (
    is_assigned_doctor(patient_id) or
    has_active_care_grant(patient_id)
  );

-- ─── Policies: Correction Requests ────────────────────────────────────────────
create policy "Correction requests viewable by patient and assigned care team"
  on correction_requests for select
  using (
    is_patient_self(patient_id) or
    is_assigned_doctor(patient_id) or
    has_active_care_grant(patient_id)
  );

create policy "Correction requests insertable by patient self"
  on correction_requests for insert
  with check (is_patient_self(patient_id));

create policy "Correction requests updatable by assigned doctor"
  on correction_requests for update
  using (is_assigned_doctor(patient_id));

-- ─── Policies: Audit Events ───────────────────────────────────────────────────
create policy "Audit events viewable only by administrators"
  on audit_events for select
  using (get_current_user_role() = 'admin');

create policy "Audit events insertable by authenticated users"
  on audit_events for insert
  with check (actor_profile_id = auth.uid() or get_current_user_role() = 'admin');

-- ─── Storage Bucket Configuration ─────────────────────────────────────────────
-- Bucket configuration for medical-reports (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-reports',
  'medical-reports',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- Storage Policies: access granted only through signed URLs or authenticated ownership
create policy "Medical reports accessible by authorized users"
  on storage.objects for select
  using (
    bucket_id = 'medical-reports' and
    (
      -- Object path convention: {patient_id}/{filename}
      is_patient_self((storage.foldername(name))[1]) or
      is_assigned_doctor((storage.foldername(name))[1]) or
      has_active_care_grant((storage.foldername(name))[1])
    )
  );

create policy "Medical reports uploadable by authorized patient or doctor"
  on storage.objects for insert
  with check (
    bucket_id = 'medical-reports' and
    (
      is_patient_self((storage.foldername(name))[1]) or
      is_assigned_doctor((storage.foldername(name))[1])
    )
  );
