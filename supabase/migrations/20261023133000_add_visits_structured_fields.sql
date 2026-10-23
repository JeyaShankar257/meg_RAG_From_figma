-- Add structured clinical fields to visits table for automatic encounter logging
alter table visits
  add column if not exists condition text,
  add column if not exists symptoms text[] default '{}',
  add column if not exists proposed_solution text,
  add column if not exists outcome text,
  add column if not exists related_visits text[] default '{}',
  add column if not exists prescription_id uuid references prescriptions(id);
