# Tasks

## 1. Data and Supabase controls

- [x] 1.1 Review the existing approval, temporary-password, and invited-profile migrations; add the patient activation status transition and verify the migration applies cleanly with `supabase db push` against the configured project.
- [x] 1.2 Harden the invited-profile provisioning function with fixed search path, explicit service-role authorization, least-privilege grants, and safe input validation; verify public, anon, and authenticated roles cannot execute it.
- [x] 1.3 Add or update audit storage for invitation, approval, rejection, activation, password-change, cleanup, and denied-provisioning events; verify sensitive values are excluded by SQL-level constraints or API tests.
- [x] 1.4 Add a repeatable orphan-reconciliation query or administrative operation for Auth users, profiles, and patient records left by failed provisioning; verify it is workspace-scoped and auditable.

## 2. Backend authentication and provisioning

- [x] 2.1 [Requires backend] Centralize live configuration validation for the Auth Admin key, database service-role key, API origin, and allowed activation redirects; verify startup fails clearly for missing or conflicting required values.
- [x] 2.2 [Requires backend] Refactor doctor invitation, approval, rejection, temporary-password, and resend operations into idempotent service behavior; verify duplicate, wrong-workspace, non-admin, and already-completed states return stable API errors.
- [x] 2.3 [Requires backend] Complete patient invitation orchestration with pending status, guarded profile provisioning, Auth cleanup/quarantine on failure, and safe retry behavior; verify a failed Auth/profile step does not silently report success.
- [x] 2.4 [Requires backend] Mark an invited patient active only after successful activation and email verification; verify pending patients cannot log in or access clinical endpoints before activation.
- [x] 2.5 [Requires backend] Enforce portal-specific role, approval, verification, workspace, and must-change-password checks in login, `/me`, refresh, and protected route middleware; verify wrong-portal and stale-session requests are denied.
- [x] 2.6 [Requires backend] Map provider failures for expired invitations, rate limits, duplicate accounts, invalid redirects, and unauthorized server keys to documented status codes without logging secrets; verify API contract tests cover each mapping.
- [x] 2.7 [Requires backend] Add server-side audit events and correlation identifiers to all identity lifecycle mutations and denied administrative actions; verify audit records contain actor, target, workspace, outcome, and timestamp.
- [x] 2.8 [Requires backend] Extend API contract and authorization tests for administrator, doctor, and patient lifecycle paths; verify the focused API test command and TypeScript check pass.

## 3. Frontend account lifecycle

- [x] 3.1 Update the typed API client and session provider to represent pending, approved, active, verified, and must-change-password states; verify refresh and logout clear invalid or expired local sessions.
- [x] 3.2 Harden patient and doctor activation pages to parse fragment tokens once, clear token fragments after use, show expired/rate-limited/provider errors, and redirect to the correct portal; verify activation tests cover success, missing token, and expired token states.
- [x] 3.3 Keep doctor temporary-password users in the forced password-change route until completion; verify direct navigation to clinical routes is blocked while the flag is set.
- [x] 3.4 Build an administrator account-management surface for doctor invitations, pending approvals, rejection, temporary-password setup, resend/cancel actions, and lifecycle errors; verify only administrator sessions can render and submit these controls.
- [x] 3.5 Replace silent demo fallbacks in authentication-related live screens with loading, empty, and actionable error states; verify `DEMO_MODE=false` never displays mock account success after a failed API call.
- [x] 3.6 Add frontend tests for role guards, activation redirects, temporary-password redirects, and administrator controls; verify the frontend typecheck and build pass.

## 4. Documentation and operational readiness

- [x] 4.1 Update `DEVELOPMENT.md` with the final key separation, migration order, redirect allow-list, account lifecycle, test-email guidance, and credential-rotation requirements; verify every documented command matches the repository scripts.
- [x] 4.2 Add a safe end-to-end test checklist for administrator, doctor, and patient flows using disposable accounts and non-secret diagnostics; verify it includes rate-limit and expired-token recovery.
- [x] 4.3 Add startup and health diagnostics that report configuration presence and provider capability without returning key material; verify logs contain no access tokens, refresh tokens, passwords, or secret keys.

## 5. Integration verification

- [x] 5.1 [Requires backend] Apply migrations and run the API, worker, frontend, and agent services in live mode; verify health endpoints, CORS, `/api` proxying, and configured activation redirects.
- [x] 5.2 [Requires backend] Execute the complete administrator flow from login through doctor approval and audit verification; verify the doctor remains blocked before approval.
- [x] 5.3 [Requires backend] Execute the complete doctor flow from invitation through activation or temporary password, forced password change, portal access, and logout/login; verify workspace and role restrictions.
- [x] 5.4 [Requires backend] Execute the complete patient flow from invitation through activation, email verification, active status, patient login, and patient portal access; verify a pending or wrong-portal account is rejected.
- [x] 5.5 Run the focused API tests, frontend tests/typecheck/build, worker typecheck, migration validation, and secret-scanning checks; verify all pass and document any non-blocking existing warnings.
