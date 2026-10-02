# Spec Delta

## Purpose

Provides the authenticated, persistent clinical backend required by the doctor and patient portals to share protected care data, record adherence activity, review AI output, and operate auditable care workflows.

## ADDED Requirements

### Requirement: Role-gated authenticated access

The system SHALL authenticate accounts and SHALL authorize every protected operation according to the account role, workspace membership, patient assignment, caregiver grant, and current consent state. A doctor login route MUST reject patient-only accounts and a patient login route MUST reject clinician-only accounts.

#### Scenario: Doctor signs in through the doctor route

- **WHEN** a valid doctor account submits credentials to the doctor login flow
- **THEN** the system creates an authenticated session and grants access only to clinician-authorized portal resources

#### Scenario: Account uses the wrong portal

- **WHEN** an account submits valid credentials through a portal route that does not match its authorized role
- **THEN** the system rejects the login without exposing unrelated account or patient existence details

#### Scenario: Unauthenticated request reaches a protected resource

- **WHEN** a request without a valid session requests private clinical data or performs a private mutation
- **THEN** the system rejects the request and the frontend presents an unauthorized or sign-in state

### Requirement: Persistent clinical records with server-side access control

The system SHALL persist patient profiles, system-generated patient identifiers, care-team relationships, consent grants, visits, conditions, medications, prescriptions, dose schedules, dose logs, adherence summaries, escalations, reports, and notification preferences. Every read and write SHALL be checked server-side and SHALL prevent access to unassigned or revoked patient records.

#### Scenario: Doctor creates a patient

- **WHEN** an authorized doctor submits valid demographic, contact, assignment, and consent data
- **THEN** the system creates a pending patient with a unique system-generated patient identifier and queues account activation without allowing the client to choose that identifier

#### Scenario: Patient reads their care data

- **WHEN** an authenticated patient requests dashboard, visit, medication, adherence, or consent data
- **THEN** the system returns only records belonging to that patient and filtered by current sharing policy

#### Scenario: Clinician requests an unassigned patient

- **WHEN** an authenticated clinician requests a patient record outside their permitted workspace or assignment
- **THEN** the system denies the request without revealing whether the record exists

### Requirement: Reliable dose and prescription workflows

The system SHALL record dose events with a server timestamp, medication schedule reference, status, optional method, and optional reason, and SHALL prevent duplicate submissions for the same schedule event. Prescription approval SHALL require an authenticated doctor confirmation and SHALL preserve the reviewed values and revision history.

#### Scenario: Patient logs a dose

- **WHEN** an authenticated patient submits a valid pending dose event
- **THEN** the system records one dose event with an authoritative timestamp and returns the updated dose status

#### Scenario: Patient repeats a dose submission

- **WHEN** the same patient retries the same dose event with the same idempotency key or schedule identity
- **THEN** the system returns the existing result without creating a duplicate dose event

#### Scenario: Doctor approves an AI suggestion

- **WHEN** an authenticated doctor confirms an edited AI prescription proposal
- **THEN** the system atomically records the approved prescription, revision history, doctor identity, approval time, audit event, and downstream work request

#### Scenario: Non-doctor attempts prescription approval

- **WHEN** a patient or unauthorized care-team member submits a prescription approval request
- **THEN** the system rejects the mutation and leaves the clinical record unchanged

### Requirement: Private medical report handling

The system SHALL accept validated patient report metadata and approved file types through an authenticated upload flow, store report objects privately, and expose access only through short-lived authorized links. Report review state SHALL be persisted and visible according to patient and care-team permissions.

#### Scenario: Patient uploads a valid report

- **WHEN** an authenticated patient submits a supported report within the configured size limit
- **THEN** the system stores the file privately, persists metadata linked to the patient, marks it shared according to consent, and returns a report record without embedding file contents in application state

#### Scenario: Unauthorized user requests a report

- **WHEN** a user without patient ownership or care-team permission requests a report object
- **THEN** the system denies access and does not issue a file link

#### Scenario: Clinician marks a report reviewed

- **WHEN** an authorized care-team member marks a patient report reviewed
- **THEN** the system records the reviewer and review time and makes the updated state visible to permitted users

### Requirement: Auditable AI and asynchronous care workflows

The system SHALL process reminders, delivery outcomes, adherence aggregation, AI analyses, escalations, notifications, and periodic reports as durable work with retry-safe status transitions. Every AI analysis and escalation decision SHALL preserve its input snapshot, structured output, confidence, explanation, citations, model/configuration version, creator, and review state. AI output SHALL remain advisory until an authorized doctor completes the applicable review action.

#### Scenario: Approved prescription queues downstream work

- **WHEN** a doctor-approved prescription is committed
- **THEN** the system creates retry-safe work for schedule generation and reminder delivery and reports queued or confirmed states without claiming delivery before a provider confirms it

#### Scenario: AI analysis completes

- **WHEN** an authorized doctor submits symptoms and permitted patient context for analysis
- **THEN** the system creates an analysis record with pending/running/completed or error status and preserves the exact result and provenance needed for later review

#### Scenario: AI identifies an escalation

- **WHEN** an analysis produces an escalation result under the configured workflow
- **THEN** the system creates an auditable escalation with severity, confidence, reasoning, model version, patient scope, and notification status

#### Scenario: Background work is retried

- **WHEN** a reminder, notification, or analysis job fails transiently
- **THEN** the system retries it without duplicating the clinical event and exposes a recoverable failure state to authorized operators

### Requirement: Consent, correction, and audit visibility

The system SHALL persist patient consent and communication preferences, enforce required-versus-optional sharing rules, support correction or review requests for dose, adherence, report, and AI records, and append immutable audit events for authentication, private access, clinical mutations, AI activity, sharing changes, exports, and administrative changes.

#### Scenario: Patient changes optional consent

- **WHEN** an authenticated patient changes an optional sharing or communication preference
- **THEN** the system persists the new preference, applies it to subsequent access and notifications, and records who changed it and when

#### Scenario: Patient requests a correction

- **WHEN** an authenticated patient submits a correction request for an eligible record
- **THEN** the system creates a reviewable request without overwriting the original event or audit history

#### Scenario: Auditor reviews an event

- **WHEN** an authorized administrator or auditor requests audit history for a permitted scope
- **THEN** the system returns append-only events with actor, action, target, timestamp, correlation identifier, and relevant outcome without exposing secrets
