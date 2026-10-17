# Tasks

## 1. Data and Contract Foundations

- [ ] 1.1 Add shared API contracts and domain types for patient daily dose schedule queries, adherence streaks, visit summaries with consent markers, and transparency assurances in `packages/contracts` and `packages/types`; verify typecheck compiles across packages.
- [ ] 1.2 Define request/response fixtures for patient dose schedules, adherence calculations, consent grants, and idempotent dose logs in `packages/contracts/fixtures`; verify contract test fixtures validate against schemas.

## 2. Backend Patient Workflows *(requires backend availability)*

- [ ] 2.1 Implement `GET /patients/:id/dose-schedules` resolving active prescriptions, recurrence rules, and matching date-range dose logs with patient token authorization; verify API tests reject unauthorized callers and return expected schedule entries.
- [ ] 2.2 Enhance `POST /doses/log` with idempotency key checking, server timestamp assignment, dose schedule status update, and immutable audit event creation; verify duplicate keys return the cached canonical result without duplicate records.
- [ ] 2.3 Implement `GET /patients/:id/adherence` returning server-calculated taken, late, missed, skipped counts, completion percentages, streak days, and trend indicators; verify unit tests against multi-day dose fixtures.
- [ ] 2.4 Implement `GET /patients/:id/visits` with consent-filtered note redaction and strict patient isolation; verify unauthorized and cross-patient requests are rejected without leaking record existence.
- [ ] 2.5 Implement `GET /patients/:id/transparency` returning verifiable consent state, recent access audit records, and assurance indicators; verify API returns expected data for authenticated patient.
- [ ] 2.6 Add backend unit/integration tests for patient schedule resolution, dose idempotency, adherence aggregates, consent enforcement, and secret-safe error responses; verify all `@mednova/api` tests pass.

## 3. Frontend Patient Portal Migration

- [ ] 3.1 Extend `src/lib/api/apiClient.ts` with typed methods for `api.patients.getDoseSchedules`, `api.patients.getAdherence`, `api.patients.getTransparency`, and enhanced `api.doses.log` with idempotency keys; verify API client tests cover success, retryable errors, and correlation IDs.
- [ ] 3.2 Update `src/pages/patient/DoseCenter.tsx` to load server-authoritative dose schedules, handle single-tap idempotent logging, and provide resilient error and retry states; verify demo mode remains functional when backend is unconfigured.
- [ ] 3.3 Update `src/pages/patient/Dashboard.tsx` to consume live adherence percentages, streak counts, and next scheduled dose from the backend API; verify fallback to demo metrics is restricted to unconfigured demo mode.
- [ ] 3.4 Update `src/pages/patient/Visits.tsx` to handle loading, empty, and error states over authenticated visits with consent notices; verify visits render correctly in both backend and demo modes.
- [ ] 3.5 Update `src/pages/patient/Transparency.tsx` to persist consent toggles with immediate UI feedback and display real audit logs; verify save failures preserve prior state with recoverable error alerts.
- [ ] 3.6 Update `src/pages/patient/Settings.tsx` and `src/components/patient/PatientShell.tsx` to validate notification preferences, quiet hours, and display authenticated patient identity; verify settings reload cleanly after navigation.
- [ ] 3.7 Add frontend tests for patient dose schedule rendering, idempotent dose logging, adherence metric display, consent toggles, and bounded demo fallback; verify `pnpm test:frontend` passes.

## 4. Verification and Integration

- [ ] 4.1 Update demo seeds and test scripts in `apps/api/src/scripts/` to include comprehensive patient dose schedules, adherence histories, and audit records; verify seed scripts run cleanly without exposing secrets.
- [ ] 4.2 Run end-to-end patient workflow verification covering login, dose schedule retrieval, dose logging with idempotency, adherence calculation, and settings round-trip; verify all integration assertions pass.
- [ ] 4.3 Run full project verification (`pnpm typecheck`, `format:check`, API/worker/frontend tests, and production build); verify zero regressions across the codebase.
