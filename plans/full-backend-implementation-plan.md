# Full Backend Implementation Plan Using Existing Mock Data

## Objective

Replace the current frontend-only mock state with a production-shaped, fictional-data backend while preserving the existing doctor portal, patient portal, RAG assistant, editable prescriptions, report sharing, adherence experience, and five-agent Care Team workflow.

This is one umbrella implementation plan covering:

- Supabase Auth, Postgres, RLS, private Storage, and pgvector.
- Node.js + TypeScript Hono API.
- Zod contracts and validation.
- Standalone Node.js worker with durable Postgres jobs.
- Gemini RAG and embeddings.
- Five-agent Care Team workflow:
  - Reminder Agent — rule-based.
  - Dose Logging Agent — rule-based.
  - Pattern Detection Agent — LLM + deterministic safety floor.
  - Escalation Agent — LLM + deterministic safety floor.
  - Care Team Interaction Agent — LLM + human approval for personalized outreach.
- Private Python/LangGraph service for Agents 3–5.
- Resend integration with capture-only development mode by default.
- Deterministic seed data derived from the current mock application.
- Complete frontend migration from direct mock/localStorage/sessionStorage state to typed APIs.

The system remains fictional/demo-only until clinical, legal, privacy, retention, backup, incident-response, and provider agreements are reviewed.

## Current Repository State

The repository currently contains:

- React 19 + Vite + Tailwind frontend at the repository root.
- Doctor and patient routes in `src/App.tsx`.
- Domain types in `src/lib/types.ts`.
- Fictional application data in `src/lib/mockData.ts`.
- Browser-local report files in `src/lib/patientReports.ts`.
- RAG frontend API helpers and explicit mock/API adapters.
- OpenSpec changes for backend infrastructure and RAG.
- A mock Care Team page driven by `sessionStorage`, component state, and timers.
- No implemented `apps/api`, `apps/worker`, Python agent service, Supabase migrations, RLS, private Storage, or real authentication.

The root Vite app must remain the frontend entrypoint. Backend services are added alongside it rather than moving or rewriting the frontend.

## Chosen Defaults

- Scope includes backend services and complete frontend API migration.
- Demo users are created by an explicit admin seed script. Passwords come from local/server environment variables and are never committed.
- Development email defaults to capture mode: messages and delivery transitions are persisted and viewable but not sent externally.
- Real Resend delivery requires an explicit environment flag, verified sender domain, and allowlisted fictional recipients.
- Seed includes small fictional PDF reports in a private Storage bucket so upload, signed viewing, extraction, indexing, retrieval, and RAG can be tested end to end.
- Existing visible mock identities, patient IDs, dates, prescriptions, visits, reports, pipeline logs, and trends remain recognizable after migration.
- Existing raw adherence states remain `taken_on_time`, `taken_late`, `skipped`, and `missed`, even where the current UI groups them as Taken/Missed.

## Target Architecture

```text
React/Vite frontend
        |
        | Supabase Auth session + HTTPS
        v
Node.js/TypeScript Hono API
        |
        +--> authorization + Zod validation
        +--> Supabase user-scoped/admin clients
        +--> transactional Postgres RPCs
        +--> private Storage signed URLs/uploads
        +--> durable jobs + audit events
        |
        v
Supabase Postgres / Auth / Storage / pgvector
        |
        v
Standalone Node.js worker
        |
        +--> schedule/reminder jobs
        +--> report extraction/indexing
        +--> RAG/Gemini jobs
        +--> adherence metrics and policy rules
        +--> Resend/capture delivery
        +--> calls private LangGraph service
        |
        v
Python/LangGraph service
        |
        +--> Pattern Detection Agent
        +--> Escalation Agent
        +--> Care Team Interaction Agent
```

The Node API and worker are the only components with privileged Supabase access or permission to perform side effects. The Python service is stateless and has no Supabase service key, Resend key, or browser exposure.

## Repository Layout

Keep the frontend at root and add a pnpm workspace:

