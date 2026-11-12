# auto-email-notifications Specification

## Purpose
Delivers all three clinical email notification types automatically — dose reminders per schedule, adherence warnings after missed doses, and guardian SOS alerts for critical non-adherence — without requiring any manual doctor action.

## Requirements

### Requirement: System sends dose reminder emails automatically per schedule
The system SHALL process `send_reminder` jobs from the `jobs` table on a continuous polling loop and SHALL deliver a dose reminder email to the patient for each scheduled dose window. The system SHALL respect the patient's `notification_preferences` (channel enabled/disabled, quiet hours) before dispatching. A reminder dispatched during quiet hours SHALL be deferred until after the quiet-hours window ends. Each dispatched reminder SHALL be recorded in the `notifications` table.

#### Scenario: Reminder delivered within dose window
- **WHEN** a `send_reminder` job becomes due (`next_run_at <= now()`) and the patient's email channel is enabled and outside quiet hours
- **THEN** the system sends the reminder email, records the delivery in `notifications`, and marks the job as completed

#### Scenario: Reminder deferred during quiet hours
- **WHEN** a `send_reminder` job becomes due but the current time falls inside the patient's configured quiet hours
- **THEN** the system defers the job to after the quiet-hours end time and does not send the email yet

#### Scenario: Reminder skipped when patient disables email notifications
- **WHEN** a `send_reminder` job is processed and the patient's email notification preference is disabled
- **THEN** the system marks the job as completed without sending any email

### Requirement: System evaluates all active patients for adherence every night automatically
The system SHALL run `evaluateDailyPatternForPatient()` for every active, non-deleted patient once per night via a scheduled pg_cron job. The nightly evaluation SHALL trigger the existing 4-tier closed-loop pipeline (pattern detection, patient warning, SOS) for each patient without requiring manual doctor action. The batch evaluation SHALL be callable via a protected internal API endpoint (`POST /admin/patients/evaluate-all`) secured by an `ADMIN_SECRET` header — not accessible to doctor or patient roles.

#### Scenario: Nightly batch triggers warning email for a patient with 2+ skips
- **WHEN** the nightly pg_cron job runs and a patient has 2 or more consecutive missed/skipped doses
- **THEN** the system sends a clinical adherence warning email to that patient's `contact_email` (subject to the 48-hour cooldown)

#### Scenario: Nightly batch triggers guardian SOS for a patient with 3+ skips
- **WHEN** the nightly pg_cron job runs and a patient has 3 or more consecutive missed/skipped doses and a registered `guardian_email`
- **THEN** the system sends an urgent SOS email to the guardian and creates or updates an open escalation record

#### Scenario: Batch endpoint rejects unauthenticated callers
- **WHEN** a request is made to `POST /admin/patients/evaluate-all` without a valid `ADMIN_SECRET` header
- **THEN** the system returns 401 and does not run any evaluation
