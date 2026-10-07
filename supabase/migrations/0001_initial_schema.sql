-- Migration: 0001_initial_schema.sql
-- Creates all clinical tables for MedNova backend.
-- Additive only — never modifies or drops existing columns once deployed.

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Workspaces ───────────────────────────────────────────────────────────────
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ─── Profiles (linked to Supabase Auth users) ─────────────────────────────────
create type user_role as enum ('doctor', 'patient', 'care_team', 'admin');

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id),
  role          user_role not null,
  full_name     text not null,
  email         text not null,
  created_at    timestamptz not null default now()
);

-- ─── Patients ─────────────────────────────────────────────────────────────────
create type patient_status as enum ('pending', 'active', 'inactive');

create sequence if not exists patient_id_seq start 100000;

create table if not exists patients (
  id                text primary key default ('P-' || lpad(nextval('patient_id_seq')::text, 6, '0')),
  workspace_id      uuid not null references workspaces(id),
  profile_id        uuid references profiles(id),          -- null until activated
  status            patient_status not null default 'pending',
  full_name         text not null,
  date_of_birth     date not null,
  contact_email     text not null,
  contact_phone     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Care Team Assignments ────────────────────────────────────────────────────
create table if not exists care_team_assignments (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          text not null references patients(id),
  doctor_profile_id   uuid not null references profiles(id),
  assigned_at         timestamptz not null default now(),
  revoked_at          timestamptz
);

-- ─── Care Grants (for non-doctor care team members) ───────────────────────────
create table if not exists care_grants (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          text not null references patients(id),
  grantee_profile_id  uuid not null references profiles(id),
  granted_by_id       uuid not null references profiles(id),
  scope               text not null,             -- e.g. 'read_dose', 'read_report'
  granted_at          timestamptz not null default now(),
  revoked_at          timestamptz
);

-- ─── Consent ──────────────────────────────────────────────────────────────────
create table if not exists consent_records (
  id                      uuid primary key default gen_random_uuid(),
  patient_id              text not null references patients(id),
  share_with_care_team    boolean not null default false,
  allow_reminders         boolean not null default false,
  allow_ai_analysis       boolean not null default false,
  updated_by_profile_id   uuid not null references profiles(id),
  updated_at              timestamptz not null default now()
);

-- ─── Notification Preferences ─────────────────────────────────────────────────
create type notification_channel as enum ('email', 'sms', 'push');

create table if not exists notification_preferences (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          text not null references patients(id),
  channel             notification_channel not null,
  enabled             boolean not null default true,
  quiet_hours_start   time,
  quiet_hours_end     time,
  updated_at          timestamptz not null default now(),
  unique (patient_id, channel)
);

-- ─── Conditions ───────────────────────────────────────────────────────────────
create table if not exists conditions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    text not null references patients(id),
  name          text not null,
  diagnosed_at  date
);

-- ─── Visits ───────────────────────────────────────────────────────────────────
create table if not exists visits (
  id                uuid primary key default gen_random_uuid(),
  patient_id        text not null references patients(id),
  doctor_profile_id uuid not null references profiles(id),
  visit_date        date not null,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ─── Medications ──────────────────────────────────────────────────────────────
create table if not exists medications (
  id              uuid primary key default gen_random_uuid(),
  patient_id      text not null references patients(id),
  name            text not null,
  dosage          text not null,
  form            text not null,
  prescribed_at   timestamptz not null default now()
);

-- ─── Prescriptions ────────────────────────────────────────────────────────────
create type prescription_status as enum ('pending_review', 'approved', 'rejected', 'superseded');

create table if not exists prescriptions (
  id                      uuid primary key default gen_random_uuid(),
  patient_id              text not null references patients(id),
  medication_id           uuid not null references medications(id),
  status                  prescription_status not null default 'pending_review',
  suggested_by            text,               -- 'ai' or profile id
  approved_by_profile_id  uuid references profiles(id),
  approved_at             timestamptz,
  created_at              timestamptz not null default now()
);

-- ─── Prescription Revisions (append-only) ────────────────────────────────────
create table if not exists prescription_revisions (
  id                    uuid primary key default gen_random_uuid(),
  prescription_id       uuid not null references prescriptions(id),
  revised_by_profile_id uuid not null references profiles(id),
  changes               jsonb not null,
  revised_at            timestamptz not null default now()
);

-- ─── Dose Schedules ───────────────────────────────────────────────────────────
create table if not exists dose_schedules (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id),
  patient_id      text not null references patients(id),
  scheduled_at    timestamptz not null,
  window_minutes  integer not null default 60
);

-- ─── Dose Logs (append-only) ──────────────────────────────────────────────────
create type dose_status as enum ('pending', 'taken', 'missed', 'skipped');
create type dose_method as enum ('oral', 'injection', 'patch', 'other');

