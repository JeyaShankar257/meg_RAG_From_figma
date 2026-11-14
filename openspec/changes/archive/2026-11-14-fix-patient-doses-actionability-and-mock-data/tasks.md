# Tasks: Fix Patient Doses Actionability and Mock Data

## Phase 1: Contracts and Backend Enrichment
- [x] 1.1 Update `packages/contracts/src/index.ts` to include optional `medicationName` and `dosage` on `doseLogSchema`.
- [x] 1.2 Update `src/lib/types.ts` to include optional `medicationName` and `dosage` on `PatientAdherenceSummary.logs`.
- [x] 1.3 Update `apps/api/src/routes/patients/index.ts` in `GET /patients/:id/adherence` to select `dose_schedules(scheduled_at, prescriptions(medications(name, dosage)))` and map `medicationName` and `dosage` onto each log entry.

## Phase 2: Frontend Dose Center Fixes
- [x] 2.1 Refactor `src/pages/patient/DoseCenter.tsx` state interfaces to include `isActionable` and `isOverdue` on `DoseEntry`, and define `DoseHistoryItem`.
- [x] 2.2 Fix dose schedule mapping so unrecorded doses (including missed/past-window doses) remain actionable with `isActionable: true`, and show an overdue indicator if past grace window.
- [x] 2.3 Fetch `api.patients.getAdherence(patientId)` concurrently with `getDoseSchedules` and populate the Recent History list with live patient dose logs.
- [x] 2.4 Prepend newly recorded doses to the `history` state inside `handleTake` and `handleSkip` for immediate UI synchronization.
- [x] 2.5 Replace static mock array in Recent History with dynamic rendering of `history` items with formatted date, medication info, and an empty state card when empty.
- [x] 2.6 Add structured skeleton loading state and a styled empty state card when no doses are scheduled today.
- [x] 2.7 Ensure all string literals with apostrophes use double quotes and format with oxfmt.

## Phase 3: Verification
- [x] 3.1 Run `pnpm typecheck` to confirm type correctness across frontend and backend.
- [x] 3.2 Run `pnpm -r test` to verify API and worker unit tests.
- [x] 3.3 Run `pnpm run test:frontend` to verify all client tests.
- [x] 3.4 Run `pnpm run format:check` to ensure oxfmt formatting compliance.
