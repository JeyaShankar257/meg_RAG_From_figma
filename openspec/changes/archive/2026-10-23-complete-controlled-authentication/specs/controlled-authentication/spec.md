# Spec Delta

## Purpose

Provides a controlled, invitation-based identity lifecycle for administrators,
doctors, and patients so only verified, correctly provisioned, and authorized
accounts can enter MedNova portals.

## ADDED Requirements

### Requirement: Application identity must match Supabase identity
The system SHALL require every live account to have a Supabase Auth user and a
matching application profile with the same user identifier and workspace
membership before granting portal access.

#### Scenario: Auth user has no profile
- **WHEN** a valid Supabase password login resolves to an Auth user without a matching application profile
- **THEN** the system rejects login with a non-sensitive account-profile error and creates no application session

#### Scenario: Profile belongs to another workspace
- **WHEN** an authenticated request targets data outside the user's workspace
- **THEN** the system denies the request regardless of the user's portal role

### Requirement: Administrators control doctor provisioning
The system SHALL allow only an administrator to invite, approve, reject, or provision a doctor within the administrator's workspace.

#### Scenario: Administrator invites a doctor
- **WHEN** an authenticated administrator submits a valid doctor email, name, and workspace
- **THEN** the system creates a pending doctor identity and sends an invitation to the configured doctor activation URL

#### Scenario: Non-administrator attempts doctor provisioning
- **WHEN** a doctor, care-team member, patient, or unauthenticated caller requests a doctor provisioning operation
- **THEN** the system rejects the operation with a 403 response, audits the denial, and does not create or modify the doctor identity

#### Scenario: Administrator attempts cross-workspace invitation
- **WHEN** an administrator attempts to invite a doctor into a workspace other than their own
- **THEN** the system rejects the request with a 403 Forbidden error and emits an audit event

### Requirement: Doctor approval is required before login
The system SHALL require a doctor profile to have approved status and a verified email before allowing doctor portal login.

#### Scenario: Pending doctor attempts login
- **WHEN** a doctor with pending approval submits valid credentials
- **THEN** the system rejects login and does not issue a usable application session

#### Scenario: Approved and verified doctor logs in
- **WHEN** an approved doctor submits valid credentials with a verified email through the doctor portal
- **THEN** the system issues an access session containing the doctor role and workspace context

### Requirement: Temporary doctor passwords must be changed
The system SHALL support an administrator-set temporary doctor password that forces a password change before the doctor can use clinical portal features.

#### Scenario: Doctor signs in with temporary password
- **WHEN** an approved doctor logs in while the profile requires a password change
- **THEN** the system issues a restricted session and routes the doctor to the password-change flow

#### Scenario: Doctor completes password change
- **WHEN** the doctor submits a valid replacement password that matches confirmation
- **THEN** the system updates the Auth password, clears the password-change requirement, and permits normal doctor portal access

### Requirement: Patients are invitation-only
The system SHALL allow an authorized doctor or administrator to register a patient without collecting a patient password and SHALL require the patient to create a password from a single-use invitation.

#### Scenario: Doctor registers a patient
- **WHEN** an authorized clinician submits valid patient details and an email not already associated with an account
- **THEN** the system creates a pending patient record, sends an invitation, and links the eventual Auth identity to the patient profile

#### Scenario: Patient activates an invitation
- **WHEN** a patient opens a valid invitation at the patient activation URL and submits a valid password
- **THEN** the system updates the Auth password, completes email verification, transitions the patient clinical record from pending to active, clears the URL token fragment, and makes the patient eligible for patient portal login

### Requirement: Invitation failures must be safe and actionable
The system SHALL map duplicate-account, expired-token, email-rate-limit, invalid-redirect, and provider-authorization failures to actionable responses without exposing secrets or leaving silently orphaned identities.

#### Scenario: Invitation email rate limit is exceeded
- **WHEN** Supabase rejects an invitation because the provider email limit is exceeded
- **THEN** the API returns a rate-limited response (429) explaining that the caller must wait and does not claim that an invitation was sent

#### Scenario: Profile provisioning fails after Auth invitation
- **WHEN** an Auth invitation succeeds but the application profile cannot be provisioned
- **THEN** the system performs compensating cleanup by removing the incomplete Auth identity and rolling back clinical records, and returns an explicit provisioning error

### Requirement: Sessions and portal access are role constrained
The system SHALL validate bearer sessions server-side, refresh expired sessions through the configured refresh token, and reject users from portals that do not match their application role.

#### Scenario: Patient uses doctor portal
- **WHEN** a patient presents valid credentials to the doctor login route
- **THEN** the system rejects the login without revealing account details

#### Scenario: Expired session is refreshed
- **WHEN** the frontend has a refresh token and the access token is expired
- **THEN** the system obtains a replacement session or clears the local session when refresh fails
