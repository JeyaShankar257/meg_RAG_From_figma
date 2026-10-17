# MedNova Authentication and Authorization — Implementation Plan

## 1. Purpose

Implement a secure invitation-based authentication and authorization workflow for MedNova.

The intended workflow is:

1. An administrator invites a doctor by email.
2. The doctor opens the invitation, activates their account, and sets a password.
3. The doctor receives access only after satisfying the required approval and account-state checks.
4. An authorized doctor registers a patient and provides the patient's email address.
5. MedNova creates or links the appropriate patient identity and sends an invitation.
6. The patient opens the invitation, activates their account, and sets a password.
7. The patient logs in and can access only the resources they are authorized to access.

Supabase Auth is the authentication provider. The existing backend is responsible for authorization, account lifecycle management, privileged provisioning, and auditability.

**API endpoints are intentionally not prescribed in this document.** The coding agent should inspect the repository and existing OpenSpec specifications, then choose route names and request/response contracts consistent with the current architecture.

## 2. Goals

- Use Supabase Auth for credentials, invitations, password management, and sessions.
- Keep privileged Auth Admin and database operations on the server.
- Let administrators invite and manage doctors through the Admin Portal.
- Let authorized doctors register patients and invite them by email.
- Support invitation activation and password setup for doctors and patients.
- Enforce roles, account status, workspace membership, patient relationships, and applicable consent requirements.
- Prevent duplicate identities and safely handle partial provisioning failures.
- Keep live mode separate from demo mode.
- Record security-relevant lifecycle events without logging secrets.
- Preserve existing routes and functionality where practical.

## 3. Non-goals

Unless the existing product requirements explicitly require them, this change does not introduce:

- A replacement for Supabase Auth.
- Social login, SSO, MFA, or passwordless authentication.
- New clinical decision-making or prescription approval behavior.
- A new database or framework that duplicates existing functionality.
- Frontend-only authorization as a substitute for backend enforcement.

## 4. Start by inspecting the repository

Before coding, inspect the existing application and its OpenSpec artifacts.

Review:

- Existing authentication routes and session middleware.
- Existing doctor invitation, approval, activation, refresh, and password-change logic.
- Patient registration and patient invitation logic, if any.
- Supabase client configuration and server-only environment variables.
- `public.profiles`, `public.patients`, workspace membership, doctor-patient assignment, consent, and audit structures.
- Existing SQL migrations and Row Level Security (RLS) policies.
- Frontend login, activation, password setup, and protected-route behavior.
- Existing unit, integration, RLS, and end-to-end tests.
- Existing OpenSpec capabilities and in-progress changes.

Reuse the project's existing conventions. Do not create duplicate routes, tables, middleware, or specifications if equivalent functionality already exists. Record what is implemented, what is missing, and which tests cover it before making changes.

## 5. Target architecture

### Frontend

The React/Vite application contains:

- Admin Portal: invite doctors, view invitation and approval status, approve or reject doctors, and review relevant lifecycle errors.
- Doctor Portal: authenticate, complete activation, change a required temporary password if applicable, register patients, and send patient invitations.
- Patient Portal: authenticate, complete activation, manage the patient's permitted account functions, and access only authorized patient resources.

The frontend is responsible for user experience and presenting validation, loading, empty, success, and error states. It is not a trusted authorization boundary.

### Backend API

The backend must:

- Verify the Supabase access token for protected requests.
- Load trusted application identity and account state.
- Check role, approval, workspace membership, and resource-level permissions.
- Validate all input and avoid trusting role, workspace, patient, or identity values supplied by the browser without authorization checks.
- Use privileged clients only for operations that require them.
- Coordinate Auth and database provisioning.
- Record relevant audit events.
- Return safe, consistent error responses.

### Supabase Auth

Supabase Auth is responsible for credential verification, invitations, activation mechanisms, password reset/change flows, and sessions. Use supported Supabase Auth APIs rather than implementing password storage or custom token generation.

### PostgreSQL and RLS

The database stores application profiles, patient records, account lifecycle states, workspace relationships, and audit data. RLS must enforce the intended data access rules for user-accessible database operations.

### Privileged clients

Maintain clear server-side separation between:

1. An Auth Admin client for authorized Auth administration.
2. A database client for profile, patient, and audit provisioning.