```text
package.json                    # existing frontend + umbrella scripts
pnpm-workspace.yaml
src/                            # existing frontend
apps/
  api/
    package.json
    tsconfig.json
    src/
      index.ts
      app.ts
      env.ts
      middleware/
        auth.ts
        authorize.ts
        correlationId.ts
        errorHandler.ts
        rateLimit.ts
        safeLogger.ts
      routes/
        me.ts
        doctors.ts
        patients.ts
        visits.ts
        adherence.ts
        prescriptions.ts
        reports.ts
        rag.ts
        careTeam.ts
        settings.ts
        webhooks.ts
      services/
        patients.ts
        prescriptions.ts
        reports.ts
        doseLogging.ts
        notifications.ts
        audit.ts
      ai/
        gemini.ts
        embeddings.ts
        prompts.ts
        schemas.ts
  worker/
    package.json
    tsconfig.json
    src/
      index.ts
      env.ts
      runner.ts
      queue/
        claim.ts
        retry.ts
        deadLetter.ts
      jobs/
        generateDoseSchedule.ts
        sendDoseReminder.ts
        closeMissedDoseSlot.ts
        evaluateDosePattern.ts
        indexUploadedReport.ts
        generateEmbedding.ts
        runRagAnalysis.ts
        createCareTeamFollowUp.ts
        generateFollowUpDraft.ts
        sendApprovedFollowUpEmail.ts
        generatePeriodicReport.ts
      services/
        policyEngine.ts
        langGraphClient.ts
        resend.ts
        emailCapture.ts
        documentExtraction.ts
  agent-service/
    pyproject.toml
    app/
      main.py
      config.py
      schemas.py
      graph.py
      nodes/
        pattern_detection.py
        escalation_recommendation.py
        care_team_interaction.py
      prompts/
    tests/
packages/
  contracts/
    package.json
    src/
      auth.ts
      patients.ts
      prescriptions.ts
      reports.ts
      rag.ts
      careTeam.ts
      errors.ts
  database/
    package.json
    src/
      userClient.ts
      adminClient.ts
      generated.types.ts
      rpc.ts
  config/
    package.json
    src/
      env.ts
      featureFlags.ts
supabase/
  config.toml
  migrations/
  fixtures/
    reports/
  functions/                    # only if webhook/runtime needs require them
scripts/
  seed-demo.ts
  reset-demo.ts
  verify-seed.ts
```

Do not commit generated credentials, passwords, provider tokens, or real patient data.

## Environment Contracts

### Frontend-safe variables

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_BASE_URL
VITE_BACKEND_MODE=mock|api
VITE_RAG_MODE=mock|api
```

Only public Supabase URL/anon key and API base URL use `VITE_*`.

### API/worker secrets

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                    # only if a direct server driver is added
API_ORIGIN
FRONTEND_ORIGIN
INTERNAL_AGENT_SERVICE_URL
INTERNAL_AGENT_SERVICE_TOKEN
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_EMBEDDING_MODEL
GEMINI_EMBEDDING_DIMENSION=768
RESEND_API_KEY
RESEND_FROM
EMAIL_MODE=capture|resend
EMAIL_ALLOWLIST
REPORTS_BUCKET=patient-reports
DEMO_MODE=true
DEMO_DOCTOR_PASSWORD
DEMO_CARE_TEAM_PASSWORD
DEMO_PATIENT_PASSWORD
```

Use Zod environment validation separately in API, worker, seed script, and agent service. Fail startup with variable names and safe explanations, never values.

## Authentication and Session Model

Use Supabase Auth for password sessions in development.

### Login flow

1. Doctor/patient login page uses Supabase anon client only for Auth sign-in.
2. Frontend calls `GET /me` with the access token.
3. Hono verifies the token with Supabase and returns profile, role, workspace, and portal permissions.
4. Wrong-portal role causes a generic denial and frontend sign-out.
5. Hono verifies every protected request independently; frontend route guards are convenience only.
6. Password reset/email verification use Supabase Auth, with capture mode in development.

### Server clients

- **User-scoped Supabase client:** initialized with bearer token so RLS applies.
- **Admin/service-role client:** server-only, used for controlled worker operations, audit, signed URLs, and RPCs. Because it bypasses RLS, every use requires explicit authorization or a trusted job boundary.

### Demo Auth setup

`scripts/seed-demo.ts` uses the service role to create or reconcile fictional Auth users. Passwords come from the three demo password environment variables. The script is explicit, idempotent, and blocked when `DEMO_MODE` is false.

## Database and Domain Model

Use additive SQL migrations with UUID primary keys internally. Preserve current identifiers such as `dr-001`, `p-001`, and `PT-00231` in stable `external_demo_id`/`patient_number` fields for fixture compatibility.

### Identity and authorization

- `workspaces`
- `profiles`
- `workspace_memberships`
- `user_roles`
- `patients`
- `patient_guardians`
- `doctor_patient_assignments`
- `care_team_assignments`
- `caregiver_access_grants`
- `consent_records`
- `communication_preferences`

`patient_guardians` stores the recently added guardian name, phone, email, relationship, and authorized-contact status. Guardian access is not implied by contact data; it requires a separate grant.

