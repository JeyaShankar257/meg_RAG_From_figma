# doctor-portal-backend-workflows Delta Spec

## MODIFIED Requirements

### Requirement: Care-team pipeline state is durable and observable

The system SHALL expose an authorized patient pipeline run with four doctor-facing stages: Dose Reminder Agent, Pattern Detection Agent, Patient Health Warning Agent, and Doctor & Guardian SOS Agent. Each stage SHALL include status, attempt, last run, error state, and bounded logs with correlation identifiers and safe diagnostics. Internal daily evaluation jobs and event-driven triggers MUST update the corresponding patient pipeline projection. Backend mode MUST derive transitions from persisted database state rather than browser timers or `sessionStorage`.

#### Scenario: Doctor views pipeline state
- **WHEN** an assigned doctor requests a patient's care-team view
- **THEN** the system returns the patient's authorized escalations, care-team members, one patient pipeline run, its four stages, and bounded recent logs

#### Scenario: Pipeline job changes state
- **WHEN** an event-driven job starts, completes, retries, or reaches terminal failure
- **THEN** the persisted job state and its mapped patient stage projection are updated with the attempt, timestamps, safe error state, and log entry, and subsequent doctor reads reflect the transition

#### Scenario: Independent jobs update the visible pipeline
- **WHEN** dose logging, adherence analysis, escalation, or care-team work is triggered by its domain event
- **THEN** the corresponding visible stage is updated without requiring an unrelated stage to run first, while the patient pipeline view remains consistent

#### Scenario: Pipeline run is created from a clinical trigger
- **WHEN** a server-authorized clinical trigger such as prescription approval starts a workflow
- **THEN** the system creates a patient-scoped pipeline run with the four visible stage projections, links resulting jobs to the run and stages, and preserves the originating correlation ID

#### Scenario: Retry and dead-letter are projected safely
- **WHEN** an event-driven job is retried or moved to a dead-letter state
- **THEN** the mapped stage shows retrying or error state with bounded safe diagnostics, and stale updates cannot overwrite a newer terminal result or report a duplicate clinical mutation

#### Scenario: Doctor cannot access another patient's pipeline
- **WHEN** a doctor requests pipeline state for an unassigned patient
- **THEN** the system rejects the request and does not disclose stage or log details

#### Scenario: Demo mode uses patient-aware mock projections
- **WHEN** the app runs in development without backend configuration
- **THEN** it may use patient-specific mock pipeline snapshots and local transitions for review, but those snapshots and transitions are never sent as production backend state

## ADDED Requirements

### Requirement: Escalations support direct clinical actions and audit trails

The system SHALL allow an assigned doctor to respond directly to open escalations with structured clinical actions including scheduling urgent telehealth, assigning nurse line outreach, adjusting medication, or marking acknowledged with a reason. Every escalation action MUST be validated, update escalation status, and record an immutable audit event.

#### Scenario: Doctor triggers clinical response action
- **WHEN** an authorized doctor submits a clinical action (`telehealth`, `nurse_call`, `adjust_medication`, or `acknowledge`) for an active escalation
- **THEN** the system persists the response, updates escalation status, records an immutable audit trail entry, and returns the updated escalation record
