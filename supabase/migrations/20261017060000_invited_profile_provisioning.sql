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
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only server-side provisioning is allowed';
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
    p_full_name,
    p_email,
    p_approval_status,
    p_invited_by_profile_id
  );

  return p_id;
end;
$$;

revoke execute on function public.provision_invited_profile(
  uuid, uuid, user_role, text, text, profile_approval_status, uuid
) from public, anon, authenticated;
grant execute on function public.provision_invited_profile(
  uuid, uuid, user_role, text, text, profile_approval_status, uuid
) to service_role;
