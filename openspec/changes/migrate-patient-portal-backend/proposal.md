# Proposal

## Why

Following the completion of `setup-backend-infrastructure` and `migrate-doctor-portal-backend`, the patient portal (`/patient/*`) remains in a hybrid state where dose schedules, adherence aggregates, visits, trust transparency metrics, and communication preferences rely on hardcoded demo data (`DEMO_PRESCRIPTIONS`, `DEMO_ADHERENCE`, `DEMO_VISITS`, `DEMO_TRUST_COMPONENTS`). Migrating the patient portal to server-authoritative APIs ensures that patients interact with their real, authenticated clinical records, submit idempotent dose events, view accurate adherence streaks, manage consent securely, and retain functional fallback boundaries exclusively for unconfigured local development.

## What Changes

- **Server-Authoritative Dose Scheduling & Logging**: Replace ad-hoc prescription parsing in `DoseCenter` with authoritative dose schedule queries (`/patients/:id/dose-schedules` or dose schedule endpoints) and idempotent dose confirmation/skip logging with server timestamps and audit records.
- **Backend-Derived Adherence & Streaks**: Replace static adherence rings and trend sparklines in `PatientDashboard` and `Transparency` with live server-calculated adherence metrics, rolling completion rates, and streak calculations.
- **Authenticated Patient Visits View**: Ensure `VisitsPage` displays only the authenticated patient's clinical visit records with consent-filtered notes and verifiable provider attributions.
- **Granular Consent & Transparency Management**: Wire `TransparencyPage` consent toggles (care team sharing, escalation sharing, AI analysis participation) directly to the persistent consent API (`/patients/:id/consent`), and replace static trust metrics with dynamic system assurance signals.
- **Patient Notification & Quiet Hours Preferences**: Persist patient notification channels (email, sms, push) and quiet-hour windows through authenticated endpoints (`/patients/:id/settings`).
- **Bounded Development Demo Fallback**: Isolate demo mock fixtures so that development demo mode continues to work seamlessly without backend services, while production and backend-configured modes strictly surface loading, empty, unavailable, and recoverable error states.

## Capabilities

### New Capabilities
- `patient-portal-backend-workflows`: Authenticated patient portal workflows including authoritative dose schedule queries, reliable idempotent dose event submission, server-derived adherence aggregates and streak metrics, authorized visit history, patient consent controls, trust and transparency display, and notification preference persistence.

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend**:
  - `src/pages/patient/Dashboard.tsx`
  - `src/pages/patient/DoseCenter.tsx`
  - `src/pages/patient/Visits.tsx`
  - `src/pages/patient/Transparency.tsx`
  - `src/pages/patient/Settings.tsx`
  - `src/components/patient/PatientShell.tsx`
  - `src/lib/api/apiClient.ts`
- **Backend API**:
  - `apps/api/src/routes/doses/index.ts`
  - `apps/api/src/routes/patients/index.ts`
  - New or extended patient-facing summary endpoints for adherence streaks and schedule slots.
- **Contracts & Types**:
  - Shared patient dashboard and dose schedule response types in `packages/contracts` and `packages/types`.
- **Security & Authorization**:
  - Strict patient isolation (patients can only access their own data via verified token claims; non-patient or unassigned clinician tokens rejected).
  - All clinical mutations (dose logging, consent revocation) stay server-side and trigger immutable audit log entries.
- **Compatibility**:
  - Development demo mode preserved without regression when backend environment variables are absent.