Resolve credentials from server-only environment variables. Never expose service-role keys, Auth Admin secrets, or other privileged credentials through Vite variables or browser code.

## 6. Core identity and authorization model

Use the existing schema wherever possible. The names below describe concepts; they do not require creating new tables if equivalent structures already exist.

- **Auth identity:** Supabase Auth user ID, email, confirmation/activation state, and session state.
- **Application profile:** Application role, display information, doctor approval state, and password-change requirement where applicable.
- **Patient record:** Patient-specific status and clinical identity.
- **Workspace membership:** Determines which organization/workspace a user belongs to and which administrative or clinical operations are permitted.
- **Doctor-patient relationship:** Determines whether a doctor may access a patient's records.
- **Caregiver grant:** Where supported, defines explicit access a caregiver has to a patient's information.
- **Consent records:** Where applicable, records consent status and relevant scope.
- **Audit event:** Records security-relevant actions and outcomes.

### Roles

At minimum, support the product's existing roles:

- **Administrator:** May perform administrative operations only within their authorized scope.
- **Doctor:** May perform permitted clinical operations for patients and workspaces they are authorized to access.
- **Patient:** May access only their own permitted account and clinical resources.
- **Caregiver:** If supported, may access only resources explicitly granted to them and subject to applicable consent and policy.

Do not assume that a role alone grants access to every record. A doctor role must not automatically grant unrestricted access to every patient or workspace.

## 7. Workflow A — Administrator invites a doctor

### Admin Portal interaction

The administrator opens doctor management and submits the required doctor details, including:

- Doctor's name.
- Doctor's email address.
- Workspace or organization.
- Any additional professional or registration fields required by the product.

The UI displays the result returned by the backend. It must not claim that an invitation succeeded if provisioning or delivery failed.

### Backend workflow

1. Authenticate the administrator.
2. Confirm the administrator has permission to invite doctors in the target workspace.
3. Validate and normalize the input, including email format.
4. Check for an existing Auth identity, application profile, pending invitation, or duplicate doctor record.
5. Determine the intended behavior for an existing account. Do not create duplicate identities; use a separately authorized linking or reinvitation flow where appropriate.
6. Provision or reserve the required application records using the existing schema and guarded database function where applicable.
7. Create or invite the Auth identity using the server-side Auth Admin client and the configured doctor activation redirect.
8. Ensure the Auth user ID and application profile ID are correctly associated.
9. Send the invitation through the supported Auth invitation flow.
10. Record the outcome in the audit log, including a correlation ID.
11. Return a safe response to the UI.

Because Supabase Auth and PostgreSQL do not share a single transaction, implement compensating cleanup and recovery. If a later provisioning step fails, attempt cleanup when safe, record whether cleanup succeeded, and make any remaining orphaned state discoverable to authorized administrators.

### Doctor activation

1. The doctor opens the invitation link from the email.
2. The link directs the browser to the doctor-specific activation route, such as `/doctor/activate`, using a redirect URL allow-listed in Supabase.
3. The activation page processes the supported Supabase invitation/token flow. Never treat arbitrary query parameters as proof of identity.
4. Validate the invitation and its expiry/reuse rules through the supported Supabase flow.
5. Allow the doctor to set their own password securely.
6. Complete the required Auth activation/confirmation behavior.
7. Load or verify the corresponding application profile.
8. Apply approval and account-state rules.
9. Show a clear status:
   - Awaiting approval, if approval is required.
   - Account rejected or disabled, if applicable.
   - Password change required, if applicable.
   - Ready to continue, if all required conditions are satisfied.

Activation and approval are separate concepts. A doctor may successfully activate their identity but remain unable to use clinical features until approved.

## 8. Workflow B — Doctor registers a patient and invites them

### Doctor Portal interaction

An authorized doctor opens patient registration and enters the patient's required information, including:

- Patient's name.
- Patient's email address.
- Required registration and clinical identity fields.
- Any required consent/acknowledgement information.
- Any other fields required by the existing clinical workflow.

Collect only necessary information. The patient email is a delivery destination, not by itself proof of identity, authorization, or consent.

### Backend workflow

