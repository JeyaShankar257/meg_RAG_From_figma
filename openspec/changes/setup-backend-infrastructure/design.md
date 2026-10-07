# Design

## Context

The current Vite/React application renders directly from `src/lib/mockData.ts`; login is simulated with a timeout, report files are stored as base64 data URLs in localStorage, and several workflow mutations exist only in component state or sessionStorage. The proposal defines the desired backend capability. This design chooses a same-repository backend that can replace those seams without moving the frontend to a different framework. Transactional clinical operations remain in TypeScript, while agentic care-team workflows run in a separate Python service behind durable job and result contracts.

## Goals / Non-Goals

**Goals:**

- Provide durable authentication, authorization, clinical persistence, private report storage, and audit history.
- Keep privileged clinical decisions and AI credentials on the server.
- Preserve a simple API boundary that the existing pages can adopt incrementally.
- Make prescription approval, dose logging, uploads, reminders, and AI jobs retry-safe.
- Seed fictional demo data without seeding from page load or client-callable functions.

**Non-Goals:**

- Production clinical compliance certification or acceptance of real PHI.
- Automatic prescribing, autonomous diagnosis, or replacing clinician review.
- Rebuilding the frontend routing or visual system.
- Supporting arbitrary third-party EHR interoperability in this change.

## Decisions

### Supabase primitives for identity, relational data, and files

Use Supabase Auth for account sessions, Postgres for the relational clinical model, row-level security as defense in depth, and private Storage buckets for uploaded reports. This fits the existing project plan and avoids introducing a separate identity service, database, and object store for the first backend.

The API must still perform explicit authorization checks. RLS is not treated as a substitute for application policy, especially for role-gated routes, caregiver grants, consent, and audit scopes.

Alternative considered: a custom Node authentication and database stack. Rejected for the initial change because it increases security-sensitive surface area without improving the frontend contract.

### Colocated TypeScript API service

Add an `apps/api` service in the same repository, using a small TypeScript HTTP framework and schema validation. The browser calls this service for protected clinical reads and writes. The service verifies the user session, resolves role and workspace context, validates input, performs the authorized transaction, and writes audit events.

The service uses a server-only privileged database connection only inside controlled handlers and worker code. The browser receives short-lived session material and never receives AI, email, or database administrator secrets.

Deploy `apps/api` as a separate Node service alongside the Vite frontend. This keeps the current frontend build intact while giving protected workflows a stable server runtime.

Alternative considered: direct browser-to-Supabase data access. Rejected because prescription approval, AI requests, report authorization, and audit guarantees need a controlled server boundary.

### Durable job table plus worker process

Represent downstream work in durable job records with type, payload reference, status, attempts, next-run time, idempotency key, and error metadata. Add an `apps/worker` process that claims jobs, performs reminders, delivery updates, adherence aggregation, AI analysis, escalation, and report generation, and records terminal or retryable outcomes.

This is intentionally a worker process rather than frontend timers or sessionStorage. The first deployment may trigger the worker through a hosted scheduler, but job state remains in Postgres so retries and recovery are observable.

Deploy `apps/worker` as a separate Node service alongside `apps/api`. The worker uses the durable job table as its handoff boundary and is independently restartable from the request-serving API.

Alternative considered: synchronous API calls for all downstream work. Rejected because email delivery, AI calls, and pipeline stages can be slow or fail independently of the user mutation.

### Python agent service for care-team workflows

Add an `apps/agents` Python service for stateful workflows such as RAG analysis, adherence pattern detection, escalation recommendation, and care-team coordination. The service consumes durable, correlation-linked jobs and returns validated structured results. It does not receive browser credentials and cannot directly approve prescriptions, change consent, mutate clinical records, or issue signed storage URLs.

The TypeScript API remains the single browser-facing boundary and owns authentication, authorization, patient/workspace scoping, clinical transactions, audit events, and persistence of accepted agent results. The TypeScript worker owns operational jobs such as reminders, delivery webhooks, retries, and queue maintenance; it may dispatch agent jobs but does not duplicate agent reasoning.

Use versioned JSON contracts shared between TypeScript and Python:

```text
AgentJob {
  jobId, type, patientId, workspaceId, correlationId, attempt, payload
}

AgentResult {
  jobId, status, evidenceIds, confidence, safetyFlags,
  structuredOutput, modelVersion, promptVersion,
  requiresDoctorReview
}
```

