# Spec Delta: admin-portal

## Purpose
Provides a dedicated administrative portal for managing physician roster directory, doctor onboarding invitations, approvals, temporary credential lifecycle, and orphan record reconciliations isolated from clinical workflows.

## ADDED Requirements

### Requirement: Dedicated Admin Authentication & Session Gating
The system SHALL provide a dedicated administrative login route (`/admin/login`) that accepts credentials for administrators, authenticates via the API with `portal: "admin"`, verifies that the authenticated user possesses the `admin` role, and redirects unauthorized users away from `/admin/*` routes.

#### Scenario: Successful Admin Login
- **WHEN** a user with the `admin` role signs in through `/admin/login`
- **THEN** the system issues session tokens, stores the administrative session, and navigates to the admin dashboard (`/admin`).

#### Scenario: Unauthorized Access to Admin Portal
- **WHEN** an unauthenticated user or a user with a non-admin role (`doctor` or `patient`) attempts to access any route under `/admin/*`
- **THEN** the system denies access and redirects the user to `/admin/login` with an unauthorized warning.

### Requirement: Active Doctor Directory & Roster Display
The admin portal SHALL display all working and existing physician accounts in the workspace, including their full name, contact email, clinical role, approval status, and temporary credential flag.

#### Scenario: Viewing Working Doctors Roster
- **WHEN** an authenticated administrator accesses the admin dashboard
- **THEN** the system lists all active, approved doctors in the current workspace with real-time status indicators.

### Requirement: Physician Provisioning & Governance Actions
The admin portal SHALL provide interactive controls for inviting new doctors, approving or rejecting pending doctor applications, resending invitations, and provisioning temporary passwords.

#### Scenario: Inviting a New Doctor
- **WHEN** an administrator submits the doctor invitation form with full name, email, optional temporary password, and email dispatch preference
- **THEN** the system invokes `POST /auth/doctor-invitations`, creates the profile and auth user under the admin's workspace, logs an audit event, and refreshes the roster.

#### Scenario: Approving a Pending Doctor Account
- **WHEN** an administrator clicks "Approve" on a doctor account in `pending` status
- **THEN** the system invokes `POST /auth/doctor-invitations/:profileId/approve`, transitions the doctor's status to `approved`, and logs the approval audit event.

### Requirement: Workspace Orphan Reconciliation
The admin portal SHALL expose orphan reconciliation functionality that identifies unlinked patients, orphaned profiles, and dangling auth records, allowing one-click remediation.

#### Scenario: Running Orphan Reconciliation Scan
- **WHEN** an administrator loads the reconciliation section or clicks "Refresh"
- **THEN** the system invokes `GET /auth/reconcile-orphans` and displays all detected orphaned entities with their identifiers and issue descriptions.

#### Scenario: Cleaning Up an Orphan Record
- **WHEN** an administrator clicks "Clean Up" on a specific orphan item
- **THEN** the system invokes `POST /auth/reconcile-orphans` with the orphan ID and type, executes remediation, logs the action, and removes the item from the display.