1. Authenticate the doctor.
2. Confirm the doctor is active, approved, and authorized for the target workspace.
3. Validate the registration input and required acknowledgements.
4. Check whether the patient or Auth identity already exists.
5. If a patient identity already exists, do not create another Auth user. Use an authorized and auditable linking/reinvitation process, with appropriate identity verification and consent checks.
6. If the patient is new, create or reserve the patient record with a pending/invited status using a safe provisioning order.
7. Create or invite the Auth identity using the server-side Auth Admin client and the configured patient activation redirect.
8. Link the Auth user ID to the correct patient/profile record and preserve the necessary doctor/workspace relationship.
9. Send the invitation email.
10. Record the outcome and correlation ID in the audit log.
11. Return a clear success or failure result.

The backend must not allow a doctor to assign a patient to an arbitrary workspace, impersonate another doctor, or link an existing account without appropriate authorization.

### Patient activation

1. The patient opens the invitation email.
2. The link directs the patient to the patient activation route, such as `/activate`, using an allow-listed redirect URL.
3. The frontend processes the invitation through the supported Supabase flow.
4. The invitation is validated; expired or reused links receive clear guidance.
5. The patient sets their own password.
6. The application verifies the Auth identity is linked to the intended patient record.
7. The patient account and patient record transition to the correct status under the existing lifecycle rules.
8. The patient can log in and access only their permitted resources.

Do not infer a patient record link solely from an email address supplied by the browser. Verify the identity and relationship server-side.

## 9. Invitation link and password requirements

- Use Supabase Auth's supported invitation API, such as `inviteUserByEmail`, if compatible with the project's installed SDK and chosen activation flow.
- Configure explicit allow-listed development and production redirect URLs in Supabase.
- Use distinct doctor and patient activation destinations.
- Never create custom authentication tokens or treat an unverified URL as an authenticated session.
- Never send a user's permanent password by email.
- Prefer allowing each user to set their own password during activation.
- If temporary passwords are required by an existing workflow, show or deliver them securely, require an immediate password change, and never persist or log plaintext passwords.
- Clear invitation tokens or sensitive URL fragments after processing where appropriate.
- Never log complete invitation URLs, raw tokens, access tokens, refresh tokens, passwords, or provider secrets.
- Provide clear expired, invalid, already-used, cancelled, and rate-limited invitation states.
- Avoid automatic retry loops for rate-limited invitation delivery.

## 10. Account lifecycle and access rules

Use the existing schema as the source of truth. The current design identifies:

- Doctor approval state, for example `profiles.approval_status`: `pending`, `approved`, `rejected`.
- Temporary-password state, for example `profiles.must_change_password`: `true` or `false`.
- Patient state, for example `patients.status`: `pending`, `active`, `inactive`.
- Supabase Auth confirmation, invitation, and session state.

Keep invitation delivery state distinct from Auth activation and clinical account status when the existing schema requires it.

### Required rules

- Invalid credentials are rejected without revealing whether a specific email exists.
- Pending or rejected doctors cannot access normal clinical endpoints.
- Doctors who must change a password cannot bypass the required password-change flow.
- Inactive patients cannot perform protected patient operations.
- An expired or invalid session cannot access protected APIs.
- A valid session alone does not grant access to a workspace or patient record.
- Existing accounts are not duplicated when a new invitation is requested.
- Account state changes must be enforced by the backend, not only by the frontend.

## 11. Authorization middleware and request checks

Implement or reuse middleware with responsibilities equivalent to:

- Require an authenticated user.
- Require an allowed role.
- Require an approved and active doctor.
- Require a completed mandatory password change.
- Require workspace membership and appropriate workspace permissions.
- Require patient ownership or an authorized doctor-patient relationship.
- Check caregiver grants and consent when applicable.
- Enforce resource-level authorization before reading or modifying protected data.

These are responsibilities, not mandatory function names. The coding agent should use existing conventions.

For each protected request:

1. Verify the access token using the supported Supabase mechanism.
2. Resolve the authenticated identity from the verified token.
3. Load trusted application profile and account state as needed.
4. Check role and account eligibility.
5. Check workspace membership.
6. Check patient assignment/ownership and applicable grants/consent.
7. Validate the requested operation and input.
8. Perform the operation under the intended database security model.
9. Record relevant audit events.

Never trust role, user ID, workspace ID, or patient ID supplied by the browser without checking that the authenticated actor is permitted to use those values.

## 12. Row Level Security (RLS)

Review and test RLS for all user-accessible tables containing sensitive data, including profiles, patients, workspace membership, doctor-patient relationships, caregiver grants, consent records, clinical records, and audit records as applicable.

