-- Migration: 0002_constraints_and_indexes.sql
-- Adds performance indexes, append-only protections, uniqueness constraints,
-- and soft-delete/retention fields for the MedNova clinical backend.

-- ─── Soft-Delete & Retention Fields ──────────────────────────────────────────
alter table patients add column if not exists is_deleted boolean not null default false;
alter table patients add column if not exists deleted_at timestamptz;

alter table medications add column if not exists is_active boolean not null default true;

-- ─── Uniqueness Constraints ───────────────────────────────────────────────────
-- Ensure a prescription does not have multiple dose schedules for the exact same scheduled time
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_dose_schedules_prescription_time'
  ) then
    alter table dose_schedules add constraint uq_dose_schedules_prescription_time unique (prescription_id, scheduled_at);
  end if;
end $$;

-- ─── Performance & Lookup Indexes ────────────────────────────────────────────
create index if not exists idx_profiles_workspace on profiles(workspace_id);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_email on profiles(email);

create index if not exists idx_patients_workspace on patients(workspace_id);
create index if not exists idx_patients_profile on patients(profile_id);
create index if not exists idx_patients_status on patients(status);

create index if not exists idx_care_team_assignments_patient on care_team_assignments(patient_id);
create index if not exists idx_care_team_assignments_doctor on care_team_assignments(doctor_profile_id);
create index if not exists idx_care_team_assignments_active on care_team_assignments(patient_id, doctor_profile_id) where revoked_at is null;

create index if not exists idx_care_grants_patient on care_grants(patient_id);
create index if not exists idx_care_grants_grantee on care_grants(grantee_profile_id);
create index if not exists idx_care_grants_active on care_grants(patient_id, grantee_profile_id) where revoked_at is null;

create index if not exists idx_consent_records_patient on consent_records(patient_id);
create index if not exists idx_notification_preferences_patient on notification_preferences(patient_id);

create index if not exists idx_conditions_patient on conditions(patient_id);
create index if not exists idx_visits_patient on visits(patient_id);
create index if not exists idx_visits_doctor on visits(doctor_profile_id);

create index if not exists idx_medications_patient on medications(patient_id);
create index if not exists idx_prescriptions_patient on prescriptions(patient_id);
create index if not exists idx_prescriptions_status on prescriptions(status);
create index if not exists idx_prescription_revisions_prescription on prescription_revisions(prescription_id);

create index if not exists idx_dose_schedules_patient on dose_schedules(patient_id);
create index if not exists idx_dose_schedules_scheduled_at on dose_schedules(scheduled_at);

create index if not exists idx_dose_logs_patient on dose_logs(patient_id);
create index if not exists idx_dose_logs_schedule on dose_logs(schedule_id);
create index if not exists idx_dose_logs_logged_at on dose_logs(logged_at);

create index if not exists idx_patient_reports_patient on patient_reports(patient_id);
create index if not exists idx_patient_reports_uploader on patient_reports(uploader_profile_id);
create index if not exists idx_patient_reports_review on patient_reports(review_status);

create index if not exists idx_ai_analyses_patient on ai_analyses(patient_id);
create index if not exists idx_ai_analyses_status on ai_analyses(status);
create index if not exists idx_ai_citations_analysis on ai_citations(analysis_id);

create index if not exists idx_escalations_patient on escalations(patient_id);
create index if not exists idx_escalations_status on escalations(status);
create index if not exists idx_escalations_severity on escalations(severity);

create index if not exists idx_jobs_status_next_run on jobs(status, next_run_at);
create index if not exists idx_notifications_patient on notifications(patient_id);
create index if not exists idx_notifications_job on notifications(job_id);

create index if not exists idx_correction_requests_patient on correction_requests(patient_id);
create index if not exists idx_correction_requests_status on correction_requests(status);

create index if not exists idx_audit_events_workspace on audit_events(workspace_id);
create index if not exists idx_audit_events_actor on audit_events(actor_profile_id);
create index if not exists idx_audit_events_target on audit_events(target_type, target_id);
create index if not exists idx_audit_events_correlation on audit_events(correlation_id);
create index if not exists idx_audit_events_occurred_at on audit_events(occurred_at);

-- ─── Append-Only Protections ──────────────────────────────────────────────────
-- Enforce immutability on audit_events, dose_logs, prescription_revisions, ai_citations
create or replace function prevent_update_or_delete()
returns trigger as $$
begin
  raise exception 'Table % is strictly append-only: updates and deletes are forbidden.', TG_TABLE_NAME;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_events_append_only on audit_events;
create trigger trg_audit_events_append_only
before update or delete on audit_events
for each row execute function prevent_update_or_delete();

drop trigger if exists trg_dose_logs_append_only on dose_logs;
create trigger trg_dose_logs_append_only
before update or delete on dose_logs
for each row execute function prevent_update_or_delete();

drop trigger if exists trg_prescription_revisions_append_only on prescription_revisions;
create trigger trg_prescription_revisions_append_only
before update or delete on prescription_revisions
for each row execute function prevent_update_or_delete();

drop trigger if exists trg_ai_citations_append_only on ai_citations;
create trigger trg_ai_citations_append_only
before update or delete on ai_citations
for each row execute function prevent_update_or_delete();
