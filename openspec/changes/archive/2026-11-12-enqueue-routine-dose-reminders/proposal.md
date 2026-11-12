# Proposal

## Why

- While the worker loop in `apps/worker/src/index.ts` is running and ready to process `send_reminder` jobs, **no `send_reminder` jobs are ever inserted into the `jobs` table** during prescription approval or dose schedule creation.
- Consequently, patients with approved prescriptions never receive daily routine medication reminder emails at their scheduled dose times.

## What Changes

- **Automatic Job Enqueueing on Schedule Creation**: Whenever `dose_schedules` are inserted (both during prescription approval in `apps/api/src/routes/prescriptions/index.ts` and in the worker's `processGenerateDoseSchedule` processor), automatically insert corresponding `send_reminder` jobs with `next_run_at = scheduled_at` and payload containing medication details and patient email.
- **Due Dose Reminder Poller / Dispatcher Endpoint**: Provide an endpoint `POST /admin/reminders/dispatch-due` (and an hourly pg_cron trigger or worker schedule scanner) that finds any `dose_schedules` due within the current time window that haven't had a reminder sent today, and dispatches the reminder email directly.
- **Support Immediate Test Reminders**: Allow triggering due reminders on-demand via the admin router so users can immediately test dose reminder delivery.

## Capabilities

### Modified Capabilities

- `auto-email-notifications`: Extends the auto-email notification capability so that `send_reminder` jobs are guaranteed to be created and dispatched for every generated dose schedule.

## Impact

- **Backend**: `apps/api/src/routes/prescriptions/index.ts`, `apps/worker/src/jobs/processors.ts`, and `apps/api/src/routes/admin/index.ts`.
- **Database**: Ensures rows are written into `jobs` (type `send_reminder`) and subsequently into `notifications`.
- **Security & Authorization**: All reminder generation remains server-side only; protected by admin secret or worker credentials.

