# Design

## Context

See `proposal.md` for motivation. The current portal loads some patient,
prescription, report, escalation, and settings data from the API, but dashboard
aggregates, AI suggestion approval, pipeline transitions, identity display, and
some settings remain local or hardcoded. The existing API already has doctor
authorization middleware, correlation IDs, prescription approval, jobs, and
audit events. The `add-rag-ai-assistant` change supplies the production
analysis/evidence contract that feeds the approval UI.

## Goals / Non-Goals

**Goals:**

- Make production doctor views read from authorized server contracts.
- Make AI approval one explicit, idempotent server transaction.
- Make pipeline status durable, queryable, and correlated to jobs.
- Persist all doctor settings needed by the portal.
- Preserve development-only demo behavior and provide visible recoverable
  failures.

**Non-Goals:**

- Building the RAG retrieval or model-provider workflow itself; that remains in
  `add-rag-ai-assistant`.
- Implementing patient-facing workflows, patient registration/activation,
  report upload/indexing, or the broader backend phases described in the
  uploaded feature map.
- Allowing AI output to activate medication without doctor approval.
- Replacing the existing authentication or RLS model.

## Decisions

### Primary interaction flow

```text
[Doctor session]
      |
      v
[DoctorShell / Dashboard] ---> [authorized dashboard query]
      |
      v
[PatientPage] ---> [RAG advisory result]
      |                         |
      | doctor edits/reviews    v
      +--------------------> [POST approval]
                                  |
                 +----------------+----------------+
                 v                                 v
        [prescription + revision]        [job + audit event]
                 |                                 |
                 +----------------+----------------+
                                  v
                       [durable pipeline state/logs]
```

### Event-driven jobs and doctor-facing projection

Workers process independent domain events rather than executing a mandatory
five-step chain. The care-team page presents a stable five-stage projection so
doctors can understand the workflow without coupling the UI to worker
topology:

```text
[Clinical/domain event]
          |
          v
[Durable job] ---> [Worker operation]
     |                    |
     |                    +--> completed
     |                    +--> retryable failure
     |                    +--> dead-letter
     v
[Patient pipeline run + mapped stage projection]
          |
          v
[CareTeamPage reads stages and bounded logs]
```

Visible stage mapping:

```text
Reminder Agent             <- schedule generation and reminder jobs
Dose Logging Agent         <- dose validation/logging events
Pattern Detection Agent   <- adherence analysis and AI result jobs
Escalation Agent          <- escalation creation/update events
Care Team Interaction     <- acknowledgement, outreach, and report jobs
```

Each clinical trigger creates or attaches to a patient-scoped pipeline run.
Jobs link to the run and visible stage, while worker transitions update the
stage projection and append bounded logs. A correlation ID is preserved from
the originating API request through the job, worker operation, stage update,
and audit event.

### Server contracts and data ownership

- Add a doctor dashboard endpoint returning typed aggregate sections and
  recent activity, rather than making the browser derive clinical metrics from
  incomplete patient list rows.
- Keep doctor patient workspace reads used by the dashboard, patient detail,
  approval, and care-team views assignment/care-team scoped. Do not introduce
  a second authorization path for the broader patient workspace roadmap.
- Extend prescription approval to accept a validated suggestion payload or
  create a draft suggestion server-side before approval. Use a client
  idempotency key that is stable across retries and return the canonical
  persisted record.
- Add patient-scoped pipeline runs, stage projections, and bounded log reads.
  Link event-driven jobs to the run/stage records so worker transitions update
  the same records used by the care-team view.
- Extend the authenticated profile settings contract with profile and
  notification preferences. Keep server validation authoritative.

### Authorization and audit boundaries

- Every doctor read is constrained by `workspace_id` and active
  `care_team_assignments`; unassigned patient IDs return a non-disclosing
  authorization error.
- Approval performs assignment authorization again on the server, writes
  revision and audit records, and enqueues work with the request correlation
  ID. Browser state is never a source of clinical truth.
- Pipeline logs exclude secrets and untrusted model text beyond the bounded
  diagnostic payload required for review.