Requirements:

- Enable RLS where required for exposed tables.
- Permit only the minimum necessary reads and writes.
- Restrict changes to roles, approval states, workspace membership, and patient relationships.
- Ensure users cannot access another workspace's data without authorization.
- Ensure patients cannot access another patient's data.
- Ensure doctors cannot access unassigned patients merely because they have the doctor role.
- Prevent unauthorized users from changing their own role or approval state.
- Test policies with separate users and realistic relationships.

A service-role database client may bypass RLS. Any operation using such a client must have equivalent authorization checks in trusted backend code. Never expose a service-role key to the browser.

## 13. API design responsibilities

**Do not hard-code API endpoint names in this plan.** The coding agent must:

1. Inspect existing route structure and endpoint conventions.
2. Reuse existing routes where they already satisfy the requirements.
3. Add only missing operations.
4. Define request and response schemas, status codes, validation, authentication, authorization, and failure behavior.
5. Update the typed frontend API client and tests consistently.
6. Document any changed contracts.

The implemented API must cover these capabilities, whether through existing or newly designed endpoints:

- Login/session handling if the application uses backend wrappers.
- Logout/session invalidation behavior.
- Admin doctor invitation.
- Pending doctor listing and approval/rejection.
- Invitation resend/cancel behavior where supported.
- Doctor patient registration and invitation.
- Doctor and patient activation.
- Password change and reset.
- Session refresh/validation.
- Authorized lifecycle error and audit-event viewing.
- Safe recovery/cleanup of orphaned identities.

Avoid adding endpoints that duplicate Supabase Auth functionality unnecessarily. The frontend may use supported Supabase client operations for ordinary user authentication, while all privileged administration and protected business operations remain server-controlled.

## 14. Failure handling, idempotency, and recovery

Auth and database operations cannot be treated as one atomic transaction.

Design provisioning so the system can detect and recover from partial failures. Consider cases such as:

- Auth user creation succeeds but profile creation fails.
- Patient record creation succeeds but Auth invitation fails.
- Invitation email delivery is rate-limited.
- Cleanup fails after partial provisioning.
- The same invitation form is submitted multiple times.
- An existing user is invited again.
- The user opens an expired or already-used invitation.

Requirements:

- Use a safe, consistent provisioning order.
- Prevent duplicate identities and duplicate patient records.
- Return a conflict response for incompatible duplicate requests.
- Return an explicit rate-limit response when appropriate.
- Do not claim success when required provisioning or delivery fails.
- Attempt compensating cleanup where safe.
- Record orphaned identities and cleanup outcomes.
- Provide an authorized, audited recovery procedure.
- Make retries idempotent or detect duplicate effects.
- Do not automatically delete existing identities that may already be in use.

## 15. Audit logging

Record relevant events for:

- Doctor and patient invitations.
- Invitation resend/cancel operations.
- Account activation.
- Approval/rejection decisions.
- Password changes and resets (record the event, never the password).
- Workspace and patient relationship changes.
- Authorization denials.
- Provisioning failures and cleanup attempts.
- Sensitive administrative operations.

Include appropriate fields such as actor, workspace, target identity/resource, action, timestamp, correlation ID, and outcome.

Do not log passwords, access tokens, refresh tokens, invitation tokens, complete invitation URLs, or provider secrets. Limit audit-log access and protect records against unauthorized modification.

## 16. Live mode versus demo mode

Live mode must use real Supabase Auth, the real backend, appropriate database/RLS controls, and the real invitation flow.

Demo fixtures and shortcuts may remain for existing tests and local development, isolated behind the existing demo-mode configuration.

Requirements:

- A live provisioning failure must never silently fall back to a demo identity.
- Live mode must show explicit loading, empty, and error states.
- Demo mode must not weaken production authorization.
- Tests must prove the mode boundary works as intended.

## 17. Frontend requirements

For Admin, Doctor, and Patient portals, provide clear states for:

- Loading and form submission.
- Validation errors.
- Invitation sent.
- Invitation expired or invalid.
- Invitation already used or cancelled.
- Account pending approval.
- Account rejected or disabled.
- Password change required.
- Session expired.
- Unauthorized/forbidden request.
- Duplicate account or existing identity.
- Rate limiting and network/server failure.
- Successful activation and login.

