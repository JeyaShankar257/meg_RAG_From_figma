# Proposal

## Why

MedNova has hosted Supabase authentication code, but the end-to-end administrator,
doctor, and patient workflows require a single, robust contract across Auth,
database records, backend authorization, and frontend portals. Recent testing
exposed incomplete profile provisioning, redirect drift, RLS failures, email
rate-limit handling, and unclear doctor password ownership.

This change aligns MedNova with the comprehensive **MedNova Authentication and
Authorization Implementation Plan**:
- **Supabase Auth** establishes identity and handles credentials, invitations, and sessions.
- The **Backend API** enforces authorization, workspace boundaries, clinical safety, and lifecycle state.
- **PostgreSQL & Row Level Security (RLS)** enforce database-level access boundaries.
- **Immutable Audit Events** record security-relevant lifecycle mutations without logging secrets.

## What Changes

- Implement the **3-tier identity architecture**:
  1. *Auth Identity* (Supabase Auth user, credentials, confirmation, session).
  2. *Application Profile* (`public.profiles`, workspace, role, approval status, password requirements).
  3. *Clinical Patient Record* (`public.patients`, server-generated ID, doctor assignment, consent).
- Administrator-controlled doctor provisioning, approval/rejection lifecycle, and temporary-password enforcement.
- Invitation-only patient registration by authorized doctors, followed by patient-driven activation and password setup.
- Standardized, allow-listed Supabase redirect URLs (`/doctor/activate` and `/activate`).
- Explicit server-only credentials separating Auth Admin operations (`SUPABASE_SECRET_KEY`) from database operations (`SUPABASE_SERVICE_ROLE_KEY`).
- Compensating rollback and auditable orphan reconciliation when partial provisioning occurs.
- Actionable error mapping for rate limits (429), duplicates (409), expired tokens (401), and authorization failures (403).
- Dedicated Administrator account management surface in the frontend.
- Elimination of silent mock-data fallbacks in live mode (`DEMO_MODE=false`).

## Capabilities

### New Capabilities
- `controlled-authentication`: Administrator, doctor, and patient account provisioning, invitation activation, approval, password lifecycle, session enforcement, and operational error handling.

### Modified Capabilities
- `clinical-backend`: Protected portal access must use the completed account lifecycle and must not expose clinical operations to unverified, unapproved, unprovisioned, wrong-portal, or cross-workspace accounts.

## Impact

- **Frontend:** Login and session guards, portal-specific activation routes with single-use fragment parsing, password change UX, administrator doctor management UI, and actionable error states.
- **Backend:** Auth routes, middleware, Supabase Auth Admin and database clients, compensating rollback, status error mapping, and audit logging.
- **Data:** `profiles.approval_status`, `profiles.must_change_password`, `patients.activated_at`, hardened `provision_invited_profile`, `activate_patient_account`, and `reconcile_workspace_orphans`.
- **Security:** Strict credential separation, search_path-hardened functions, RLS safety, token fragment clearance, and complete exclusion of passwords/tokens from logs and audit records.
