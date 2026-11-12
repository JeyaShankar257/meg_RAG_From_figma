# Design

## Context

See `proposal.md — Why` for motivation. The adherence pipeline logic (`evaluateDailyPatternForPatient`, `processSendReminder`, `emailService`) is fully implemented. Two activation gaps exist:

1. **Worker** (`apps/worker/src/index.ts`) starts but never claims jobs — `processing: false` is hardcoded, the poll-claim-process loop is absent.
2. **Daily evaluation** has a per-patient doctor endpoint (`POST /doctor/patients/:id/evaluate-daily-pattern`) but no mechanism to call it nightly for all patients automatically.

No Edge Functions are used. All scheduling is pg_cron + pg_net calling the existing API server.

## Goals / Non-Goals

**Goals:**
- Worker continuously polls and processes `send_reminder` jobs → Email #1 fires per dose
- New internal batch endpoint evaluates all patients → Emails #2 and #3 fire nightly
- pg_cron + pg_net call the batch endpoint at 17:30 UTC (11pm IST) each night
- Zero new external services or infrastructure

**Non-Goals:**
- SMS or push notification channels (email only)
- Supabase Edge Functions
- Changes to the per-patient doctor endpoint or any existing pipeline logic
- Frontend changes

## Decisions

### Decision 1 — Enable the Worker polling loop in `apps/worker/src/index.ts`

The worker already has `DurableQueue.claimJobs()`, `processSendReminder()`, and retry/backoff logic. The only missing piece is the loop that calls them.

**Chosen:** Add a `setInterval` poll loop (using `pollIntervalMs` from config, default 5s) that claims pending jobs, dispatches them to the correct processor by `job.type`, and calls `completeJob` or `failJob`. Guard with `demoMode` flag — in demo mode the loop logs but does not send.

**Alternative considered:** pg_cron inserting jobs into a queue and a separate processor — rejected, the Worker and DurableQueue already exist for this.

```
Worker poll loop (every 5s):
  DurableQueue.claimJobs(limit=5)
        |
        +-- job.type === "send_reminder"
        |       -> processSendReminder(job, supabase, resendClient)
        |
        +-- job.type === "generate_dose_schedule"
        |       -> processGenerateDoseSchedule(job, supabase)
        |
        +-- job.type === "adherence_analysis"
                -> processAdherenceAndAiAnalysis(job, supabase)
```

### Decision 2 — New batch admin endpoint (no Edge Function)

**Chosen:** `POST /admin/patients/evaluate-all` in `apps/api/src/routes/admin/index.ts`, protected by `x-admin-secret: <ADMIN_SECRET env var>`. Fetches all active patients (`is_deleted = false`) and runs `evaluateDailyPatternForPatient()` for each sequentially. Returns a summary of outcomes.

**Authorization boundary:** Only the `ADMIN_SECRET` header grants access — no JWT, no role check. The secret is kept server-side. pg_net sends it as a request header from within the Postgres context.

**Alternative considered:** Reuse the existing doctor endpoint in a loop — rejected, that endpoint requires doctor JWT auth and targets one patient at a time.

### Decision 3 — pg_cron + pg_net for nightly trigger (no Edge Function)

pg_cron schedules a SQL job. pg_net makes the HTTP call to the API. Both are built-in Supabase Postgres extensions — no extra infra.

```
pg_cron schedule: '30 17 * * *' (17:30 UTC = 11:00pm IST)
        |
        v
SELECT net.http_post(
  url := 'https://<api-host>/admin/patients/evaluate-all',
  headers := '{"x-admin-secret": "<ADMIN_SECRET>"}',
  body := '{}'
);
```

**Alternative considered:** External cron service (cron-job.org) — rejected, pg_cron keeps everything within Supabase, no extra account needed.

### Decision 4 — Email provider fallback order (unchanged)

`emailService.ts` already implements: Nodemailer (SMTP) → Resend → capture. No changes needed. Only env vars must be set in production.

## Data Flow

```
PRODUCTION NIGHT (11pm IST):
                                                 Supabase DB
  pg_cron (17:30 UTC)                                |
        |                                            |
        v                                            |
  net.http_post()                                    |
        |                                            |
        v                                            v
  POST /admin/patients/evaluate-all         patients table
  [API server]                              (all active)
        |                                            |
        +<-------------------------------------------+
        |
        v
  for each patient:
    evaluateDailyPatternForPatient()
        |
        +-- dose_logs → adherenceScore, consecutiveSkips
        |
        +-- Tier 1 (2+ skips): sendEmail() → patient warning
        |
        +-- Tier 2 (3+ skips): sendEmail() → guardian SOS
                                + escalations table upsert


DOSE REMINDERS (continuous):
  dose_schedules table (30 rows/prescription)
        |
  Worker poll loop (every 5s)
        |
  DurableQueue.claimJobs()
        |
  processSendReminder()
        |
  notification_preferences check → quiet hours check
        |
  sendEmail() → patient dose reminder
        |
  notifications table record
```

## Authorization and Audit Boundaries

| Boundary | Protection |
|---|---|
| Batch endpoint | `x-admin-secret` header; rejects all other callers |
| Worker email dispatch | Server-side only; no browser access |
| Guardian email | Only sent when `patient.guardian_email` is set; never exposed to frontend |
| Audit trail | Each `evaluateDailyPatternForPatient()` call logs to `pipeline_stage_logs` with `correlation_id` |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| pg_net HTTP call fails (API down) | pg_cron retries on next scheduled run; pipeline_stage_logs record state |
| Batch runs too long for many patients | Sequential evaluation with per-patient error isolation — one patient failure does not block others |
| `ADMIN_SECRET` exposed in pg_cron job definition | Store in Supabase Vault; reference via `vault.decrypted_secrets` in cron SQL |
| Worker restarts mid-job | `claimed_at` timeout + exponential backoff via `failJob()` already handles this |
| Demo mode leakage | `demoMode` flag in worker config skips actual sends; `EMAIL_MODE=capture` in API does the same |

## Migration Plan

1. Enable pg_cron extension (Supabase dashboard → Database → Extensions)
2. Enable pg_net extension (same)
3. Deploy API with new `/admin/patients/evaluate-all` endpoint and `ADMIN_SECRET` env var set
4. Deploy Worker with polling loop enabled and email credentials set
5. Create pg_cron job via SQL (see tasks.md Task 3.2)
6. Verify by calling batch endpoint manually once and checking pipeline_stage_logs

**Rollback:** Delete the pg_cron job (`SELECT cron.unschedule('nightly-adherence-eval')`). The Worker can be redeployed without the poll loop in one commit revert.

