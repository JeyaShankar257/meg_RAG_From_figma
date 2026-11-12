# Tasks

## 1. Automatic Reminder Job Enqueueing

- [x] 1.1 Update `apps/api/src/routes/prescriptions/index.ts`: when inserting 30 days of `dose_schedules`, fetch the patient contact email and immediately insert corresponding `send_reminder` rows into `jobs` with `next_run_at = scheduled_at`.
- [x] 1.2 Update `apps/worker/src/jobs/processors.ts`: in `processGenerateDoseSchedule`, after inserting `dose_schedules`, enqueue corresponding `send_reminder` jobs with `next_run_at = scheduled_at`.

## 2. Admin Due Dose Dispatch Endpoint

- [x] 2.1 Add `POST /admin/reminders/dispatch-due` to `apps/api/src/routes/admin/index.ts`: queries active dose schedules due today, filters out already notified doses, and dispatches reminder emails via `sendEmail()`.
- [x] 2.2 Add unit test for `POST /admin/reminders/dispatch-due` in `apps/api/src/routes/admin.test.ts`.

## 3. Verification & Live Test

- [x] 3.1 Run `pnpm typecheck` to verify no compilation errors across the monorepo.
- [x] 3.2 Trigger `POST /admin/reminders/dispatch-due` using curl to verify immediate email delivery to patient email (`mpriyadharshini200833@gmail.com`).

