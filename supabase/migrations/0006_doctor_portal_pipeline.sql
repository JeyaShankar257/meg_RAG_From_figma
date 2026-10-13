-- Migration: 0006_doctor_portal_pipeline.sql
-- Adds durable pipeline runs, five-stage projections, bounded stage logs,
-- job-to-run/stage linkage, doctor notification/profile preferences,
-- and approval idempotency fields.
-- Additive only — never modifies or drops existing columns once deployed.

-- ─── Pipeline Run Status ──────────────────────────────────────────────────────
create type pipeline_run_status as enum ('pending', 'running', 'completed', 'failed');

-- ─── Pipeline Stage Status ────────────────────────────────────────────────────
create type pipeline_stage_status as enum ('idle', 'running', 'complete', 'error', 'retrying');

-- ─── Pipeline Stage Key ───────────────────────────────────────────────────────
create type pipeline_stage_key as enum (
  'reminder_agent',
  'dose_logging_agent',
  'pattern_detection_agent',
  'escalation_agent',
  'care_team_interaction_agent'
);

-- ─── Pipeline Runs ────────────────────────────────────────────────────────────
create table if not exists pipeline_runs (
  id              uuid primary key default gen_random_uuid(),
  patient_id      text not null references patients(id),
  workspace_id    uuid not null references workspaces(id),
  trigger_type    text not null,          -- e.g. 'prescription_approval', 'manual', 'scheduled'
  trigger_id      text,                   -- e.g. prescription ID that triggered the run
  status          pipeline_run_status not null default 'pending',
  correlation_id  text not null,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  last_error      text
);

create index if not exists idx_pipeline_runs_patient
  on pipeline_runs(patient_id, created_at desc);

create index if not exists idx_pipeline_runs_workspace
  on pipeline_runs(workspace_id);

-- ─── Pipeline Stages (five rows per run) ──────────────────────────────────────
create table if not exists pipeline_stages (
  id              uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references pipeline_runs(id) on delete cascade,
  stage_key       pipeline_stage_key not null,
  status          pipeline_stage_status not null default 'idle',
  agent_name      text not null,
  attempt         integer not null default 0,
  last_job_id     uuid,                   -- FK added below after jobs column
  started_at      timestamptz,
  completed_at    timestamptz,
  last_error      text,
  updated_at      timestamptz not null default now(),
  unique (pipeline_run_id, stage_key)
);

create index if not exists idx_pipeline_stages_run
  on pipeline_stages(pipeline_run_id);

-- ─── Pipeline Stage Logs (bounded per stage) ──────────────────────────────────
create type pipeline_log_level as enum ('info', 'warn', 'error');

create table if not exists pipeline_stage_logs (
  id                uuid primary key default gen_random_uuid(),
  pipeline_stage_id uuid not null references pipeline_stages(id) on delete cascade,
  job_id            uuid references jobs(id),
  level             pipeline_log_level not null default 'info',
  message           text not null,
  metadata          jsonb,
  correlation_id    text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pipeline_stage_logs_stage
  on pipeline_stage_logs(pipeline_stage_id, created_at desc);

-- ─── Job linkage to pipeline run/stage ────────────────────────────────────────
alter table jobs
  add column if not exists pipeline_run_id uuid references pipeline_runs(id),
  add column if not exists pipeline_stage_id uuid references pipeline_stages(id);

create index if not exists idx_jobs_pipeline_run
  on jobs(pipeline_run_id) where pipeline_run_id is not null;

-- ─── Approval Idempotency ─────────────────────────────────────────────────────
-- Client-provided idempotency key for prescription approval retries
alter table prescriptions
  add column if not exists idempotency_key text unique;

-- ─── AI Suggestion Persistence on Prescriptions ──────────────────────────────
-- Store the validated AI suggestion snapshot that was approved
alter table prescriptions
  add column if not exists ai_suggestion_snapshot jsonb;

-- ─── Doctor Notification Preferences ──────────────────────────────────────────
-- Extends the existing patient-scoped notification_preferences to support
-- doctor-scoped preferences by adding an optional profile_id column.
alter table notification_preferences
  add column if not exists profile_id uuid references profiles(id);

-- Drop the patient-only unique constraint and add a broader one
-- that supports both patient and profile preferences
-- (only if the new column was actually added)
do $$
begin
  -- Add a partial unique index for doctor/profile preferences
  if not exists (
    select 1 from pg_indexes
    where indexname = 'idx_notification_prefs_profile_channel'
  ) then
    create unique index idx_notification_prefs_profile_channel
      on notification_preferences(profile_id, channel)
      where profile_id is not null;
  end if;
end $$;

-- ─── Doctor Profile Preference Fields ─────────────────────────────────────────
-- The profiles.preferences jsonb column was added in 0005. This migration
-- ensures it has a useful structure comment for documentation only.
comment on column profiles.preferences is
  'Doctor/user preferences JSON. Keys: notification_channels, quiet_hours_start, quiet_hours_end, display_name, specialty, phone.';