### Clinical records

- `patient_conditions`
- `visits`
- `medication_catalog`
- `prescriptions`
- `medication_orders`
- `prescription_revisions`
- `clinical_citations`

Prescription approval/editing uses an authenticated Postgres RPC transaction to atomically store reviewed values, revision history, doctor identity, approval time, audit event, and downstream schedule job. The browser never activates a prescription directly.

### Dose and reminder records

- `dose_schedules`
- `dose_slots`
- `dose_events` append-only
- `adherence_snapshots`
- `reminder_deliveries`
- `dose_action_tokens`

Patients submit Taken or Skipped. Server derives On-time/Late from timestamp and Missed from an expired grace period. Reminder delivery failure remains a separate signal.

`dose_action_tokens` stores only token hashes, dose slot, expiry, used/revoked timestamps, and action scope. `GET /dose-actions/:token` is read-only; `POST /dose-actions/:token/confirm` atomically consumes the token and logs the dose.

### Reports and private files

- `patient_reports`
- `report_review_events`
- `document_indexing_jobs`

Private Storage objects use paths based on workspace/patient/report UUIDs, never user-provided path segments. Metadata stores object path, MIME type, size, hash, upload actor, malware-scan state where available, sharing state, indexing state, and review state. API issues short-lived signed URLs after authorization.

### RAG and AI provenance

- `knowledge_sources`
- `knowledge_chunks` with `vector(768)`
- `rag_queries`
- `rag_results`
- `ai_analyses`
- `ai_analysis_citations`
- `ai_review_events`

Store source/version/review state, embedding model/version, patient/workspace scope, chunk order, retrieval top-k/threshold, exact retrieved excerpts, model/prompt versions, input snapshot, structured output, safety flags, and review state.

### Care Team agents and tasks

- `dose_monitoring_runs`
- `pattern_events`
- `escalations`
- `care_team_tasks`
- `care_team_task_events` append-only

The five visible agents remain. Agents 1–2 are deterministic Node services; Agents 3–5 use the Python/LangGraph service. Deterministic safety policy sets minimum severity and the LLM cannot downgrade it.

Task states:

```text
open -> acknowledged -> in_progress -> resolved
                         \-> dismissed (reason required)
```

Default fictional routing:

- Concerning -> Care Coordinator Priya Dharshini.
- Urgent -> Attending Physician Dr. Jeya Shankar M; notify coordinator.
- Medication/side-effect concern -> suggest Pharmacist Parvathi as collaborator.

### Notification and reports

- `notification_drafts`
- `notification_deliveries`
- `periodic_reports`
- `periodic_report_deliveries`

Fixed reminder templates may send automatically after policy checks. LLM-personalized follow-up remains draft until approved. Store provider ID and each delivery transition; enqueue success is not delivery success.

### Platform reliability and governance

- `jobs`
- `job_attempts`
- `idempotency_records` where unique domain constraints are insufficient
- `audit_events` append-only
- `correction_requests`
- `feature_flags`
- `clinical_policy_versions`

## RLS and Authorization Matrix

Enable RLS on every patient/private table.

### Patient

- Read own profile, visits exposed by policy, medications, dose schedules/events, adherence, reports, communication preferences, consents, and approved patient-visible reports.
- Create own dose action, report metadata through controlled flow, preference/consent update, and correction request.
- Cannot read internal agent prompts, care-team task notes, unrelated patients, or prescription approval internals.

### Doctor

- Read patients assigned in the same workspace.
- Create/edit prescriptions, run RAG, review reports, and act on care-team tasks only for authorized patients.

### Care-team member

- Read/action patients explicitly assigned or granted according to role.
- Pharmacist/coordinator permissions are narrower than attending physician prescription permissions.

### Admin/auditor

- Explicit scoped audit/admin APIs; service role is never a browser role.

Test assigned, unassigned, cross-workspace, revoked, expired caregiver grant, consent withdrawal, direct REST/API access, and service-role misuse paths.

## Transaction and RPC Boundaries

The Supabase JavaScript client does not provide general multi-query transactions. Implement security-definer RPCs with strict authorization/context parameters for:

- patient creation + patient number + assignment + consent + activation job;
- prescription approval/edit + revision + audit + schedule job;
- dose token consumption + dose event + monitoring job;
- missed-dose closure + event + monitoring job;
- report metadata finalization after private upload;
- escalation + care-team task + notifications + audit;
- task acknowledge/assign/start/resolve/dismiss;
- job claim using `FOR UPDATE SKIP LOCKED`;
- idempotent webhook/delivery transitions.

