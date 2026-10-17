# Spec Delta

## MODIFIED Requirements

### Requirement: Role-gated authenticated access

The system SHALL authenticate only verified Supabase accounts with matching
application profiles, SHALL enforce administrator approval for doctors, SHALL
enforce invitation activation for patients, and SHALL authorize every
protected operation according to the account role, workspace membership,
patient assignment, caregiver grant, and current consent state. A doctor login
route MUST reject patient-only accounts and a patient login route MUST reject
clinician-only accounts.

#### Scenario: Doctor signs in through the doctor route

- **WHEN** a valid, verified, approved doctor account submits credentials to the doctor login flow
- **THEN** the system creates an authenticated session and grants access only to clinician-authorized portal resources

#### Scenario: Account uses the wrong portal

- **WHEN** an account submits valid credentials through a portal route that does not match its authorized role
- **THEN** the system rejects the login without exposing unrelated account or patient existence details

#### Scenario: Unauthenticated request reaches a protected resource

- **WHEN** a request without a valid session requests private clinical data or performs a private mutation
- **THEN** the system rejects the request and the frontend presents an unauthorized or sign-in state

#### Scenario: Unverified account attempts protected access

- **WHEN** an Auth account has not completed email verification
- **THEN** the system rejects login and does not expose protected clinical data

#### Scenario: Doctor with a temporary password signs in

- **WHEN** an approved doctor logs in while the profile requires a password change
- **THEN** the system issues only a restricted session and routes the doctor to the password-change flow

### Requirement: Persistent clinical records with server-side access control

The system SHALL persist patient profiles, system-generated patient identifiers,
care-team relationships, consent grants, visits, conditions, medications,
prescriptions, dose schedules, dose logs, adherence summaries, escalations,
reports, and notification preferences. Every read and write SHALL be checked
server-side and SHALL prevent access to unassigned, revoked, unverified,
pending, or wrong-workspace patient records.

#### Scenario: Doctor creates a patient

- **WHEN** an authorized doctor submits valid demographic, contact, assignment, and consent data
- **THEN** the system creates a pending patient with a unique system-generated patient identifier and queues account activation without allowing the client to choose that identifier

#### Scenario: Patient reads their care data

- **WHEN** an authenticated active patient requests dashboard, visit, medication, adherence, or consent data
- **THEN** the system returns only records belonging to that patient and filtered by current sharing policy

#### Scenario: Clinician requests an unassigned patient

- **WHEN** an authenticated clinician requests a patient record outside their permitted workspace or assignment
- **THEN** the system denies the request without revealing whether the record exists

#### Scenario: Patient completes activation

- **WHEN** an invited patient successfully sets a password and verifies the email
- **THEN** the linked patient record transitions from pending to active according to the account activation policy

#### Scenario: Incomplete invitation is retried

- **WHEN** profile provisioning fails after an invitation attempt
- **THEN** the system exposes an actionable failure and does not leave an untracked clinical patient identity

### Requirement: Consent, correction, and audit visibility

The system SHALL persist patient consent and communication preferences, enforce
required-versus-optional sharing rules, support correction or review requests
for dose, adherence, report, and AI records, and append immutable audit events
for authentication, private access, clinical mutations, AI activity, sharing
changes, exports, invitations, approval decisions, activation, password
changes, denied authorization, cleanup, and administrative changes.

#### Scenario: Patient changes optional consent

- **WHEN** an authenticated patient changes an optional sharing or communication preference
- **THEN** the system persists the new preference, applies it to subsequent access and notifications, and records who changed it and when

#### Scenario: Patient requests a correction

- **WHEN** an authenticated patient submits a correction request for an eligible record
- **THEN** the system creates a reviewable request without overwriting the original event or audit history

#### Scenario: Auditor reviews an event

- **WHEN** an authorized administrator or auditor requests audit history for a permitted scope
- **THEN** the system returns append-only events with actor, action, target, timestamp, correlation identifier, and relevant outcome without exposing credentials or tokens

#### Scenario: Administrator approves a doctor

- **WHEN** an administrator changes a doctor from pending to approved
- **THEN** the system records the actor, target, workspace, timestamp, and outcome in an immutable audit event

#### Scenario: Unauthorized provisioning is denied

- **WHEN** a non-administrator attempts to invite or approve a doctor
- **THEN** the operation is rejected and the denied administrative action is auditable without exposing credentials