create table if not exists dose_logs (
  id                uuid primary key default gen_random_uuid(),
  schedule_id       uuid not null references dose_schedules(id),
  patient_id        text not null references patients(id),
  status            dose_status not null,
  method            dose_method,
  reason            text,
  idempotency_key   text not null unique,
  logged_at         timestamptz not null default now()   -- authoritative server timestamp
);

-- ─── Patient Reports ──────────────────────────────────────────────────────────
create type report_review_status as enum ('unreviewed', 'reviewed');

create table if not exists patient_reports (
  id                        uuid primary key default gen_random_uuid(),
  patient_id                text not null references patients(id),
  uploader_profile_id       uuid not null references profiles(id),
  storage_path              text not null,          -- private bucket object path; no base64
  mime_type                 text not null,
  size_bytes                bigint not null,
  label                     text not null,
  review_status             report_review_status not null default 'unreviewed',
  reviewed_by_profile_id    uuid references profiles(id),
  reviewed_at               timestamptz,
  shared_with_care_team     boolean not null default false,
  uploaded_at               timestamptz not null default now()
);

-- ─── AI Analyses ──────────────────────────────────────────────────────────────
create type analysis_status as enum ('pending', 'running', 'completed', 'error', 'needs_review');

create table if not exists ai_analyses (
  id                        uuid primary key default gen_random_uuid(),
  patient_id                text not null references patients(id),
  requested_by_profile_id   uuid not null references profiles(id),
  status                    analysis_status not null default 'pending',
  input_snapshot            jsonb not null,
  structured_output         jsonb,
  confidence                numeric(4,3),
  safety_flags              text[],
  model_version             text,
  prompt_version            text,
  requires_doctor_review    boolean not null default true,
  reviewed_by_profile_id    uuid references profiles(id),
  reviewed_at               timestamptz,
  created_at                timestamptz not null default now(),
  completed_at              timestamptz
);

-- ─── AI Citations (append-only) ───────────────────────────────────────────────
create table if not exists ai_citations (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid not null references ai_analyses(id),
  source_label    text not null,
  excerpt         text not null,
  relevance_score numeric(4,3) not null
);

-- ─── Escalations ─────────────────────────────────────────────────────────────
create type escalation_severity as enum ('low', 'medium', 'high', 'critical');
create type escalation_status as enum ('open', 'acknowledged', 'resolved');

create table if not exists escalations (
  id                          uuid primary key default gen_random_uuid(),
  patient_id                  text not null references patients(id),
  analysis_id                 uuid references ai_analyses(id),
  severity                    escalation_severity not null,
  status                      escalation_status not null default 'open',
  reasoning                   text not null,
  confidence                  numeric(4,3) not null,
  model_version               text not null,
  acknowledged_by_profile_id  uuid references profiles(id),
  acknowledged_at             timestamptz,
  created_at                  timestamptz not null default now()
);

-- ─── Jobs (durable work queue) ────────────────────────────────────────────────
create type job_status as enum ('pending', 'claimed', 'completed', 'failed', 'dead_letter');

create table if not exists jobs (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  payload           jsonb not null,
  status            job_status not null default 'pending',
  idempotency_key   text not null unique,
  correlation_id    text not null,
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  next_run_at       timestamptz not null default now(),
  claimed_at        timestamptz,
  completed_at      timestamptz,
  last_error        text,
  created_at        timestamptz not null default now()
);

-- ─── Notifications ────────────────────────────────────────────────────────────
create type notification_status as enum ('queued', 'sent', 'delivered', 'bounced', 'failed');

create table if not exists notifications (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            text not null references patients(id),
  job_id                uuid not null references jobs(id),
  channel               notification_channel not null,
  provider_message_id   text,
  status                notification_status not null default 'queued',
  sent_at               timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz not null default now()
);

-- ─── Correction Requests (append-only) ────────────────────────────────────────
create type correction_target_type as enum ('dose_log', 'adherence', 'patient_report', 'ai_analysis');
create type correction_status as enum ('open', 'under_review', 'resolved', 'rejected');

create table if not exists correction_requests (
  id                        uuid primary key default gen_random_uuid(),
  patient_id                text not null references patients(id),
  requested_by_profile_id   uuid not null references profiles(id),
  target_type               correction_target_type not null,
  target_id                 text not null,
  description               text not null,
  status                    correction_status not null default 'open',
  created_at                timestamptz not null default now()
);

-- ─── Audit Events (append-only — never update or delete) ──────────────────────
create table if not exists audit_events (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references workspaces(id),
  actor_profile_id  uuid references profiles(id),
  action            text not null,
  target_type       text,
  target_id         text,
  correlation_id    text not null,
  outcome           text not null check (outcome in ('success', 'denied', 'error')),
  occurred_at       timestamptz not null default now()
);