RPCs must set safe search paths, validate actor/workspace, avoid accepting arbitrary table names/SQL, and return typed records.

## Hono API

### Middleware order

1. Correlation ID.
2. Safe structured logger with PHI/secret redaction.
3. CORS/origin policy.
4. Security headers and request size limits.
5. Rate limiting by actor/route.
6. Supabase session verification.
7. Role/workspace/patient authorization.
8. Zod request validation.
9. Handler.
10. Safe error mapping and audit outcome.

Use a stable error contract:

```json
{
  "error": {
    "code": "ANALYSIS_PROCESSING_FAILED",
    "message": "The analysis could not be completed.",
    "retryable": true,
    "requestId": "correlation-id"
  }
}
```

Do not return SQL/provider errors, stack traces, object paths, secret values, or patient-existence details.

### Core routes

```text
GET  /health
GET  /me

GET  /doctor/patients
POST /doctor/patients
GET  /doctor/patients/:patientId
GET  /doctor/patients/:patientId/visits
GET  /doctor/patients/:patientId/adherence
GET  /doctor/patients/:patientId/prescriptions
POST /doctor/patients/:patientId/prescriptions/:prescriptionId/revisions
POST /doctor/patients/:patientId/prescriptions/approve

GET  /doctor/patients/:patientId/reports
POST /doctor/reports/:reportId/review
GET  /reports/:reportId/download
POST /reports/:reportId/reindex

POST /doctor/patients/:patientId/ai-analyses
GET  /doctor/ai-analyses/:analysisId
GET  /doctor/ai-analyses/:analysisId/evidence

GET  /doctor/patients/:patientId/care-team
GET  /doctor/patients/:patientId/care-team/runs
GET  /doctor/patients/:patientId/care-team/tasks
GET  /doctor/care-team/tasks/:taskId
POST /doctor/care-team/tasks/:taskId/acknowledge
POST /doctor/care-team/tasks/:taskId/assign
POST /doctor/care-team/tasks/:taskId/start
POST /doctor/care-team/tasks/:taskId/resolve
POST /doctor/care-team/tasks/:taskId/dismiss
POST /doctor/care-team/tasks/:taskId/email-draft/approve
POST /doctor/care-team/tasks/:taskId/email-draft/reject
POST /doctor/care-team/runs/:runId/retry

GET  /patient/dashboard
GET  /patient/visits
GET  /patient/medications
GET  /patient/dose-slots
POST /patient/dose-slots/:slotId/taken
POST /patient/dose-slots/:slotId/skip
GET  /patient/adherence
GET  /patient/reports
POST /patient/reports/upload-intent
POST /patient/reports/:reportId/complete
GET  /patient/settings
PUT  /patient/settings
GET  /patient/consents
PUT  /patient/consents/:consentType
POST /patient/correction-requests

GET  /dose-actions/:token
POST /dose-actions/:token/confirm

POST /webhooks/resend
```

## Durable Worker

### Job schema

`jobs` includes type, payload reference, status, attempts/max attempts, next run, priority, idempotency key, lease owner/expiry, safe error code/detail, correlation ID, timestamps, and dead-letter state.

States:

```text
pending -> running -> completed
                   -> retry_scheduled -> running
                   -> failed_terminal/dead_letter
```

Claim through an atomic RPC using `FOR UPDATE SKIP LOCKED`. Renew leases for long jobs. Job handlers must be idempotent at the domain-write level, not only queue level.

### Job types

```text
send_activation_email
generate_dose_schedule
send_dose_reminder
close_missed_dose_slot
evaluate_dose_pattern
create_care_team_follow_up
generate_follow_up_draft
send_approved_follow_up_email
generate_periodic_report
index_uploaded_report
generate_embedding
run_rag_analysis
reindex_source
process_resend_delivery_event
```

Retry transient network/rate-limit errors with bounded exponential backoff and jitter. Do not retry validation, permission, revoked consent, suppression, or unsafe model-output failures blindly.

## Five-Agent Care Team Workflow

### Agent 1 — Reminder Agent (rule-based Node worker)

- Finds due dose slots.
- Checks active prescription, preferences, consent, timezone, quiet hours, verified email, suppression/complaint state, and prior delivery.
- Sends/captures a fixed HTML email with medicine name, dose, scheduled time, approved instructions, and **Take Medicine** CTA.
- Creates short-lived opaque one-time token; stores hash only.
- Persists provider/delivery outcomes.

GET link preview never mutates. Patient confirms through an idempotent POST.

