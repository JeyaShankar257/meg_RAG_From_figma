# Spec Delta

## Purpose

Makes the patient portal an authenticated, server-authoritative clinical interface for reviewing daily dose schedules, recording idempotent dose events with UUIDs, viewing live server-calculated adherence metrics, accessing clinical visit summaries, managing sharing consent, and updating notification preferences.

## ADDED Requirements

### Requirement: Patient dashboard reads and adherence metrics are authenticated and backend-derived

The system SHALL provide authenticated patient dashboard data including active prescription summaries, next scheduled dose timestamps, server-computed adherence percentages (taken, late, missed, skipped), current adherence streak count, and trend indicators via `GET /patients/:id/adherence`. Patient dashboard reads SHALL enforce strict patient session authorization so that an account with `role: 'patient'` may only access its own clinical record where `user.patientId === :id` and `user.patientStatus === 'active'`. The response SHALL include freshness metadata and identify unavailable metrics rather than substituting hardcoded demo values.

#### Scenario: Patient loads dashboard successfully
- **WHEN** an authenticated active patient requests dashboard data
- **THEN** the system returns that patient's active prescriptions, next scheduled dose, server-calculated adherence metrics (`takenPercentage`, `latePercentage`, `missedCount`), streak count (`currentStreakDays`), and freshness metadata

#### Scenario: Unauthorized user requests patient dashboard
- **WHEN** a user without a valid patient session or an account requesting another patient's identifier requests dashboard data
- **THEN** the system rejects the request with a 403 or 404 authorization error without disclosing patient record details

#### Scenario: Dashboard dependency is unavailable
- **WHEN** an underlying clinical data store or adherence aggregate service is temporarily unavailable
- **THEN** the system returns a recoverable error with a correlation ID, and the frontend presents an explicit unavailable/retry state without displaying stale demo statistics

### Requirement: Daily dose schedule resolution and dose event logging are server-authoritative and idempotent

The system SHALL provide an authoritative daily dose schedule endpoint (`GET /patients/:id/dose-schedules?date=YYYY-MM-DD`) that resolves active prescriptions and schedule slots into concrete dose entries for the patient with UUID schedule identifiers, medication names, dosage, scheduled times, and current window status (`scheduled`, `taken`, `missed`, `late`). The system SHALL accept dose logging mutations via `POST /doses` (`scheduleId: UUID`, `status: "taken" | "skipped"`, optional `notes`, and required client-generated `idempotencyKey`) and record each event with an authoritative server timestamp, schedule reference, and immutable audit entry. The system SHALL enforce idempotency using client-supplied request keys so that network retries do not record duplicate dose events or corrupt adherence aggregates.

#### Scenario: Patient loads daily dose schedule
- **WHEN** an authenticated patient opens the Dose Center
- **THEN** the system returns authoritative scheduled dose entries for the target date (`GET /patients/:id/dose-schedules?date=YYYY-MM-DD`) with valid UUID identifiers and current status (`scheduled`, `taken`, `missed`, `late`)

#### Scenario: Patient records a taken dose
- **WHEN** an authenticated patient marks a scheduled dose as taken with a unique `idempotencyKey`
- **THEN** the system persists the dose event, updates the dose schedule item status, logs an audit record, and returns the updated dose status with server timestamp

#### Scenario: Patient records a skipped dose with reason
- **WHEN** an authenticated patient marks a scheduled dose as skipped with a clinical or personal reason
- **THEN** the system records the skipped dose event, persists the reason in notes, updates the schedule status, and records an audit entry

#### Scenario: Dose submission is retried with the same idempotency key
- **WHEN** a dose logging request is submitted again with the same `idempotencyKey`
- **THEN** the system returns the canonical original result without creating duplicate dose events or skewing adherence totals

#### Scenario: Non-patient or unassigned account attempts dose logging
- **WHEN** an unauthenticated caller or account other than the authorized patient attempts to log a dose
- **THEN** the system rejects the mutation with 403 Forbidden and leaves the dose schedule unchanged

### Requirement: Patient visit history and clinical notes are role-gated and consent-filtered

The system SHALL provide an authorized read-only visit history for the authenticated patient via `GET /patients/:id/visits`. Visit summaries, provider attributions, diagnoses, and notes SHALL be filtered by current patient consent grants and privacy policies before delivery to the client.

#### Scenario: Patient views visit history
- **WHEN** an authenticated patient views their clinical visits page
- **THEN** the system returns the chronological list of visits associated with that patient including date, provider name, condition, symptoms, and consent-cleared clinical notes

#### Scenario: Unshared or restricted notes are omitted
- **WHEN** a visit contains clinical notes or attachments marked as restricted or excluded by the active consent policy
- **THEN** the system returns the visit summary while redacting or omitting the restricted note details

#### Scenario: Cross-patient visit access is rejected
- **WHEN** an authenticated patient requests visit records belonging to another patient ID
- **THEN** the system rejects the request without disclosing whether the targeted visit records exist

### Requirement: Granular consent and transparency metrics are persistent and verifiable

The system SHALL allow the authenticated patient to view and update granular consent grants, including sharing with the multidisciplinary care team, participation in automated escalation alerts, and participation in advisory AI analysis. Changes to consent grants SHALL take effect immediately and append an immutable audit record. The system SHALL provide verifiable transparency signals via `GET /patients/:id/transparency` including active consent records, system model governance assurance, and recent data access audit events.

#### Scenario: Patient updates consent settings
- **WHEN** an authenticated patient modifies one or more consent toggles (`POST /patients/:id/consent`)
- **THEN** the system validates and persists the consent record, records an audit event with before-and-after states, and returns the updated consent policy

#### Scenario: Patient views trust and transparency data
- **WHEN** an authenticated patient navigates to the Transparency page
- **THEN** the system loads the current persistent consent status, audit summary of recent data accesses, and system assurance metrics from `GET /patients/:id/transparency`

#### Scenario: Consent update encounters an error
- **WHEN** a consent update request fails validation or database persistence
- **THEN** the system preserves the previously established consent policy and returns a descriptive, recoverable error

### Requirement: Patient notification preferences and quiet hours are validated and persisted

The system SHALL persist patient notification channel preferences (email, sms, push), reminder enablement, and quiet-hour windows through validated authenticated endpoints (`PUT /patients/:id/settings`).

#### Scenario: Patient saves valid notification preferences
- **WHEN** an authenticated patient submits valid notification preferences including channel choice and quiet-hour start/end times
- **THEN** the system validates the time formats and channel types, persists the settings, and returns the updated configuration

#### Scenario: Notification preferences fail validation
- **WHEN** submitted preferences contain invalid channel names or malformed quiet-hour time ranges
- **THEN** the system rejects the update, preserves the prior settings, and returns field-level error details

### Requirement: Patient portal exposes resilient states and bounded demo fallback

The patient portal SHALL provide explicit loading, empty, error, and retry states across all views (Dashboard, Dose Center, Visits, Transparency, Settings). Development demo mode MAY use bounded mock data when backend services are unconfigured, but MUST NOT mask backend errors when backend connectivity is configured. The shell SHALL display real authenticated user initials and names rather than static demo badges when running against live services.

#### Scenario: Dose Center handles network failure gracefully
- **WHEN** the dose schedule endpoint cannot be reached in backend-configured mode
- **THEN** the UI presents a recoverable error message with a retry button instead of falling back to demo data

#### Scenario: Unconfigured development demo mode remains functional
- **WHEN** the application runs in development without backend environment configuration
- **THEN** the patient portal uses local mock data and local dose interactions for development demo purposes without issuing production API requests
