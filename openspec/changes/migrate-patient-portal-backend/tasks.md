# Tasks

## 1. Data and Contract Foundations

- [x] 1.1 Add shared API contracts and domain types for patient daily dose schedules (`GET /patients/:id/dose-schedules`), server-calculated adherence streaks (`GET /patients/:id/adherence`), visit summaries, and transparency trust signals (`GET /patients/:id/transparency`) in `packages/contracts` and `packages/types`; verify typecheck compiles across packages.
- [x] 1.2 Define request/response fixtures for patient dose schedules with UUIDs, computed adherence analytics, consent grants, and idempotent dose logs in `packages/contracts/fixtures`; verify contract test fixtures validate against schemas.

## 2. Backend Patient Workflows *(requires backend availability)*

- [x] 2.1 Add `authorizePatientAccess` middleware in `apps/api/src/routes/patients/index.ts` to enforce that patients can only access their own active records (`user.patientId === :id` and `user.patientStatus === 'active'`); verify unauthorized requests are rejected with 403/404.
- [x] 2.2 Implement `GET /patients/:id/dose-schedules?date=YYYY-MM-DD` resolving active prescriptions and daily dose schedule slots with matching dose logs; verify API returns expected schedule entries with UUIDs.
- [x] 2.3 Implement server-calculated `GET /patients/:id/adherence` returning taken, late, missed, skipped counts, completion percentages, streak days, and trend indicators; verify unit tests against dose log fixtures.
- [x] 2.4 Implement `GET /patients/:id/transparency` returning verifiable consent status, recent access audit records, and assurance indicators; verify API returns expected data for authenticated patient.
- [x] 2.5 Ensure `POST /doses` verifies caller patient identity, validates schedule UUID and `idempotencyKey`, updates dose schedule status, and creates an immutable audit event; verify duplicate idempotency keys return the canonical original response.
- [x] 2.6 Add backend unit/integration tests for patient schedule resolution, dose idempotency, adherence aggregates, consent enforcement, and secret-safe error responses; verify all `@mednova/api` tests pass.

## 3. Frontend Patient Portal Migration

- [x] 3.1 Extend `src/lib/api/apiClient.ts` with typed methods for `api.patients.getDoseSchedules`, `api.patients.getAdherence`, `api.patients.getTransparency`, and ensure `api.doses.log` passes UUID `scheduleId` and `idempotencyKey`; verify API client tests cover success, retryable errors, and correlation IDs.
- [x] 3.2 Update `src/pages/patient/DoseCenter.tsx` to load server-authoritative dose schedules, use UUID schedule IDs and client `crypto.randomUUID()` idempotency keys for single-tap dose logging, and provide resilient error/retry states; verify demo mode remains functional when backend is unconfigured.
- [x] 3.3 Update `src/pages/patient/Dashboard.tsx` to consume live adherence percentages, streak counts, and next scheduled dose from `api.patients.getAdherence`; verify fallback to demo metrics is restricted to unconfigured demo mode.
- [x] 3.4 Update `src/pages/patient/Visits.tsx` to handle loading, empty, and error states over authenticated visits with consent notices; verify visits render correctly in both backend and demo modes.
- [x] 3.5 Update `src/pages/patient/Transparency.tsx` to query live `api.patients.getTransparency`, persist consent toggles with immediate UI feedback, and display real audit logs; verify save failures preserve prior state with recoverable error alerts.
- [x] 3.6 Update `src/components/patient/PatientShell.tsx` to dynamically display authenticated patient name/initials from `authStore` and only show the "Demo" badge when running in unconfigured demo mode.
- [x] 3.7 Add frontend tests for patient dose schedule rendering, idempotent dose logging, adherence metric display, consent toggles, and bounded demo fallback; verify `pnpm test:frontend` passes.

## 4. Verification and Integration

- [x] 4.1 Update demo seeds and test scripts in `apps/api/src/scripts/` to include comprehensive patient dose schedules, adherence histories, and audit records; verify seed scripts run cleanly without exposing secrets.
- [x] 4.2 Run end-to-end patient workflow verification covering login, dose schedule retrieval, dose logging with idempotency, adherence calculation, and settings round-trip; verify all integration assertions pass.
- [x] 4.3 Run full project verification (`pnpm typecheck`, `format:check`, API/worker/frontend tests, and production build); verify zero regressions across the codebase.