Protected-route guards improve navigation but do not replace backend authorization. Do not put privileged keys or service-role credentials into Vite environment variables or frontend bundles.

## 18. Security and acceptance tests

The coding agent must add or update automated tests for at least these scenarios:

### Authentication

- Invalid credentials are rejected without account enumeration.
- Invalid, expired, or otherwise unusable sessions cannot access protected endpoints.
- Password reset and change flows follow the chosen Supabase Auth integration.
- Invitation activation rejects invalid, expired, and reused links according to the supported flow.

### Administrator and doctor workflow

- An authorized administrator can invite a doctor in their permitted workspace.
- An unauthorized user cannot invite or approve doctors.
- A doctor can activate an invitation and set their own password.
- Pending/rejected doctors cannot access normal clinical operations.
- Mandatory password change cannot be bypassed.
- Approval and activation states remain consistent.

### Patient workflow

- An authorized doctor can register a patient and invite them.
- An unauthorized or inactive doctor cannot register or invite patients.
- Patient Auth identity and patient record links are correct.
- An existing patient identity is not duplicated.
- A patient cannot access another patient's records.
- A doctor cannot access a patient outside their authorized relationship.
- Caregiver access, if implemented, follows grants and consent rules.

### Provisioning and data protection

- Duplicate submissions do not create duplicate identities or records.
- Partial provisioning failure triggers safe cleanup/recovery and audit records.
- Invitation rate limits return explicit errors.
- RLS prevents unauthorized direct database reads and writes.
- Role and approval fields cannot be self-modified by ordinary users.
- Privileged credentials are absent from frontend bundles and logs.
- Live mode never silently uses demo fixtures.
- Audit events contain useful trace information but no secrets.

## 19. Migration and deployment plan

1. Review the current schema and migration history.
2. Back up and verify the existing hosted database configuration.
3. Apply only required, compatible database migrations.
4. Verify RLS policies and guarded database-function privileges.
5. Configure server-only Supabase credentials.
6. Configure allowed activation redirect URLs for development and production.
7. Configure appropriate SMTP and invitation delivery settings.
8. Deploy backend changes before enabling new administrative UI actions.
9. Repair existing account relationships by checking Auth/profile ID matches, roles, workspace membership, approval states, and patient links.
10. Run smoke tests with disposable doctor and patient accounts.
11. Enable the UI and production workflows incrementally.
12. Monitor provisioning failures, rate limits, authorization denials, and cleanup errors.
13. If rollback is needed, roll back application deployment and disable new actions while retaining compatible additive database changes unless a reviewed migration requires otherwise.
14. Remove orphaned test identities only through an audited cleanup operation.

## 20. OpenSpec workflow

The coding agent must inspect the existing OpenSpec capabilities and changes before creating new artifacts.

Recommended process:

1. Inspect current specifications and active changes.
2. Compare existing requirements and implementation with this plan.
3. Identify missing requirements and tests.
4. Create a focused OpenSpec change only for missing work.
5. Review the proposal, design, delta specs, and tasks.
6. Implement the tasks using existing repository conventions.
7. Run relevant unit, integration, RLS, and end-to-end tests.
8. Update/sync the main specification as appropriate.
9. Archive the change only after implementation and verification are complete.

Do not duplicate existing completed work or create a new competing authentication design.

## 21. Definition of done

The work is complete only when:

- The administrator can invite a doctor and the doctor can activate their account.
- The doctor can register a patient and invite them by email.
- The patient can activate their account and log in.
- Doctor approval and patient status are enforced.
- Backend authorization protects every relevant operation.
- RLS prevents unauthorized database access.
- Existing identities are reused or linked safely rather than duplicated.
- Partial failures are visible, recoverable, and audited.
- Invitation links and secrets are handled securely.
- Live and demo modes are isolated.
- Automated tests demonstrate both permitted and denied access.
- OpenSpec accurately reflects the implemented behavior.

## 22. Final implementation principle

Use Supabase Auth to establish identity. Use the backend to decide what that identity may do. Use PostgreSQL and RLS as an additional enforcement layer. Use invitations to onboard users, explicit lifecycle states to control activation and approval, and audit records to make sensitive operations traceable.

The implementation should be based on the existing MedNova repository and specifications. Endpoint names and API contracts are intentionally left to the coding agent after repository inspection.