Agent results are idempotent by `jobId` and persisted through the API/database boundary. Any recommendation that could affect treatment remains advisory until an authenticated doctor approval transaction is completed by the TypeScript API.

Alternative considered: placing agent orchestration inside the TypeScript worker. Rejected because Python provides a better home for graph-based orchestration, retrieval evaluation, and future clinical signal tooling while preserving a narrow, auditable integration boundary.

### Domain model and transaction boundaries

Create migrations for workspaces, profiles, user roles, patient records, assignments, care grants, consent, conditions, visits, medications, prescriptions, prescription revisions, dose schedules, dose logs, delivery events, AI analyses, citations, escalations, pipeline jobs, reports, notifications, correction requests, and audit events.

Use transactions for:

- Patient creation, patient identifier allocation, assignment, and activation-email job creation.
- Prescription approval, revision recording, audit event creation, and downstream job enqueueing.
- Dose logging and duplicate detection.
- Report metadata creation after successful private object upload.
- Escalation acknowledgement and audit recording.

Use append-only records for dose events, AI results, prescription revisions, audit events, and correction requests. Corrections create a new review record rather than mutating historical evidence.

### API and frontend migration boundary

Introduce a typed API client and session provider, then migrate routes in slices: authentication and shells; patient dashboard and detail reads; dose logging; reports; prescription review; care-team actions; settings and consent. Each route gets loading, empty, unauthorized, recoverable error, and stale-data states.

Keep the current mock data as a development fallback only while each slice is migrated. The fallback must be disabled in the configured backend environment so a successful UI response cannot hide a failed API request.

### Storage and notification safety

Upload files through authenticated server-issued upload permissions or a server-mediated stream. Store only metadata and object paths in Postgres. Return signed download URLs after authorization. Validate MIME type, size, extension, ownership, and malware-scanning status where available.

Send activation, reminder, report, and escalation messages through Resend from server-only code. Record provider message IDs and delivery outcomes. Do not claim that a reminder was delivered based only on enqueue success.

### AI safety and provenance

The API accepts structured symptoms and an explicitly selected patient context snapshot. The Python agent service receives only permitted context and retrieved evidence through a durable job contract, sends model requests server-side, and returns validated structured output. The API persists the prompt/configuration version, model version, input snapshot, structured result, confidence, safety flags, citations, and status. The UI labels results as advisory. Only a doctor approval endpoint can create an active prescription from a suggestion.

## Risks / Trade-offs

- [Risk] Supabase RLS and application authorization drift apart -> Add authorization-matrix tests and require both policy checks and server checks for every private table.
- [Risk] A retry creates duplicate reminders, dose logs, or prescriptions -> Require idempotency keys and unique constraints around schedule events, jobs, and approval commands.
- [Risk] A worker fails after a clinical transaction commits -> Enqueue work in the same transaction and expose retry/dead-letter status to authorized operators.
- [Risk] Uploaded files contain malicious or sensitive content -> Keep buckets private, validate uploads, issue short-lived URLs, and add scanning/retention controls before real data.
- [Risk] AI output is unsafe or misclassified -> Preserve provenance and uncertainty, require doctor review, display safety flags, and keep emergency handling explicit rather than relying on model output alone.
- [Risk] The Vite preview environment cannot host the API process -> Run the API and worker separately in development and configure a deployed API base URL; keep the repository boundary colocated even when deployment is split.
- [Risk] Demo seed data is mistaken for clinical data -> Label the environment and seed records clearly, isolate seed access, and block production seed execution.

## Migration Plan

1. Add environment contracts, shared API types, database migrations, RLS policies, private storage configuration, and fictional seed data.
2. Add API health/auth endpoints and automated authorization tests before migrating UI reads.
3. Add the worker and durable jobs, then migrate patient creation and dashboard/detail reads.
4. Migrate dose logging and report uploads with duplicate prevention and signed URLs.
5. Migrate AI analysis, prescription approval, care-team acknowledgements, notifications, consent, settings, and audit views.
6. Run the frontend against the backend in demo mode, verify failure and recovery states, then remove production use of mock/localStorage data.

Rollback keeps the frontend fallback behind an explicit development flag, but database migrations remain additive. Disable new API routes or worker consumption before reverting the frontend; do not delete clinical or audit tables during rollback.

## Open Questions

- What retention, backup, and compliance controls are required before fictional demo boundaries can be opened to real patient data?
