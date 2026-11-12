# Spec Delta

## Purpose

Ensures daily routine dose reminder jobs (`send_reminder`) are automatically created whenever dose schedules are generated, and dispatched to patients at or near their scheduled dose time.

## ADDED Requirements

### Requirement: System SHALL automatically enqueue send_reminder jobs for all generated dose schedules
Whenever the system creates `dose_schedules` records for a prescription, the system SHALL insert a corresponding `send_reminder` job into the `jobs` table for each schedule entry. Each job SHALL specify `next_run_at` equal to the dose's `scheduled_at`, `status = 'pending'`, and include the patient ID, schedule ID, medication name/dosage, and patient contact email in the job payload.

#### Scenario: Prescription approval automatically creates 30 reminder jobs
- **WHEN** an authorized doctor approves a prescription with a 30-day schedule
- **THEN** the system generates 30 `dose_schedules` entries AND inserts 30 `send_reminder` jobs with matching `next_run_at` timestamps

#### Scenario: Due dose dispatch endpoint processes pending doses
- **WHEN** an authorized administrator or cron caller requests `POST /admin/reminders/dispatch-due`
- **THEN** the system identifies all active dose schedules due for the current window and triggers reminder email dispatch for any that have not yet received a notification today