### Agent 2 — Dose Logging Agent (rule-based Node API/RPC)

- Verifies patient/token/dose slot/prescription/action.
- Accepts Taken or Skipped.
- Uses server timestamp.
- Derives On-time/Late and closes missing events as Missed after grace period.
- Stores append-only event/audit.
- Enqueues pattern evaluation.

### Agent 3 — Pattern Detection Agent (LLM + safety floor)

- Node computes metrics and minimum severity.
- Python/LangGraph analyzes timing, misses/skips, reminder delivery, medication risk, changes, and prior events.
- Returns structured performance class, root cause, confidence, reasoning, evidence event IDs, uncertainty, and safety flags.
- Cannot reduce mandatory severity.

### Agent 4 — Escalation Agent (LLM + safety floor)

- Recommends escalation action, priority, assignee role, due time, and rationale.
- Node validates and atomically creates required pattern/escalation/task records.
- Cannot prescribe, modify medication, or create calendar appointments.

### Agent 5 — Care Team Interaction Agent (LLM + human approval)

- Drafts personalized follow-up email and task summary.
- Generates weekly/monthly narrative highlights from structured metrics.
- Node stores drafts; permitted care-team member edits/approves/rejects.
- Node performs authorized Resend/capture side effect.

### Safety-floor defaults

Versioned fictional defaults:

- Stable: 7-day adherence at least 80%, fewer than two consecutive true misses, no high-risk trigger.
- Reminder: one overdue slot or 70–79% adherence without higher trigger.
- Concerning minimum: two consecutive true misses, three true misses/7d, or adherence below 70%.
- Urgent minimum: three consecutive true misses, adherence below 50%, or high-risk medication with two consecutive true misses.

Final severity is the maximum of policy and validated LLM recommendation. On LLM failure, mandatory tasks still exist with `AI explanation unavailable`; no personalized email draft is generated.

## RAG Workflow

### Report indexing

1. Patient requests upload intent.
2. API validates metadata and issues constrained private upload permission or mediates stream.
3. Client uploads file.
4. API finalizes metadata/hash and enqueues indexing.
5. Worker downloads authorized object, extracts PDF text, normalizes, chunks, embeds, and stores patient-scoped chunks.
6. Report transitions `uploaded -> indexing -> ready` or `failed`; file remains available after failure.
7. Authorized retry reuses idempotency/version boundaries.

Support text PDFs first; OCR is deferred.

### Analysis

1. Doctor POSTs unified AI/RAG query for an assigned patient.
2. API creates analysis/request record and job.
3. Worker assembles authorized patient context.
4. Generate query embedding.
5. Retrieve approved global sources plus authorized patient chunks with scope filters inside retrieval.
6. Store ranked excerpts, scores, top-k, threshold, source versions.
7. Call Gemini with delimited untrusted evidence.
8. Validate structured output with Zod.
9. Persist provenance/result; frontend polls status/evidence.
10. Medication suggestions remain advisory and enter existing doctor edit/preview/approval transaction only.

Use initial configurable top six and threshold from the committed RAG design. Never search all patient chunks and filter afterward.

## Gemini and LangGraph Safety

- Provider credentials server-only.
- Minimize and authorize context.
- Treat reports, notes, emails, and retrieved text as untrusted.
- Delimit evidence/content from system instructions.
- Strict Pydantic/Zod schemas.
- Store prompt/model/config versions and input/output snapshots.
- Preserve uncertainty/conflict/insufficient evidence.
- No tool access that writes prescriptions, tasks, email, or database directly.
- Offline fictional labeled fixtures for RAG, pattern severity, root cause, and escalation quality.

## Email Modes

### Capture mode (default)

- Render final subject/body/recipient/template data.
- Persist simulated provider acceptance/delivery transitions.
- Expose captured messages through a development-only protected viewer/log.
- Never contact current mock email addresses.

### Resend mode

Enabled only when:

- `EMAIL_MODE=resend`;
- verified sender/domain exists;
- recipient is in `EMAIL_ALLOWLIST` in demo mode;
- webhook signing is configured;
- suppression/bounce/complaint handling is active.

No bulk campaigns. All sends are fixed-purpose or human-approved and idempotent.

## Deterministic Existing Mock Seed

### Seed strategy

- `scripts/seed-demo.ts` reconciles Auth users, relational rows, Storage fixtures, jobs, and vector fixtures.
- SQL migrations create schema/policies; seed script creates environment-dependent Auth/Storage records.
- Use stable fixture keys and upserts so reruns do not duplicate.
- `scripts/reset-demo.ts` is allowed only against explicitly marked local/demo projects.
- `scripts/verify-seed.ts` checks expected counts, relationships, storage objects, RLS behavior, and login roles.
- Seed does not run from page load or client-callable API.

