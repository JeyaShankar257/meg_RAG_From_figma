# backend-runtime-foundation Specification

## Purpose

This capability provides a runnable, observable, and contract-safe foundation
for MedNova's API, worker, and advisory Python agent services before clinical
authorization and production RAG workflows are enabled.

## Requirements

### Requirement: Backend services expose safe lifecycle status

The backend services SHALL expose non-sensitive liveness and readiness status
that distinguishes process availability from dependency availability.

#### Scenario: Service is alive but a dependency is unavailable

- **WHEN** a service process is running but a required dependency for its
  configured mode is unavailable
- **THEN** liveness remains available, readiness reports unavailable, and the
  response does not expose secret values or connection details

#### Scenario: Service reports healthy status

- **WHEN** the service process and required configured dependencies are
  available
- **THEN** liveness and readiness report healthy status with a stable service
  identity and timestamp

### Requirement: Internal agent contracts fail closed on incompatibility

The agent boundary SHALL validate versioned job and result payloads and SHALL
reject unsupported contract versions or malformed required fields without
executing an agent workflow.

#### Scenario: Supported contract is dispatched

- **WHEN** an authenticated internal caller submits a valid supported-version
  job
- **THEN** the agent boundary accepts the job for workflow processing and
  preserves its job ID, workspace scope, patient scope, and correlation ID

#### Scenario: Unsupported contract is dispatched

- **WHEN** an internal caller submits a job with an unsupported contract
  version
- **THEN** the service returns a compatibility error and does not invoke a
  model provider or mutate clinical records

### Requirement: Advisory agent workflow is explicit and schema validated

The Python agent service SHALL execute advisory workflow states explicitly and
SHALL return a validated structured result classified as completed,
needs-review, retryable failure, or terminal failure.

#### Scenario: Deterministic provider returns valid output

- **WHEN** a valid job reaches the provider boundary and the provider returns
  schema-conforming output
- **THEN** the service returns a structured advisory result with model/prompt
  version fields, safety flags, and doctor-review status

#### Scenario: Provider or output validation fails

- **WHEN** the provider times out, returns malformed output, or violates the
  response schema
- **THEN** the service returns a safe retryable, terminal, or needs-review
  result according to the failure classification and does not activate a
  prescription

### Requirement: Framework execution cannot bypass clinical security boundaries

The agent workflow SHALL treat supplied patient context and retrieved text as
authorized input from the server boundary and SHALL NOT perform authentication,
RLS decisions, direct clinical mutations, prescription approval, or audit
record replacement.

#### Scenario: Untrusted evidence contains instructions

- **WHEN** supplied evidence includes text that attempts to alter workflow
  policy or request privileged actions
- **THEN** the workflow treats it as untrusted content, preserves the safety
  instructions, and returns only schema-validated advisory output

#### Scenario: Agent produces a medication suggestion

- **WHEN** the workflow returns a medication suggestion
- **THEN** the suggestion remains advisory and no prescription becomes active
  without the existing authenticated doctor approval transaction

### Requirement: Operational telemetry is correlation-aware and secret-safe

The API and internal service boundary SHALL propagate bounded correlation IDs
and SHALL prevent reserved log fields and secret-like metadata from leaking
into operational output.

#### Scenario: Request has a valid correlation ID

- **WHEN** an API request includes a valid bounded correlation ID
- **THEN** the service reuses it in response headers and related operational
  logs

#### Scenario: Request has an invalid or absent correlation ID

- **WHEN** a request has no correlation ID or provides an invalid or unbounded
  one
- **THEN** the service generates a new correlation ID and uses that ID for the
  request lifecycle

#### Scenario: Log metadata contains protected fields

- **WHEN** a caller supplies metadata containing secret-like keys or values for
  reserved fields such as level, message, or timestamp
- **THEN** the logger omits protected metadata and preserves the canonical
  structured log fields
