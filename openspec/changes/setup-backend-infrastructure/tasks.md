# Tasks

## 1. Repository and Runtime Foundation

- [ ] 1.1 Add `apps/api`, `apps/worker`, shared type/validation modules, and backend scripts without changing the existing Vite entrypoint; verify the expected workspace structure and existing frontend build remain intact.
- [ ] 1.2 Add server-only environment validation for Supabase, Resend, Gemini, API origin, storage bucket, and demo-mode settings; verify startup fails with actionable errors when required secrets are absent and never logs secret values.
- [ ] 1.3 Add API health and correlation-ID middleware plus structured safe logging; verify the health endpoint returns a non-sensitive status and each request receives a correlation identifier.
- [ ] 1.4 Document local API, worker, Supabase, Resend, and Gemini setup in the repository; verify every documented command and environment variable name matches the implementation.

## 2. Database, Storage, and Authorization

- [ ] 2.1 Create additive database migrations for workspaces, profiles, separate user roles, patient records, assignments, care grants, consent, conditions, visits, medications, prescriptions, revisions, schedules, dose logs, reports, escalations, AI records, jobs, notifications, corrections, and audit events; verify migrations apply to a clean database.
- [ ] 2.2 Add constraints, indexes, append-only protections, idempotency keys, system-generated patient identifiers, timestamps, and soft-delete/retention fields where required; verify duplicate dose and duplicate job submissions are rejected or resolved to the existing result.
- [ ] 2.3 Add row-level security policies and server authorization helpers for doctor, care-team, patient, caregiver, administrator, workspace, assignment, consent, and audit scopes; verify an authorization matrix covers assigned, unassigned, revoked, cross-workspace, and direct API access cases.
- [ ] 2.4 Configure a private medical-report storage bucket and authorized signed URL flow; verify unauthorized users cannot obtain object URLs and authorized users receive short-lived links.
- [ ] 2.5 Add isolated fictional demo migrations/seed data for the existing doctor, care team, patients, visits, prescriptions, adherence history, reports, analyses, escalations, and citations; verify seed execution is explicit, repeatable, labeled as demo data, and unavailable through client-callable routes.

## 3. Authentication and Protected API

- [ ] 3.1 Implement session verification, role-gated doctor/patient login, sign-out, password recovery, email verification, and session refresh using Supabase Auth; verify wrong-portal logins and unauthenticated requests return safe errors without account enumeration.
- [ ] 3.2 Implement typed request validation and consistent error responses for protected API routes; verify malformed input, expired sessions, missing permissions, and unexpected server failures produce safe non-clinical error messages.
- [ ] 3.3 Implement patient creation with server-generated Patient IDs, pending activation state, assignment, consent, and an activation-email job; verify the client cannot choose the identifier and the operation is auditable.
- [ ] 3.4 Add API contract tests for `/me`, patient lists/details, visits, adherence, medications, reports, settings, consent, and care-team reads; verify responses are filtered by role, assignment, ownership, and sharing policy.

## 4. Clinical Mutations and Background Jobs

- [ ] 4.1 Implement idempotent dose logging with authoritative server timestamps, schedule references, status, method, and reason; verify retries do not create duplicate events and the updated status is returned.
- [ ] 4.2 Implement transactional prescription review and approval with edited values, revision history, doctor identity, audit event, and downstream job enqueueing; verify non-doctors cannot approve and partial failures leave no incomplete approval.
- [ ] 4.3 Implement durable job claiming, retry, backoff, terminal failure, and dead-letter visibility in `apps/worker`; verify a failed job can retry without duplicating its clinical side effect.
- [ ] 4.4 Implement reminder scheduling, Resend delivery, provider message tracking, delivery webhooks, and quiet-hour/notification preference handling; verify enqueue, provider acceptance, bounce, retry, and confirmed-delivery states remain distinct.
- [ ] 4.5 Implement adherence aggregation, AI pattern analysis through Gemini, escalation creation, care-team notification, and periodic report generation; verify every AI result preserves input snapshot, structured output, citations, confidence, safety flags, model/configuration versions, and review state.
- [ ] 4.6 Add worker unit/integration tests for prescription-to-schedule flow, transient provider failures, webhook replay, AI failure, escalation creation, and safe retry behavior; verify the tests run without requiring production credentials.

## 5. Report, Consent, Correction, and Audit Workflows

- [ ] 5.1 Implement authenticated report upload metadata validation, private object upload, report listing, signed viewing, and clinician review state; verify file type/size/ownership checks and that application records contain object metadata rather than base64 contents.
- [ ] 5.2 Implement consent and communication preference reads/writes with required-versus-optional enforcement; verify preference changes affect subsequent sharing and notification decisions and create audit events.
- [ ] 5.3 Implement correction/review requests for dose, adherence, report, and AI records without mutating historical events; verify requests are visible only to permitted patient and care-team users.
- [ ] 5.4 Implement immutable audit event capture and authorized audit queries for authentication, private reads, mutations, AI activity, sharing changes, exports, and administrative actions; verify secrets and raw credentials never appear in audit output.
- [ ] 5.5 Add tests for report authorization, consent enforcement, correction immutability, audit completeness, and cross-patient isolation; verify the tests cover both successful and denied paths.

## 6. Frontend API Migration

- [ ] 6.1 Add a typed frontend API client and session provider, then replace simulated login/sign-out/navigation with authenticated session state; verify refresh, expiry, wrong-role, loading, and unauthorized states in both portal trees.
- [ ] 6.2 Migrate doctor shell, dashboard, patient page, new-patient flow, care-team page, and settings from direct mock imports to API reads and mutations; verify patient assignment, escalation acknowledgement, prescription approval, and settings persistence survive a page reload.
- [ ] 6.3 Migrate patient shell, dashboard, dose center, visits, transparency, reports, and settings from mock/local state to API-backed data; verify dose logging, consent changes, report upload/review, preferences, and correction requests persist across sessions.
- [ ] 6.4 Add frontend loading, empty, stale-data, recoverable error, and confirmation states for every migrated request; verify failures do not silently fall back to demo data when backend mode is enabled.
- [ ] 6.5 Remove production use of `src/lib/patientReports.ts` localStorage persistence and direct clinical mock-data reads while retaining an explicit development-only fallback; verify the fallback cannot be enabled in the configured backend environment.

## 7. Integration Verification and Handoff

- [ ] 7.1 Add an end-to-end demo workflow covering doctor login, patient creation, patient activation, patient dose logging, report upload, AI analysis, doctor approval, reminder enqueue, and care-team escalation visibility; verify the workflow passes against isolated fictional data.
- [ ] 7.2 Add CI scripts for formatting, TypeScript checks, migrations/RLS tests, API tests, worker tests, frontend build, and end-to-end checks; verify a clean checkout can run the documented validation commands.
- [ ] 7.3 Run a security review checklist for secret exposure, role escalation, cross-patient access, signed-link leakage, prompt injection through notes, webhook replay, duplicate reminders, and unsafe AI output; verify findings are documented with owners or mitigations.
- [ ] 7.4 Verify the deployed Vite frontend, separate Node API, separate Node worker, Supabase project, Resend integration, and Gemini integration communicate through configured environment variables; verify demo labels, health checks, logs, retries, and failure states are observable without exposing clinical data.