### Existing identities

Preserve current display data:

- Doctor `dr-001`: Dr. Jeya Shankar M, Internal Medicine.
- Care team:
  - Dr. Jeya Shankar M — Attending Physician.
  - Priya Dharshini — Care Coordinator.
  - Parvathi — Pharmacist.
- Preserve current fictional emails as fixture fields for compatibility; capture mode prevents accidental delivery. Any future email normalization is a reviewed fixture migration.

### Existing patients

Seed:

- `p-001` / `PT-00231` Marcus Rivera — active, Type 2 Diabetes and Hypertension.
- `p-002` / `PT-00247` Amara Osei — active, Asthma and Hypothyroidism.
- `p-003` / `PT-00253` David Kowalski — active, Major Depressive Disorder and Insomnia, current escalation.
- `p-004` / `PT-00261` Sofia Patel — invited, GERD and Anxiety Disorder.

Preserve demographics, contact data, assignments, care-team IDs, adherence score/trend, escalation flag, and last-visit dates from `mockData.ts`.

### Existing clinical records

- Five current visits for `p-001` with symptoms, notes, proposed solution, outcome, doctor, and related visits.
- Two active prescriptions, citations, approval metadata, and existing revision.
- Current AI analysis, citations, model metadata, suggested Jardiance/Vitamin D3 medications, and RAG demo evidence as fictional analysis fixtures.
- Current escalation for `p-003` with severity, confidence, explanation, model version, status, and dates.

### Existing adherence

The current `generateHeatmap()` is random and must not be used by the backend seed. Create a fixed 90-day fixture ending `2026-09-12` with exactly:

- 58 taken on time.
- 11 taken late.
- 9 skipped.
- 12 missed.
- 2 reminder delivery failures linked to explicit slots/delivery records and handled according to policy.

The simplified UI may show Taken = on-time + late and Missed = skipped + missed, but backend/raw APIs preserve all four statuses.

Seed deterministic dose schedules/slots/events that produce the aggregate, heatmap, trust score, and trend. Never seed only aggregate values without source events.

### Existing reports and pipeline

- Three weekly/monthly adherence reports with current periods, adherence percentages, missed days, trend, insights, and delivered timestamps.
- Five current pipeline stages and logs as historical fictional run records, not hardcoded frontend data.
- Trust-score components and sparkline snapshots.
- One or more small fictional PDF reports linked to `p-001`, uploaded to private Storage and indexed into patient-scoped RAG chunks.

### New-patient fixtures

Patient creation persists guardian name/phone/email, consent, assignment, pending activation, and a server-generated patient number. Do not retain hardcoded `PT-00268`; generate through a sequence/transaction while tests assert format and uniqueness.

## Frontend Migration

Add a typed session provider and domain API modules. Migrate in slices; each API mode must show loading, empty, unauthorized, stale, retryable error, and terminal error states. API mode never silently uses mock/localStorage/sessionStorage data.

### Slice order

1. Auth/session and doctor/patient shell identity.
2. Doctor dashboard/patient list and patient creation.
3. Patient detail Overview, Visits, Adherence.
4. Prescriptions and transactional edit/approval/revision.
5. Patient dashboard, Dose Center, secure email confirmation route.
6. Patient/doctor report upload/list/review/indexing.
7. RAG Assistant polling/evidence/prescription bridge.
8. Care Team runs, tasks, escalation actions, and email draft approval.
9. Settings, consent, communication preferences, correction requests.
10. Remove production imports of `mockData.ts`, `patientReports.ts` localStorage, and `pipeline_triggered` sessionStorage.

Retain mock adapters only behind explicit development flags, visibly labeled. A configured backend failure must remain a failure.

## Observability and Audit

- Correlation ID from browser -> API -> job -> LangGraph/Gemini/Resend -> audit.
- Structured logs with patient content redacted or referenced by internal IDs.
- Metrics:
  - API latency/error/denial rates.
  - job queue age, attempts, dead letters.
  - email captured/sent/delivered/bounced/suppressed.
  - report indexing duration/failure.
  - RAG retrieval count/threshold/latency and Gemini failures.
  - dose action token expiry/replay attempts.
  - pattern severity distribution, tasks created/resolved/overdue.
  - LLM vs safety-floor disagreements and clinician overrides.
