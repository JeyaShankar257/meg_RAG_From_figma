# Proposal

# Proposal

## Why

The doctor portal currently mixes authorized backend data with demo-derived
statistics, care-team pipeline state, identity display, and AI approval state.
This can make production UI appear successful when a clinical action was only
updated locally, and it hides backend failures behind empty or stale views.
The change is needed now to make the doctor workflow server-authoritative while
preserving the development-only demo fallback and the advisory-only AI safety
boundary. It depends on `add-rag-ai-assistant` for the production AI analysis
and evidence contract.

The uploaded feature map is the broader product roadmap. This change adopts
its doctor-facing contracts and safety rules, but does not absorb the separate
patient-portal, registration/activation, report-ingestion, or RAG-platform
phases.

## What Changes

- Persist AI-generated prescription suggestions through the authenticated
  doctor approval transaction, including edited medication values, immutable
  revision history, downstream schedule/reminder work, audit events, and
  recoverable failure states.
- Replace hardcoded doctor dashboard statistics and activity presentation with
  authorized, assignment-scoped backend aggregates, freshness metadata, and
  explicit loading, empty, unavailable, error, and retry states.
- Keep doctor patient workspace reads assignment-authorized and typed where
  they are required by the dashboard, patient detail, approval, and care-team
  flows; do not implement the broader patient portal read/write roadmap here.
- Add durable care-team pipeline status and bounded log retrieval for a
  patient, removing backend-mode reliance on timers or `sessionStorage` for
  pipeline transitions. Workers process event-driven jobs while the doctor
  view exposes a five-stage patient pipeline projection.
- Model the five visible stages as a projection over independent jobs:
  Reminder Agent, Dose Logging Agent, Pattern Detection Agent, Escalation
  Agent, and Care Team Interaction Agent.
- Use authenticated doctor profile/workspace data in the doctor shell and
  expose recoverable sidebar and escalation-loading errors.
- Complete doctor preference persistence for profile and notification
  settings, with server validation and clear save/error feedback.
- Keep demo-mode mock data and local simulation available only when the
  backend is not configured in development, and never use it to mask a
  configured backend failure.

## Capabilities

### New Capabilities

- `doctor-portal-backend-workflows`: Server-authoritative doctor dashboard,
  authorized patient workspace reads used by this change, prescription
  approval, care-team pipeline, identity, and settings workflows.

### Modified Capabilities

None.

## Impact

- **Frontend:** `DoctorShell`, doctor dashboard, patient detail/AI approval,
  care-team page, doctor settings, shared API client, and related types.
- **Backend:** Doctor-scoped dashboard and patient reads, prescription
  approval payloads, care-team pipeline/log endpoints, profile/preferences
  endpoints, validation, authorization, audit, idempotency, and
  correlation-aware error responses.
- **Data:** New or extended tables/views/jobs for dashboard aggregates,
  pipeline runs/stages/logs, prescription suggestion revisions, job linkage,
  and notification preferences; migrations and doctor-focused demo seed
  updates as required.
- **Security:** All patient and workspace reads remain
  assignment/care-team authorization-checked; prescription activation remains
  a server-side doctor transaction; AI output remains advisory until explicit
  approval; audit events cover clinical mutations; logs exclude secrets and
  unnecessary patient data.
- **Compatibility:** Existing demo fallback behavior remains intact and
  backend API changes should be additive or version-compatible with the
  current frontend client and the `add-rag-ai-assistant` contracts.

Out of scope for this change are patient login and portal workflows, patient
registration and activation, patient uploads and report indexing, the RAG
retrieval/model workflow itself, and the broader implementation phases in the
uploaded feature map. Those should be planned as separate changes.
