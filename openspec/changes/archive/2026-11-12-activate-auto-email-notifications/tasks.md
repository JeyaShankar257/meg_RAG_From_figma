# Tasks

## 1. Backend — Batch Admin Evaluation Endpoint

- [x] 1.1 Create `apps/api/src/routes/admin/index.ts` with `POST /admin/patients/evaluate-all` endpoint: fetch all active non-deleted patients, run `evaluateDailyPatternForPatient()` for each, return a summary `{ evaluated: number, errors: string[] }`. Verify by calling the endpoint with the correct `x-admin-secret` header and confirming it returns a valid summary with no 401/500.
- [x] 1.2 Add `ADMIN_SECRET` env var check to the admin middleware: reject any request missing or having a wrong `x-admin-secret` header with 401. Verify by calling the endpoint without the header and confirming 401 is returned.
- [x] 1.3 Mount the admin router in `apps/api/src/index.ts` at `/admin`. Verify by running `pnpm typecheck` with no errors and confirming the route is reachable.
- [x] 1.4 Add `ADMIN_SECRET` to `apps/api/.env.example` with a placeholder comment. Verify the file contains the new entry.

## 2. Backend — Worker Job Processing Loop

- [x] 2.1 Add a `startJobLoop()` function to `apps/worker/src/index.ts` that uses `setInterval` with `pollIntervalMs` from config: each tick calls `DurableQueue.claimJobs(maxConcurrentJobs)`, dispatches each job by `job.type` to the matching processor (`processSendReminder`, `processGenerateDoseSchedule`, `processAdherenceAndAiAnalysis`), and calls `completeJob` or `failJob` based on result. Verify by running the worker in demo mode and confirming `[WORKER]` polling log lines appear every 5 seconds.
- [x] 2.2 Guard the loop with `demoMode`: when `demoMode = true`, log `[WORKER DEMO] Job loop running (no actual sends)` but still claim and process jobs — `emailService` already captures in demo mode so this is safe. Verify by setting `DEMO_MODE=true` and confirming no real emails are sent while jobs are marked completed.
- [x] 2.3 Add `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT` to `apps/worker/.env.example`. Verify the file contains all new entries with placeholder comments.
- [x] 2.4 Add a worker integration test: insert a `send_reminder` job into the `jobs` table (using admin client), call `processSendReminder()` directly, and assert the job result is `{ success: true }` and a `notifications` row exists. Verify by running `pnpm test` in `apps/worker` with the test passing.

## 3. Data — Supabase pg_cron + pg_net Setup

- [x] 3.1 Enable `pg_cron` and `pg_net` extensions in Supabase: run the following SQL in Supabase SQL editor and verify no errors: `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;`
- [x] 3.2 Create the nightly pg_cron job via SQL — scheduled at `30 17 * * *` (17:30 UTC = 11:00pm IST), calling `POST /admin/patients/evaluate-all` with the `x-admin-secret` header via `net.http_post()`. Verify by running `SELECT * FROM cron.job;` and confirming the job row exists with the correct schedule.
- [x] 3.3 Manually trigger a test run: call `SELECT net.http_post(url := '<api-url>/admin/patients/evaluate-all', headers := '{"x-admin-secret":"<secret>"}', body := '{}');` and verify `pipeline_stage_logs` rows are created for at least one patient.

## 4. Tests — Batch Endpoint and Worker

- [x] 4.1 Add an API test for `POST /admin/patients/evaluate-all`: assert 401 with no secret, 200 with correct secret and at least one patient evaluated. Verify by running `pnpm test` in `apps/api` with the new tests passing.
- [x] 4.2 Run `pnpm typecheck` across the full monorepo and confirm zero TypeScript errors. Verify output shows no errors.

## 5. Verification — End-to-End

- [x] 5.1 Set real email credentials (`SMTP_USER`/`SMTP_PASS` or `RESEND_API_KEY`) in `apps/api/.env` and `apps/worker/.env`. Verify by calling the batch endpoint and checking that at least one patient with consecutive skips receives a warning email (check `pipeline_stage_logs` for `level: "warn"` entries).
- [x] 5.2 Verify the Worker dose reminder path end-to-end: approve a prescription (creates `dose_schedules` and a `send_reminder` job), wait for the Worker loop to pick it up, and confirm a row appears in the `notifications` table with `status: "sent"`.
- [x] 5.3 Check pg_cron ran the next morning: query `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` and confirm the nightly job completed with `status = 'succeeded'`.