- Alert on repeated authorization denial, queue backlog, provider outage, webhook signature failure, dead letters, urgent task SLA breach, and audit write failure.

Audit private reads, uploads/downloads, prescription mutations, dose actions, consent/preferences, RAG activity, agent decisions, task actions, email approvals/sends, exports, corrections, and admin/seed operations. Never audit raw passwords/tokens/provider secrets.

## Failure and Recovery

- API/worker unavailable: frontend shows recoverable unavailable state; no mock success fallback.
- Supabase unavailable: fail closed; jobs retain retry state.
- Duplicate command/webhook/click: return existing domain result.
- Partial clinical transaction: RPC rolls back atomically.
- Worker crash: lease expires and another worker safely claims job.
- Email preview scanner: GET is read-only; no dose event.
- Email token expired/replayed: safe error and portal link.
- Reminder bounce/suppression: persist and stop blind retry.
- Missing dose log: hourly scanner closes slot.
- Report extraction/embedding failure: file remains private/available; indexing failed/retryable.
- Gemini invalid/unsafe output: analysis fails/needs review; no prescription created.
- LangGraph failure: mandatory policy task still created; no personalized draft.
- Consent revoked: cancel unsent actions, enforce future filtering, preserve historical audit.
- Patient/assignment revoked: deny new reads/writes/jobs; do not reveal existence.
- Seed rerun: reconcile/upsert, never duplicate.

## Testing Strategy

### Unit

- Zod env/request/response schemas.
- Role/assignment/consent policy helpers.
- Dose schedule parsing, timezone, quiet hours, grace periods.
- On-time/late/skipped/missed derivation.
- Reminder eligibility/token expiry/replay.
- Adherence and trust calculations.
- Every safety-floor boundary and merge rule.
- RAG chunking/query/result mapping.
- Pydantic/Zod parity for LangGraph.
- Email templates exclude prohibited content.

### Database/RLS

- Clean migration apply and rollback strategy.
- Authorization matrix for every private table.
- RPC actor/workspace checks.
- Cross-patient/workspace denial.
- Append-only/audit protections.
- Unique/idempotency constraints.
- pgvector scope filtering before ranking.

### API integration

- Auth role gating and safe errors.
- Patient list/detail/create.
- Prescription edit/approval atomicity.
- Dose portal/email confirmation/replay.
- Private upload/signed download/review.
- RAG create/poll/evidence/error.
- Care-team task lifecycle/email approval.
- Resend webhook signature/replay.

### Worker integration

- Job claim/lease/retry/dead-letter.
- Prescription -> schedule -> reminder capture.
- Dose event -> pattern -> escalation/task.
- LangGraph timeout/invalid output/policy fallback.
- Report -> extraction -> embedding -> RAG.
- Periodic report and delivery outcome.

### End-to-end fictional flows

1. Doctor login -> assigned patients only.
2. Add patient -> guardian/consent -> pending activation -> captured activation email.
3. Patient login -> dashboard/visits/medications.
4. Prescription edit/approve -> revision -> dose schedule.
5. Reminder capture -> secure CTA -> confirm -> one dose event.
6. Patient skip and missed-slot closure.
7. Pattern Agents 3–5 -> task -> acknowledge/assign/resolve -> approved personalized email.
8. Patient report upload -> doctor review -> indexing -> RAG evidence.
9. Doctor RAG query -> evidence -> edit suggestion -> approval.
10. Two patients in parallel with no data bleed.
11. Reload/session expiry/network/provider failure and recovery.
12. Seed reset/reconcile reproduces expected deterministic UI.

### Security

- Secret and dependency scanning.
- Direct PostgREST/API/RPC authorization attacks.
- Service-role exposure check in source/build.
- Signed URL/token leakage/replay.
- Prompt injection in reports/notes/email text.
- Rate limiting and abusive AI/job creation.
- CSRF/origin protections for browser mutations.
- Webhook signature/replay.
- Log/audit redaction.

## CI and Verification Commands

Add root scripts that call exact workspace commands:

```text
pnpm format
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:api
pnpm test:worker
pnpm test:agent
pnpm test:e2e
pnpm build
pnpm verify:seed
```

CI provisions isolated Supabase, applies migrations, runs fictional seed, starts API/worker/agent service, and uses capture email mode. Provider-specific tests use mocked Gemini/Resend unless explicitly running a protected integration workflow.

## Deployment

Deploy separately:

- Vite frontend.
- Hono Node API.
- Node worker.
- Private Python/LangGraph service.
- Supabase project.

