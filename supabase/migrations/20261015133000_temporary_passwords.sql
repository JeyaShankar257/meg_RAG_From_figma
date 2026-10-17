alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'Forces a newly provisioned account to choose a permanent password before using the portal.';
