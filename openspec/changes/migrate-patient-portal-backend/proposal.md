# Proposal

## Why

Following the completion of `setup-backend-infrastructure`, `migrate-doctor-portal-backend`, and `complete-controlled-authentication`, the patient portal (`/patient/*`) remains in a hybrid state where dose schedules, adherence aggregates, visits, trust transparency metrics, and communication preferences still partly rely on mock fixtures (`DEMO_PRESCRIPTIONS`, `DEMO_ADHERENCE`, `DEMO_VISITS`, `DEMO_TRUST_COMPONENTS`). Migrating the patient portal to server-authoritative APIs ensures that patients interact with their real clinical records backed by the 3-tier identity model (`auth.users` -> `public.profiles` -> `public.patients`), submit idempotent dose events with valid UUID schedules, view accurate adherence streaks, manage consent securely, and retain functional fallback boundaries exclusively for unconfigured local development.

## What Changes

- **Server-Authoritative Dose Scheduling & Logging**: Replace ad-hoc prescription parsing in `DoseCenter` with authoritative daily dose schedule queries (`GET /patients/:id/dose-schedules?date=YYYY-MM-DD`) and idempotent dose confirmation/skip logging (`POST /doses` with `scheduleId` UUID and client-generated `idempotencyKey`) with server timestamps and audit records.
- **Backend-Derived Adherence & Streaks**: Replace static adherence rings and trend sparklines in `PatientDashboard` and `Transparency` with live server-calculated adherence metrics, rolling completion rates (`takenPercentage`, `latePercentage`, `missedCount`), and current streak calculations from `GET /patients/:id/adherence`.
- **Authenticated Patient Visits View**: Ensure `VisitsPage` displays only the authenticated patient's clinical visit records with consent-filtered notes and verifiable provider attributions via `GET /patients/:id/visits`.
- **Granular Consent & Transparency Management**: Wire `TransparencyPage` consent toggles (care team sharing, escalation sharing, AI analysis participation) directly to the persistent consent API (`/patients/:id/consent`), and replace static trust metrics with dynamic system assurance signals and audit access events via `GET /patients/:id/transparency`.
- **Patient Notification & Quiet Hours Preferences**: Persist patient notification channels (email, sms, push) and quiet-hour windows through authenticated endpoints (`/patients/:id/settings`).
- **Live Identity in Patient Shell**: Update `PatientShell` to dynamically display the authenticated patient's profile name and initials from `authStore`, reserving the "Demo" badge strictly for unconfigured local demo mode.
- **Strict Patient-Boundary Authorization**: Enforce in Hono API middleware that callers with role `patient` can only query/mutate their own matching `patientId` (with `patientStatus === 'active'`).
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
- **Backend API (Hono)**:
  - `apps/api/src/routes/doses/index.ts` (idempotent dose logging endpoint `POST /doses`)
  - `apps/api/src/routes/patients/index.ts` (implement `GET /patients/:id/dose-schedules`, computed `GET /patients/:id/adherence`, `GET /patients/:id/transparency`, and strict patient authorization guards)
- **Contracts & Types**:
  - Shared patient dashboard, dose schedule, adherence, and transparency response types in `packages/contracts` and `packages/types`.
- **Security & Authorization**:
  - Strict patient isolation (patients can only access their own data via verified token claims `patientId` and active status; cross-patient requests rejected).
  - All clinical mutations (dose logging, consent revocation) stay server-side and trigger immutable audit log entries.
- **Compatibility**:
  - Development demo mode preserved without regression when backend environment variables are absent.
