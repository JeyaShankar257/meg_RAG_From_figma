-- Controlled account provisioning:
-- doctors require administrator approval; patients are invitation-only.

create type profile_approval_status as enum ('pending', 'approved', 'rejected');

alter table profiles
  add column if not exists approval_status profile_approval_status not null default 'approved',
  add column if not exists invited_by_profile_id uuid references profiles(id),
  add column if not exists approved_by_profile_id uuid references profiles(id),
  add column if not exists approved_at timestamptz;

create index if not exists idx_profiles_approval_status
  on profiles(approval_status);

comment on column profiles.approval_status is
  'Doctors require approved status before login; patients are approved when invited.';