alter table profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
