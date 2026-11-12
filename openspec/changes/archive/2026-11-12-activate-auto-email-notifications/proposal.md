# Proposal

## Why

- All 3 clinical email notification types (dose reminder, adherence warning, guardian SOS) are fully implemented in code but **never fire automatically** — the worker job loop is disabled and there is no nightly scheduler calling the daily evaluation for all patients.
- The care-team-adherence-pipeline change built the pipeline logic; this change activates it end-to-end so patients actually receive notifications in production.

## What Changes

- **Enable the Worker job processing loop** — the worker starts up but hardcodes `processing: false`; wire a real poll-claim-process loop so `send_reminder` jobs from `dose_schedules` are executed
- **Add a batch admin evaluation endpoint** — `POST /api/admin/patients/evaluate-all` that runs `evaluateDailyPatternForPatient()` for every active patient (internal, secret-key protected, no doctor auth)
- **Enable pg_cron on Supabase** — activate the Postgres extension
- **Enable pg_net on Supabase** — activate the Postgres HTTP extension
- **Create nightly pg_cron job** — SQL schedule (11pm IST / 17:30 UTC) that calls the batch endpoint via pg_net for all patients automatically
- **Set real email credentials** — `SMTP_USER`/`SMTP_PASS` or `RESEND_API_KEY` wired into API and Worker env vars

## Capabilities

### New Capabilities

- `auto-email-notifications`: System automatically sends dose reminders, clinical adherence warnings, and guardian SOS alerts without manual doctor action — driven by the Worker job loop and a nightly pg_cron scheduler

### Modified Capabilities

- `patient-portal-backend-workflows`: Adds batch admin evaluation endpoint that iterates all active patients; existing per-patient endpoint remains unchanged

## Impact

- **Backend**: `apps/worker/src/index.ts` (enable polling loop), `apps/api/src/routes/admin/` (new batch endpoint)
- **Data**: Supabase pg_cron + pg_net extensions enabled; new cron job row in `cron.job` table
- **Security**: Batch endpoint protected by `ADMIN_SECRET` header — not exposed to doctor/patient roles; all email dispatch remains server-side only
- **Compatibility**: No breaking changes — existing per-patient endpoint and all pipeline logic unchanged
- **Dependencies**: Depends on `care-team-adherence-pipeline` (complete ✅)

