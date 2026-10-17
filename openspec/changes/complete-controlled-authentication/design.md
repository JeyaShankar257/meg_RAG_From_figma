# Design

## Context

The system implements the architecture detailed in the **MedNova Authentication and
Authorization Implementation Plan**. Supabase Auth provides identity, credentials,
and session management. PostgreSQL and RLS provide row-level database protection.
The Node/Hono API service enforces business authorization, workspace boundaries,
compensating cleanup, and immutable auditability.

```text
Admin / Doctor UI (Portals)
      │
      ▼
Backend API (Hono)
      ├──> Auth Admin Client (SUPABASE_SECRET_KEY: server-only credentials, invitations, passwords)
      └──> Database Client (SUPABASE_SERVICE_ROLE_KEY: RLS-safe provisioning & audit records)
      │
      ▼
PostgreSQL Schema:
  auth.users (Auth Identity: email, encrypted password, email_confirmed_at)
      ↕ (id)
  public.profiles (Application Profile: role, workspace_id, approval_status, must_change_password)
      ↕ (profile_id)
  public.patients (Clinical Record: id, workspace_id, status: pending|active|inactive, activated_at)
```

## Goals / Non-Goals

**Goals:**
- Implement a clear 3-tier identity model: Auth Identity <-> Application Profile <-> Clinical Patient Record.
- Keep privileged Auth Admin operations and database writes strictly server-side.
- Ensure identity provisioning is resilient to partial failure through compensating cleanup and auditable orphan reconciliation.
- Standardize portal-specific activation routes (`/doctor/activate` and `/activate`) with single-use fragment token clearing.
- Provide a dedicated administrator interface for doctor invitation, approvals, temporary-password setup, and orphan inspection.
- Enforce that live mode (`DEMO_MODE=false`) never silently falls back to demo fixtures or mock accounts.

**Non-Goals:**
- Replacing Supabase Auth.
- Adding social login, MFA, SSO, or passwordless magic links.
- Changing clinical prescription approval or RAG advisory boundaries.
- Removing existing demo fixtures needed for isolated offline tests.

## Decisions

### 1. Maintain separate privileged Supabase clients
- `getAuthAdminClient()` uses `SUPABASE_SECRET_KEY` (or service role key fallback) strictly on the server for user invitation, password setting, session termination, and user deletion.
- `getAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` for database-level profile, patient, and audit management.
- Neither key is ever exposed to Vite or the client bundle.

### 2. Guarded database provisioning functions
- `provision_invited_profile` runs as `security definer` with `set search_path = public, pg_temp`, verifies `service_role` caller, validates inputs, and has execution revoked from public/anon/authenticated roles.
- `activate_patient_account` transitions a patient record from `pending` to `active` and sets `activated_at = now()`.
- `reconcile_workspace_orphans` detects unlinked patients, deleted profiles, or anomalous accounts within a workspace.

### 3. Explicit lifecycle state model
- Doctor: `profiles.approval_status` (`pending` | `approved` | `rejected`), `profiles.must_change_password` (`true` | `false`).
- Patient: `patients.status` (`pending` | `active` | `inactive`), `patients.activated_at`.
- Auth: `auth.users.email_confirmed_at` and active session tokens.

### 4. Portal-specific activation and fragment handling
- Doctor activation: `/doctor/activate`.
- Patient activation: `/activate`.
- Both pages parse the Supabase hash fragment (`#access_token=...`) once, clear the fragment immediately using `window.history.replaceState`, validate matching passwords, call `/auth/accept-invitation`, and redirect to their respective portal login upon success.

### 5. Compensating cleanup and idempotent operations
Because Supabase Auth and PostgreSQL cannot share a single database transaction:
- If Auth invitation succeeds but profile creation fails: delete the Auth user and clean up pending patient records.
- If email provider rejects with rate limit (429) or duplicate (409): clean up reserved patient rows and return actionable errors.
- Doctor approvals and rejections are idempotent (re-approving returns `alreadyApproved: true`).

