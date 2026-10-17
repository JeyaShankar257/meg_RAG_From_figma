# MedNova Backend — Development Setup

This guide covers local setup for the TypeScript API (`apps/api`), background
worker (`apps/worker`), and Python agent service (`apps/agents`).

---

## Prerequisites

| Tool | Min version | Install |
|------|------------|---------|
| Node.js | 20 | [nodejs.org](https://nodejs.org) |
| pnpm | 9 | `npm install -g pnpm@9` |
| Python | 3.11 | [python.org](https://python.org) |
| Supabase CLI | latest | `npm install -g supabase` |

---

## 1. Install dependencies

```bash
# TypeScript workspaces (run from repo root)
pnpm install

# Python agent service
cd apps/agents
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -e ".[dev]"
cd ../..
```

---

## 2. Configure environment variables

```bash
# API
copy .env.example apps\api\.env

# Worker
copy .env.example apps\worker\.env
```

Edit each `.env` file and fill in:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `RESEND_FROM_ADDRESS` | A verified sender in Resend |
| `GEMINI_API_KEY` | [ai.google.dev](https://ai.google.dev) |
| `AGENTS_INTERNAL_SECRET` | Any strong random string (keep same in API + Worker + Agents) |

> **Demo mode**: Set `DEMO_MODE=true` in development to allow seed routes and
> mock fallbacks. Must be `false` or unset in production.

The checked-in local runtime is configured for live mode (`DEMO_MODE=false`).
Create real Supabase Auth users and related profile/patient records before
logging in. The API and worker commands load their app-specific `.env` first and then the
root `.env`; Node preserves the first value for duplicate variables, so the
app-specific file is authoritative.

---

## 3. Set up Supabase

The repository is initialized as a Supabase CLI project. For a local database,
make sure Docker Desktop is running and use:

```bash
pnpm run supabase:start
pnpm run supabase:status
pnpm run supabase:db:reset
```

The reset command applies every migration under `supabase/migrations`. It is
destructive to the local database only and should not be used against a hosted
project.

For a new hosted Supabase project:

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push

# (Optional) Load demo seed data
pnpm --filter @mednova/api seed:demo
```

Copy the hosted project's API URL, anon key, and service-role key into
`apps/api/.env` and `apps/worker/.env` from `.env.example`. The service-role
key is server-only and must never be placed in Vite variables or committed.
For newer Supabase projects, `SUPABASE_SECRET_KEY` is dedicated for Supabase Auth Admin operations (`auth.admin.inviteUserByEmail`, `auth.admin.updateUserById`, `auth.admin.deleteUser`), while `SUPABASE_SERVICE_ROLE_KEY` is used for database queries and bypassing Row Level Security (RLS) on backend services.
When both are present, the API maps `SUPABASE_SECRET_KEY` to the Auth Admin client and `SUPABASE_SERVICE_ROLE_KEY` to the PostgREST admin client.

### Controlled Authentication & Migration Order

The migration history under `supabase/migrations/` establishes the 3-tier identity and clinical model:
1. `20260330100000_mednova_foundation.sql`: Core clinical schema (`workspaces`, `profiles`, `patients`, `prescriptions`, `visits`, `audit_events`).
2. `20261017110000_doctor_portal_backend_workflows.sql`: Workflow state and RLS policies.
3. `20261017120000_controlled_authentication_hardening.sql`: Hardened `provision_invited_profile` function with explicit search path, added `activated_at` column to `patients`, `activate_patient_account` RPC, SQL check constraint `audit_events_no_sensitive_data` preventing password/secret leaks, and `reconcile_workspace_orphans` procedure.

Apply all migrations with:
```bash
supabase db push
```

### Allowed Activation Redirects

Supabase Auth requires configured redirect URLs for invitations and password recovery.
In `apps/api/.env`:
```env
ALLOWED_ACTIVATION_REDIRECTS=http://localhost:5173/activate,http://localhost:5173/doctor/activate,http://localhost:8443/activate,http://localhost:8443/doctor/activate
```
Ensure these exact URLs are added to the **Redirect URLs** list in Supabase Dashboard → Authentication → URL Configuration.

### Account Credentials Matrix (Development & Test Environments)

> [!IMPORTANT]
> Passwords in MedNova are **NEVER** stored in plain text anywhere in database tables. Passwords reside exclusively hashed inside Supabase Auth (`auth.users`).
> The following table documents initial / seed development credentials for local and staging verification:

| User Identity | Role | Portal | Initial / Temporary Password | Lifecycle State | Access Scope |
|---|---|---|---|---|---|
| `admin@mednova.clinic` | `admin` | Doctor (`/doctor/login`) | `adminPassword123` | Approved | Full administrative access, physician management (`/doctor/admin/accounts`), audit trail inspection. |
| `s.chen@mednova.clinic` | `doctor` | Doctor (`/doctor/login`) | `doctorPassword123` | Approved | Assigned clinical patients, prescriptions, RAG reviews, patient creation. |
| `invited.doctor@mednova.clinic` | `doctor` | Doctor (`/doctor/login`) | *Set by Admin* or via `/doctor/activate` | Pending → Approved | Locked to `/doctor/change-password` if `mustChangePassword` is true; clinical routes blocked until approved. |
| `m.rivera@email.com` | `patient` | Patient (`/patient/login`) | `password123` | Active / Verified | Marcus Rivera (PT-001) dose center, visits, transparency reports, settings. |
| `d.kowalski@email.com` | `patient` | Patient (`/patient/login`) | `password123` | Active / Verified | David Kowalski (PT-003) dose center, adherence escalations. |
| `s.patel@email.com` | `patient` | Patient (`/patient/login`) | *Set via `/activate`* | Pending → Active | Sofia Patel (PT-004) unverified until invitation accepted at `/activate`. |

### Controlled Account Provisioning Workflow

1. **Doctor Lifecycle**:
   - **Invitation**: An Administrator invites the doctor via `POST /auth/doctor-invitations` or the Admin Doctor Management UI (`/doctor/admin/accounts`). An Auth user and `public.profiles` row are created with `approval_status = 'pending'`.
   - **Approval**: The Administrator reviews and approves the doctor (`POST /auth/doctor-invitations/:id/approve`). Unapproved doctors receive `403 Forbidden` (`account_pending_approval`) when attempting to sign in.
   - **Temporary Password**: An Administrator can set a temporary password via `POST /auth/doctor-invitations/:id/temporary-password`. The profile is marked `must_change_password = true`.
   - **Forced Password Change**: Upon signing in, the doctor is immediately routed to `/doctor/change-password` and locked out of all clinical routes until a new 8+ character password is saved.

2. **Patient Lifecycle**:
   - **Provisioning**: A doctor creates a patient via `POST /patients` (or the Doctor Portal UI). The patient record is created with `status = 'pending'`.
   - **Compensating Rollback**: If Supabase Auth invitation creation fails, the API immediately rolls back the inserted `patients`, `consent_records`, and `conditions` rows. If profile creation fails after Auth user creation, the Auth user is quarantined/deleted to prevent orphaned identities.
   - **Activation**: The patient receives an invitation email and navigates to `/activate#access_token=...`.
   - **Single-use Fragment**: The page parses the token once, strips the token fragment from `window.location` to prevent token leakage via referrer headers, and calls `POST /auth/accept-invitation`.
   - **Activation RPC**: The database updates the patient to `status = 'active'`, sets `activated_at = now()`, and logs an audit event without sensitive tokens. Pending patients cannot log in or access clinical endpoints before activation.

### Test Email & Disposable Account Guidance

- **Domain isolation**: For automated and disposable test runs, use dedicated disposable domains like `test-doctor-<uuid>@mednova.clinic` and `test-patient-<uuid>@example.com`.
- **Resend test deliveries**: In development with Resend, test emails can be sent to `delivered@resend.dev` to verify API calls without hitting actual physician inboxes.
- **Rate-limit recovery**: Supabase Auth enforces rate limits on signup and recovery emails (default 3-4 emails per hour). When testing repeated invitations, configure temporary passwords instead of email resends to bypass provider email rate limits.

### Credential Rotation Requirements

When rotating database or API credentials:
1. Generate the new `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` in the Supabase Dashboard.
2. Update the environment variables in `apps/api/.env` and `apps/worker/.env`.
3. Verify connectivity via `GET /health/diagnostics` (inspect `serviceRoleKeyPresent: true` and `authAdminKeyPresent: true`).
4. Invalidate existing sessions: Run `POST /auth/logout` or revoke active refresh tokens in Supabase Auth if compromise is suspected.

---

## 4. End-to-End Test Checklist (Task 4.2)

Use this checklist to verify complete identity and clinical boundaries in live staging:

### Administrator & Doctor Flow
- [ ] Sign in as `admin@mednova.clinic` at `/doctor/login`. Verify access to `/doctor/admin/accounts`.
- [ ] Navigate to `/doctor/admin/accounts` and click "+ Invite Doctor". Enter disposable name and email `test-doc@mednova.clinic`. Select "Provision with temporary password" (`TempPass123!`). Submit and verify doctor appears with "Pending Approval" and "Temporary Password" badges.
- [ ] Attempt to sign in as `test-doc@mednova.clinic` at `/doctor/login` using `TempPass123!`. Verify login is rejected with HTTP 403 `account_pending_approval`.
- [ ] In the Administrator window, click "Approve". Verify status updates to "Approved".
- [ ] Sign in as `test-doc@mednova.clinic`. Verify the browser immediately redirects to `/doctor/change-password` and sidebar links to patients/dashboard are disabled.
- [ ] Attempt to manually navigate to `/doctor` or `/doctor/settings`. Verify immediate bounce back to `/doctor/change-password`.
- [ ] Submit a new password (`PrivatePass456!`). Verify successful change and seamless transition into `/doctor` Dashboard.
- [ ] Sign out and log back in with `PrivatePass456!`. Verify normal doctor dashboard access.

### Patient Flow
- [ ] As an authorized doctor, navigate to `/doctor/patients/new` and submit a new patient `Eleanor Vance`, email `test-patient@example.com`.
- [ ] Verify the patient is registered in `status = 'pending'`.
- [ ] Attempt to log into `/patient/login` with `test-patient@example.com`. Verify rejected with HTTP 401/403.
- [ ] Navigate to `/activate#access_token=mock-valid-token` (or use the email link). Verify the token fragment is stripped from the URL bar immediately.
- [ ] Submit a new password. Verify activation succeeds and patient status transitions to `active`.
- [ ] Sign in at `/patient/login`. Verify patient dashboard displays dose tracking and visits.

### Error & Provider Recovery Flow
- [ ] Navigate to `/activate#error=access_denied&error_code=otp_expired`. Verify informative banner: "Your invitation link has expired...".
- [ ] Simulate provider rate limit (HTTP 429). Verify UI presents friendly notice: "Too many attempts. Please wait a few moments before trying again."
- [ ] Query `/auth/reconcile-orphans` as Admin. Verify orphan table loads and allows targeted cleanup of dangling records.

---

## 4. Start services

Open four terminals:

```bash
# Terminal 1 — Frontend (already running in Figma Make, port 8443 or 5173)
pnpm dev

# Terminal 2 — API (port 3001)
pnpm --filter @mednova/api dev

# Terminal 3 — Worker
pnpm --filter @mednova/worker dev

# Terminal 4 — Python agent service (port 8001)
cd apps/agents
uvicorn main:app --reload --port 8001
```

---

## 5. Verify health

```bash
# API health check
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"mednova-api","demoMode":true,...}

# Agent service health
curl http://localhost:8001/health/live
# Expected: {"status":"ok","service":"mednova-agents",...}

# Readiness is separate from liveness and reports only non-sensitive status.
curl http://localhost:3001/health/ready
curl http://localhost:8001/health/ready
```

To verify the configured API and agent endpoints together without printing any
credentials, run:

```bash
pnpm run verify:integration
```

For the isolated demo workflow (doctor session, patient session, protected
reads, consent, and correction boundary), run:

```bash
pnpm run e2e:demo
```

---

## 6. Run checks

```bash
# TypeScript type checking
pnpm --filter @mednova/api typecheck
pnpm --filter @mednova/worker typecheck

# TypeScript tests
pnpm --filter @mednova/api test
pnpm --filter @mednova/worker test

# Frontend type check
pnpm typecheck

# Python tests
cd apps/agents && pytest

# Formatting, all checks, and the demo workflow smoke test
cd ../..
pnpm run format:check
pnpm run verify:ci
```

The worker currently provides a lifecycle-only entrypoint. It validates
configuration, reports startup/shutdown, and does not claim or mutate clinical
jobs until the durable worker change is implemented.

The Python service uses LangGraph for the explicit validation, prompt,
provider, and result-classification workflow. LangChain/provider integrations
remain behind this internal dispatch boundary. Agent results are advisory and
always require doctor review; the agent service cannot authenticate users,
make RLS decisions, persist clinical records, or activate prescriptions.

---

## Environment variable reference

All variables accepted by `apps/api` and `apps/worker`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✓ | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | — | Service role key (server-only) |
| `SUPABASE_ANON_KEY` | ✓ | — | Anon key (used for client auth) |
| `API_PORT` | | `3001` | Port the API listens on |
| `API_ORIGIN` | | `http://localhost:5173` | Frontend origin for CORS |
| `CORS_ALLOWED_ORIGINS` | | `API_ORIGIN` | Comma-separated CORS origins |
| `REPORTS_BUCKET_NAME` | | `medical-reports` | Supabase Storage bucket |
| `SIGNED_URL_EXPIRY_SECONDS` | | `300` | Signed URL lifetime |
| `RESEND_API_KEY` | ✓ | — | Resend API key |
| `RESEND_WEBHOOK_SECRET` | | — | Svix/Resend signing secret used to authenticate delivery webhooks |
| `RESEND_FROM_ADDRESS` | ✓ | — | Verified sender email |
| `GEMINI_API_KEY` | ✓ | — | Gemini API key (server-only) |
| `GEMINI_MODEL` | | `gemini-1.5-pro` | Model identifier |
| `AGENTS_SERVICE_URL` | ✓ | — | Python agent service base URL |
| `AGENTS_INTERNAL_SECRET` | ✓ | — | Shared secret for API↔Agents auth |
| `DEMO_MODE` | | `false` | Enable seed routes and mock fallbacks |
| `WORKER_POLL_INTERVAL_MS` | | `5000` | Job poll interval |
| `WORKER_MAX_CONCURRENT_JOBS` | | `5` | Max parallel job execution |

> **Security**: Never log, commit, or expose `SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
> `GEMINI_API_KEY`, or `AGENTS_INTERNAL_SECRET`. All secrets stay server-side only.

## Security review controls

The API enforces the following controls before demo or production deployment:

- Report upload, listing, review, and signed-link requests use the shared patient
  authorization policy; storage paths must be scoped to the authorized patient.
- Dose events are patient-owned, restricted to patient accounts, and validate the
  schedule-to-patient relationship before insertion.
- Prescription rejection requires an active doctor assignment, matching the
  approval workflow.
- Resend webhooks verify Svix signatures and timestamps when
  `RESEND_WEBHOOK_SECRET` is configured outside demo mode, and terminal delivery
  states cannot be downgraded by replayed events.

The API/backend owner is responsible for keeping these checks covered by route
tests when schema or provider integrations change.
