# Proposal: Separate Admin Portal

## Why
Currently, clinical administration capabilities (physician onboarding, invitation dispatch, pending approvals, temporary credential setup, and orphan reconciliation) are embedded inside the Doctor portal at `/doctor/admin/accounts` and surfaced in the doctor navigation sidebar. This mixes administrative system governance with daily clinical physician workflows. A dedicated administrator portal with its own entry point, shell, and roster of active and pending physicians clarifies role boundaries, prevents clinical UI clutter, and enforces least-privilege portal access.

## What Changes
- **Remove Admin Features from Doctor Portal**:
  - Remove administrative navigation links from `DoctorShell.tsx`.
  - Remove `/doctor/admin/accounts` from `App.tsx` and delete the embedded `AdminDoctorManagement.tsx` component from `src/pages/doctor/`.
  - Ensure the Doctor portal is strictly focused on clinical patient care, prescriptions, AI assistant reviews, and escalations.
- **Dedicated Admin Authentication & Portal Entry**:
  - Add `/admin/login` dedicated authentication page with administrative styling and security messaging.
  - Add a dedicated **Admin Portal** card to `Landing.tsx` alongside Doctor and Patient logins.
  - Update `PortalRole` and auth contracts to support `admin` portal login explicitly (`portal: "admin"`).
- **Dedicated Admin Shell & Application Layout**:
  - Introduce `src/components/admin/AdminShell.tsx` with dedicated navigation (Physicians Roster, Provisioning, Orphan Reconciliation, Audit Logs, Settings).
  - Enforce strict `RequireRole role="admin"` boundary on `/admin/*` routes.
- **Comprehensive Physician Roster & Governance View**:
  - Create `src/pages/admin/AdminDashboard.tsx` displaying:
    - **Active & Existing Working Doctors**: Name, email, department/specialization, license, approval status (`approved`), temporary password status, and workspace details.
    - **Pending Doctor Approvals**: Fast-action buttons to Approve or Reject newly invited or registered doctors.
    - **Physician Provisioning**: Modal to invite new doctors with optional temporary password and activation email toggles.
    - **Temporary Credential Management**: Set or reset temporary passwords for existing accounts with mandatory password rotation on first login.
    - **Orphan Reconciliation**: Direct table displaying unlinked clinical patients, dangling profiles, and orphaned auth accounts with one-click cleanup.
- **Backend API Alignment**:
  - Accept `portal: "admin"` in `apps/api/src/routes/auth/index.ts` login route, verifying the authenticating user holds the `admin` role.

## Capabilities

### New Capabilities
- `admin-portal`: Dedicated administration portal providing standalone authentication (`/admin/login`), role-gated navigation (`/admin/*`), active doctor directory roster, physician provisioning/approvals, temporary credential lifecycle, and orphan reconciliation.

### Modified Capabilities
- `doctor-portal-backend-workflows`: Remove administrative account management from the doctor portal requirements to keep doctor workflows purely clinical.

## Impact
- **Frontend**:
  - `src/App.tsx`: Add `/admin/login` and `/admin/*` routes; remove `/doctor/admin/accounts`.
  - `src/pages/Landing.tsx`: Add Admin Portal login card.
  - `src/components/doctor/DoctorShell.tsx`: Remove `Administration` / `Doctor Accounts` nav item.
  - `src/pages/doctor/AdminDoctorManagement.tsx`: Deleted in favor of new `src/pages/admin/AdminDashboard.tsx`.
  - `src/components/admin/AdminShell.tsx`: New component.
  - `src/pages/admin/Login.tsx`: New component.
  - `src/pages/admin/AdminDashboard.tsx`: New component.
  - `src/lib/api/apiClient.ts` & `src/lib/auth/SessionProvider.tsx`: Support `"admin"` in `PortalRole`.
- **Backend**:
  - `apps/api/src/routes/auth/index.ts`: Update `loginSchema` portal enum to include `"admin"` and validate that `portal === "admin"` accounts possess the `admin` role.
- **Data & Security**:
  - Strict role-based isolation between clinical users (`doctor`, `care_team`), patients (`patient`), and system administrators (`admin`).