### Frontend state strategy

- Add typed API client methods and response models for dashboard,
  pipeline/logs, approval, and complete settings.
- In backend mode, show explicit loading/error/empty states and retry
  callbacks. Do not initialize clinical values from demo constants.
- In development demo mode only, retain mock data through patient-aware
  pipeline snapshots and local presentation transitions. The mode boundary
  remains `isBackendConfigured()`, and backend mode must never use
  `sessionStorage` or browser timers as pipeline truth.

### Data model

```text
pipeline_runs
  id, patient_id, workspace_id, trigger_type, trigger_id, status,
  correlation_id, created_at, started_at, completed_at, last_error

pipeline_stages
  id, pipeline_run_id, stage_key, status, agent_name, attempt,
  last_job_id, started_at, completed_at, last_error, updated_at

pipeline_stage_logs
  id, pipeline_stage_id, job_id, level, message, metadata,
  correlation_id, created_at

jobs
  ... existing queue fields ...
  pipeline_run_id, pipeline_stage_id
```

The five stage rows are created when a run is created. Jobs may target any
stage independently, and stage status is derived from the latest linked job
outcome. The API returns only bounded recent logs; append-only audit events
remain the authoritative clinical history.

### Compatibility and rollout

- Prefer additive endpoints and optional request fields where existing clients
  may still be deployed.
- Migrate data before enabling backend-mode UI reads; seed deterministic demo
  pipeline and preference records for end-to-end verification.
- Gate removal of local approval simulation on the server approval endpoint and
  its tests being available.
- Keep patient-portal, registration, report-ingestion, and RAG-platform work
  in separate changes so this change can roll out independently.

### Alternatives considered

- **Absorb the entire uploaded feature map:** Rejected because it would make
  this doctor-portal migration responsible for patient workflows and platform
  phases that have different dependencies, acceptance criteria, and rollout
  boundaries.
- **Keep all doctor reads local until every backend phase is complete:**
  Rejected because it preserves the current failure mode in which a configured
  backend can appear successful while the UI is showing demo state.
- **Expose worker topology directly to the doctor UI:** Rejected because the
  five-stage projection gives clinicians a stable contract while allowing
  independent jobs and worker implementations to evolve.

## Risks / Trade-offs

- [Risk] Dashboard aggregates may be expensive across many patients.
  -> Mitigate with workspace/assignment indexes, bounded activity windows, and
  precomputed or database-side aggregates.
- [Risk] A partial approval failure could leave a prescription updated but no
  downstream job or audit event.
  -> Mitigate with a database transaction/RPC or an outbox-backed transaction,
  plus retry-safe idempotency keys and failure tests.
- [Risk] Pipeline records can grow without bound.
  -> Retain recent logs in the API response, archive older entries, and keep
  full audit data in the existing audit boundary. Keep the projection
  patient-scoped and indexed by patient, run, stage, and timestamp.
- [Risk] Independent jobs can update stages out of order.
  -> Use job attempt/version checks and monotonic stage transition rules so a
  late retry cannot overwrite a newer terminal result.
- [Risk] RAG contract timing may block AI approval integration.
  -> Keep the approval API payload versioned and accept only the validated
  advisory shape produced by `add-rag-ai-assistant`.

## Migration Plan

1. Add pipeline projection migrations/contracts and backend tests without
   changing demo behavior.
2. Implement event-driven job linkage and worker stage projection updates,
   then expose the authorized pipeline read endpoint.
3. Implement authorized doctor patient reads, dashboard, settings, and
   approval endpoints with audit, correlation, and idempotency coverage.
4. Add typed frontend client methods and switch each doctor view behind the
   existing backend-mode boundary.
5. Seed patient-aware demo snapshots and run integration verification in
   backend mode.
6. Roll back by disabling the backend-mode feature path and retaining additive
   schema/API changes; do not delete audit or prescription records.

Patient-portal workflows, registration/activation, report ingestion, and RAG
retrieval remain separate follow-on changes rather than rollout prerequisites.
