-- Migration: 0007_medication_dates_and_lifecycle.sql
-- Adds start_date, end_date, and duration_days to medications and prescriptions
-- to support clinical prescription lifecycles and automatic completion of ended courses.

alter table medications
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists duration_days integer;

alter table prescriptions
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists duration_days integer;

create index if not exists idx_medications_patient_active_dates
  on medications(patient_id, is_active, end_date);