Configure health/readiness endpoints, allowed origins, service authentication, provider secrets, migration promotion, worker scheduler, queue monitoring, backup/restore, and rollback runbooks. Figma Make preview consumes a deployed/local API URL; it does not host the worker/agent service itself.

Rollback order:

1. Stop new feature/job enqueueing through flags.
2. Stop worker consumption for affected job types.
3. Disable routes/UI slices.
4. Preserve additive schema, audit, jobs, files, and clinical history; never delete as rollback.
5. Re-enable explicit frontend mock mode only in development, never as hidden production fallback.

## OpenSpec Reconciliation

Use this document as the umbrella implementation sequence while retaining capability specs.

- `setup-backend-infrastructure`: revise tasks/schema details to this plan.
- `add-rag-ai-assistant`: preserve RAG requirements and align contracts/error shape.
- Add `add-care-team-agentic-workflow`: five-agent rule/LLM allocation, secure email CTA, task/email approval, LangGraph boundary.
- Update conflicting “fully AI-driven/no rule floor” language to the hybrid safety-floor decision.
- Mark tasks complete only after code and verification exist; current checked frontend contract items remain reviewed against final shared contracts.

## Implementation Phases

### Phase 1 — Workspace and contracts

- Add pnpm workspace, shared contracts/config/database packages.
- Add API/worker/agent service skeletons.
- Add environment validation, correlation IDs, safe logging, health checks.
- Reconcile OpenSpec and error/contracts.

### Phase 2 — Supabase foundation and deterministic seed

- Add Auth/profile/workspace/patient/care-team/consent schema.
- Add migrations/RLS/audit/jobs/private bucket.
- Implement demo Auth/relational/Storage seed and verification.
- Prove cross-patient/workspace denial before clinical features.

### Phase 3 — Auth and core reads

- Session provider, `/me`, role-gated portals.
- Patient lists/details, visits, medications, settings, consent.
- Migrate shell/dashboard/read-only pages.

### Phase 4 — Prescriptions and dose foundation

- Transactional prescription approval/edit/revisions.
- Dose schedules/slots, deterministic logging/status derivation.
- Secure email action tokens.
- Migrate Prescription and Dose Center.

### Phase 5 — Reminder/email operations

- Rule-based Reminder Agent.
- Capture mode, Resend adapter, webhook outcomes, quiet hours/suppression.
- Activation, reminder, report, escalation templates.

### Phase 6 — Reports and Storage

- Upload intent/finalize, private signed viewing, review state.
- Fictional PDFs and report migration.
- Extraction/indexing jobs and status/retry UI.

### Phase 7 — RAG

- pgvector schema/functions and approved sources.
- Gemini embedding/analysis adapters and structured validation.
- RAG endpoints, polling, evidence, provenance, audit.
- End-to-end uploaded-report retrieval.

### Phase 8 — Five-agent Care Team workflow

- Metrics/safety policy and monitoring jobs.
- Python/LangGraph Agents 3–5.
- Escalation/task transaction and routing.
- Personalized email draft approval and periodic reports.
- API-backed Care Team page replacing sessionStorage/timers.

### Phase 9 — Complete frontend migration

- Remaining loading/error/stale/unauthorized states.
- Remove production mock/local/session persistence.
- Preserve explicit development fixtures/adapters only.

### Phase 10 — Verification and release gates

- Full test matrix and fictional UAT.
- Security/privacy/clinical governance reviews.
- Provider/deployment/backup/monitoring/rollback validation.
- Production remains blocked for real PHI until all gates are approved.

## Completion Criteria

- Existing fictional UI data is reproducible from deterministic backend seed, not page-load mocks.
- Doctor/patient/care-team users authenticate and see only authorized data.
- Patient creation, guardians, consent, visits, prescriptions, dose events, reports, settings, and corrections persist across reloads.
- Prescription approval/edit is atomic, auditable, and queues downstream work.
- Rule-based reminder and dose agents operate securely and idempotently.
- Secure email CTA cannot be triggered by scanner preview and stores one Supabase dose event after confirmation.
- LLM Agents 3–5 are structured, versioned, safety-floor constrained, failure-aware, and side-effect free.
- Care-team tasks and personalized outreach follow approval/audit rules.
- Uploaded fictional PDF becomes private, indexed, and available as authorized RAG evidence.
- RAG is patient/workspace scoped, traceable, and cannot activate medication.
- Email capture is default; Resend is explicitly gated.
- Frontend API mode has no silent mock fallback.
- Migrations, seed verification, typecheck, formatting, unit/integration/E2E/security tests, and production builds pass.
