# Tasks

## 1. Data and Contract Foundations

- [x] 1.1 Add migrations for durable patient pipeline runs, five stage projections, bounded stage logs, job-to-run/stage linkage, notification/profile preference fields, and approval idempotency or suggestion persistence fields; verify migrations apply cleanly and preserve existing rows.
- [x] 1.2 Add shared API/domain types for dashboard aggregates, pipeline status/logs, complete doctor preferences, approval payloads, and typed recoverable errors; verify frontend and API typechecks compile against the contracts.
- [x] 1.3 Define event-driven job types and the mapping to the five visible stages (Reminder, Dose Logging, Pattern Detection, Escalation, Care Team Interaction); verify contract fixtures cover independent events, retries, dead-letter results, empty runs, and partial-data responses.
- [x] 1.4 Define bounded dashboard activity and pipeline-log response shapes, including freshness, correlation, error, and pagination/retention fields; verify contract fixtures cover empty and partial-data responses.

## 2. Backend Doctor Workflows *(requires backend availability)*

- [x] 2.1 Implement authorized doctor dashboard and patient-workspace read endpoints for assignment-scoped patient counts, adherence aggregates, open escalations, reminder metrics, recent activity, and required patient detail data; verify API tests reject cross-workspace/unassigned access and return explicit unavailable metrics without disclosing patient existence.
- [x] 2.2 Extend prescription approval to accept validated AI suggestion data and edited medication values, persist revisions, enqueue downstream work, and write audit events atomically or through an outbox; verify success, validation failure, authorization failure, and rollback behavior.
- [x] 2.3 Add approval idempotency handling keyed by the client request key; verify retries return the canonical original result without duplicate prescriptions, jobs, revisions, or audit records.
- [x] 2.4 Create a patient pipeline run and five stage projections from an authorized clinical trigger, and link resulting event-driven jobs to their run/stage; verify the approval-to-pipeline vertical slice preserves patient, workspace, and correlation scope.
- [x] 2.5 Implement worker stage projection updates for independent jobs, attempts, retries, completion, and dead-letter outcomes; verify stale or late job updates cannot overwrite newer terminal stage state.
- [x] 2.6 Implement authorized patient pipeline status and bounded log endpoints over the durable projection; verify stage transitions and failure logs are reflected in subsequent reads and unassigned patients are denied.
- [x] 2.7 Complete authenticated doctor profile and notification preference GET/PUT validation, including channels and quiet-hour formats; verify invalid updates preserve prior values and successful updates round-trip.
- [x] 2.8 Add backend unit/integration tests for event-to-stage mapping, projection consistency, dashboard and patient-read aggregation, approval transaction/audit boundaries, pipeline authorization, settings validation, correlation IDs, and secret-safe error payloads; document backend-mode prerequisites, endpoint behavior, migration order, and rollback/feature-disable procedure; verify the API test suite and documented backend validation commands pass.

## 3. Frontend Doctor Portal

- [x] 3.1 Add typed API client methods for dashboard, approval, pipeline/logs, and complete settings while preserving development-only fallback boundaries; verify API client tests cover success, retryable errors, and correlation IDs.
- [x] 3.2 Replace hardcoded dashboard statistics/activity with backend response data and explicit loading, empty, unavailable, error, and retry states; verify backend-mode UI never displays demo metrics after a failed request.
- [x] 3.3 Replace local AI prescription approval and `sessionStorage` pipeline triggering with the server approval transaction, including pending/success/failure states and canonical response reconciliation; verify a failed approval leaves local prescriptions unchanged.
- [x] 3.4 Add patient-aware mock pipeline snapshots for David Kowalski, Marcus Rivera, and Sofia Patel, including escalation, idle, complete, running, error, and empty-state fixtures; verify each patient renders the intended five-stage workflow in development demo mode.
- [x] 3.5 Load durable five-stage pipeline projections/logs in `CareTeamPage` and retain local transitions only for development demo mode; verify refresh reflects server transitions without browser timers or `sessionStorage` in backend mode.
- [x] 3.6 Bind demo approval actions to the selected patient's mock pipeline transition while keeping backend approval server-authoritative; verify mock logs and stage states update without sending mock state to the API.
- [x] 3.7 Bind `DoctorShell` identity/workspace display to the authenticated session and add recoverable patient/escalation sidebar errors with retry; verify empty results and load failures are distinguishable.
- [x] 3.8 Complete doctor settings controls for persisted profile and notification preferences with field validation and save/error feedback; verify values reload after navigation and demo mode remains functional.
- [x] 3.9 Add frontend tests for patient-specific mock snapshots, event-driven projection display, dashboard and patient-read states, AI approval mutation behavior, pipeline loading/error handling, identity rendering, and settings persistence; document the explicit development-only demo boundary and verify targeted tests and frontend typecheck pass.

## 4. Verification and Documentation

- [x] 4.1 Add or update backend seed/demo fixtures for dashboard and patient-read aggregates, pipeline runs/stages/logs, event-driven job retries, approval retries, and doctor preferences; verify the protected demo workflow exercises these records without exposing secrets.
- [x] 4.2 Run the full integration verification covering doctor login, dashboard and patient-read loading, patient isolation, AI approval persistence, event-driven job projection, pipeline refresh, settings round-trip, and audit/idempotency outcomes; verify failures produce correlation IDs and no clinical mutation is presented as successful.
- [x] 4.3 Run formatting, frontend/API typechecks, targeted API/frontend tests, and the production build; verify all pass and record any non-blocking bundle warnings separately.
