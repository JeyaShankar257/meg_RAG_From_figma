# Spec Delta

# Spec Delta

## Purpose

This capability makes the doctor portal a reliable, server-authoritative
workspace for reviewing authorized patients, approving advisory medication
suggestions, monitoring care-team processing, and managing doctor preferences.
It adopts the uploaded feature map's doctor-facing contracts without defining
patient-portal, registration, report-ingestion, or RAG-platform behavior.

## ADDED Requirements

### Requirement: Doctor dashboard and patient reads are authorized and backend-derived

The system SHALL provide authenticated-doctor dashboard data including
assignment-scoped patient counts, adherence aggregates, open escalation counts,
reminder delivery metrics, and bounded recent clinical activity. Patient
workspace reads used by this capability SHALL enforce workspace and active
assignment or care-team authorization. Responses SHALL include freshness and
identify unavailable metrics instead of substituting hardcoded values.

#### Scenario: Doctor loads dashboard successfully

- **WHEN** an authenticated doctor requests dashboard data
- **THEN** the system returns only workspace- and assignment-authorized
  patients, aggregates, escalations, and activity with freshness metadata

#### Scenario: Doctor requests an unauthorized patient

- **WHEN** a doctor requests a patient or patient-workspace resource outside
  the doctor's authorized scope
- **THEN** the system rejects the request without revealing whether the
  patient exists

#### Scenario: Dashboard dependency is unavailable

- **WHEN** one or more dashboard data sources cannot be read
- **THEN** the system returns a recoverable error with a correlation ID and the
  UI preserves a visible retry or unavailable state without presenting stale
  demo metrics

### Requirement: AI prescription approval is a server-authoritative transaction

The system SHALL allow an assigned doctor to submit a validated advisory
medication suggestion and edited values for explicit approval. Approval MUST
persist the exact reviewed values and immutable revision history, preserve
evidence references, enqueue downstream dose-schedule and reminder work
idempotently, and record an immutable audit event before reporting success. A
suggestion MUST NOT become active from browser-local state alone.

#### Scenario: Doctor approves an AI suggestion

- **WHEN** an assigned doctor submits a valid suggestion with optional edits
- **THEN** the system persists the approved prescription, records the doctor
  and approval time, preserves the origin/revision snapshot, queues downstream
  work, writes an audit event, and returns the canonical prescription

#### Scenario: Approval request is unauthorized or invalid

- **WHEN** a doctor is not assigned to the patient or the suggestion fails
  validation
- **THEN** the system rejects the request without activating a prescription,
  queueing downstream work, or reporting a successful approval

#### Scenario: Approval is retried with the same idempotency key

- **WHEN** the same approval request is submitted again with its original
  idempotency key
- **THEN** the system returns the original outcome without duplicate
  prescriptions, jobs, revisions, or audit events

### Requirement: Care-team pipeline state is durable and observable

The system SHALL expose an authorized patient pipeline run with five
doctor-facing stages: Reminder Agent, Dose Logging Agent, Pattern Detection
Agent, Escalation Agent, and Care Team Interaction Agent. Each stage SHALL
include status, attempt, last run, error state, and bounded logs with
correlation identifiers and safe diagnostics. Internal jobs MAY execute
independently in response to domain events, but their outcomes MUST update the
corresponding patient pipeline projection. Backend mode MUST derive
transitions from persisted job state rather than browser timers or
`sessionStorage`.

#### Scenario: Doctor views pipeline state

- **WHEN** an assigned doctor requests a patient's care-team view
- **THEN** the system returns the patient's authorized escalations, care-team
  members, one patient pipeline run, its five stages, and bounded recent logs

#### Scenario: Pipeline job changes state

- **WHEN** an event-driven job starts, completes, retries, or reaches terminal
  failure
- **THEN** the persisted job state and its mapped patient stage projection are
  updated with the attempt, timestamps, safe error state, and log entry, and
  subsequent doctor reads reflect the transition

#### Scenario: Independent jobs update the visible pipeline

- **WHEN** dose logging, adherence analysis, escalation, or care-team work is
  triggered by its domain event
- **THEN** the corresponding visible stage is updated without requiring an
  unrelated stage to run first, while the patient pipeline view remains
  consistent

#### Scenario: Pipeline run is created from a clinical trigger

- **WHEN** a server-authorized clinical trigger such as prescription approval
  starts a workflow
- **THEN** the system creates a patient-scoped pipeline run with the five
  visible stage projections, links resulting jobs to the run and stages, and
  preserves the originating correlation ID

#### Scenario: Retry and dead-letter are projected safely

- **WHEN** an event-driven job is retried or moved to a dead-letter state
- **THEN** the mapped stage shows retrying or error state with bounded safe
  diagnostics, and stale updates cannot overwrite a newer terminal result or
  report a duplicate clinical mutation

#### Scenario: Doctor cannot access another patient's pipeline

- **WHEN** a doctor requests pipeline state for an unassigned patient
- **THEN** the system rejects the request and does not disclose stage or log
  details

#### Scenario: Demo mode uses patient-aware mock projections

- **WHEN** the app runs in development without backend configuration
- **THEN** it may use patient-specific mock pipeline snapshots and local
  transitions for review, but those snapshots and transitions are never sent
  as production backend state

### Requirement: Doctor identity and preferences are persisted

The system SHALL display the authenticated doctor's profile identity and
workspace context, and SHALL persist supported profile, time-zone, channel,
quiet-hour, and notification preferences through validated authenticated
endpoints.

#### Scenario: Doctor opens the portal

- **WHEN** the session contains an authenticated doctor
- **THEN** the shell displays the session identity and workspace context rather
  than a hardcoded doctor profile

#### Scenario: Doctor saves valid settings

- **WHEN** a doctor submits valid profile or notification preferences
- **THEN** the system validates and persists them, and later reads return the
  saved values

#### Scenario: Settings validation fails

- **WHEN** submitted settings contain unsupported channels, invalid times, or
  malformed profile values
- **THEN** the system rejects the update, preserves the prior values, and
  returns field-level recoverable errors

### Requirement: Backend failures are visible and demo fallback is bounded

The doctor portal SHALL expose loading, empty, error, unavailable, and retry
states for backend-backed clinical views. Mock data and local simulation MAY
be used only in development when backend mode is not configured, and MUST NOT
mask a configured backend failure.

#### Scenario: Sidebar patient load fails

- **WHEN** the doctor shell cannot load assigned patients or escalations
- **THEN** it shows a recoverable error and retry action instead of silently
  rendering an empty sidebar or zero escalation badge

#### Scenario: Development demo mode is active

- **WHEN** the app is running in development without backend configuration
- **THEN** existing mock patients and local presentation simulation remain
  available without being sent as production API data