### 6. Dedicated administrator controls
Admin-only UI rendered only when `user.role === 'admin'`:
- Doctor invitations (name, email, workspace).
- Pending approval queue with Approve and Reject actions.
- Temporary-password setting.
- Resend invitation capability.
- Workspace orphan reconciliation review.

### 7. Audit all identity lifecycle events
Audit records capture actor, target, workspace, action, timestamp, correlation ID, and outcome (`success`, `denied`, `error`). SQL constraints ensure metadata never stores passwords, tokens, or provider secrets.

### 8. Strict live and demo separation
Live mode uses real Supabase Auth, database RLS, and real API endpoints. Demo fixtures are active only when `DEMO_MODE=true`. A failure in live mode displays an actionable error message rather than falling back to mock data.

### 9. Account Credentials Matrix (Development, Demo & Testing)

In Supabase Auth, credentials (hashed passwords) live strictly inside `auth.users`, and application tables (`profiles`, `patients`) never store plaintext passwords. For development, local testing, and seed verification, the following credential matrix is established:

| Role | Name | Email | Initial / Test Password | Portal URL | Approval & Account Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Administrator** | MedNova Admin | `admin@mednova.clinic` | `MedNovaAdmin2026!` | `/doctor/login` | Role: `admin`, Approved, Active |
| **Doctor** | Dr. Sarah Chen | `s.chen@mednova.clinic` | `MedNovaDoctor2026!` | `/doctor/login` | Role: `doctor`, `approval_status: approved` |
| **Doctor (Temporary)** | Dr. Temporary PW | `doctor.temp@mednova.clinic` | `Temporary2026!` | `/doctor/login` | Role: `doctor`, `must_change_password: true` |
| **Doctor (Pending)** | Dr. Pending Approval | `doctor.pending@mednova.clinic` | *(Set upon activation)* | `/doctor/login` | Role: `doctor`, `approval_status: pending` |
| **Patient** | Marcus Rivera | `m.rivera@email.com` | `MedNovaPatient2026!` | `/patient/login` | Role: `patient`, `status: active` |
| **Patient (Pending)** | Sofia Patel | `s.patel@email.com` | *(Set upon activation)* | `/patient/login` | Role: `patient`, `status: pending` |
| **Care Team** | Priya Nair | `p.nair@mednova.clinic` | `MedNovaCareTeam2026!` | `/doctor/login` | Role: `care_team`, Approved, Active |

## Risks / Trade-offs

- **[Risk]** Supabase Auth invitation limits can block repeated development tests → return explicit 429 responses, use custom SMTP for sustained testing, and avoid automatic invitation retries.
- **[Risk]** A provider key can authorize Auth but not database writes, or vice versa → validate both clients at startup and add a non-secret health capability check.
- **[Risk]** Compensating cleanup can fail after a partial provisioning error → record the orphan state, expose an administrator cleanup action, and make retries idempotent.
- **[Risk]** Tokens in URL fragments can be copied or replayed → use single-use Supabase tokens, clear fragments after processing, never log invitation URLs, and show expired-token guidance.
- **[Risk]** Temporary passwords may be shared insecurely → show them only once to an authorized administrator, require immediate change, and never persist or log the plaintext value.
- **[Risk]** Existing demo data can mask missing live records → show explicit loading, empty, and error states in live mode instead of silently using demo values.

## Migration Plan

1. Apply the existing approval and temporary-password migrations to the hosted Supabase project.
2. Apply the guarded invited-profile provisioning migration and verify function privileges.
3. Configure server-only Auth and database keys, redirect allow-list entries, and production/custom SMTP.
4. Deploy backend changes before enabling the administrator UI.
5. Migrate or repair existing accounts by verifying Auth/profile ID matches, workspace membership, role, approval state, and patient links.
6. Test administrator, doctor, and patient flows with disposable accounts.
7. Roll back application deployment if needed; retain additive database columns and disable new UI actions until the backend is restored. Remove only orphaned test identities through an audited cleanup operation.
