# Tasks: Medication Start and End Date Lifecycle

## Phase 1: Database and Contracts
- [x] 1.1 Create migration `supabase/migrations/0007_medication_dates_and_lifecycle.sql` adding `start_date`, `end_date`, and `duration_days` to `medications` and `prescriptions`.
- [x] 1.2 Update types in `src/lib/types.ts` and Zod validation in `apps/api/src/routes/prescriptions/index.ts` to include optional `startDate` and `endDate`.

## Phase 2: Backend API Implementation
- [x] 2.1 In `apps/api/src/routes/prescriptions/index.ts`:
  - Calculate `startDate` and `endDate` from `validated.editedValues` / `suggestion`.
  - Persist `start_date`, `end_date`, and `duration_days` into `medications` and `prescriptions`.
  - Bound dose schedule loop to `medDays` (not hardcoded 30).
- [x] 2.2 In `apps/api/src/routes/patients/index.ts`:
  - Filter `GET /patients/:id/medications` to only include medications where `end_date is null OR end_date >= today`.
  - Return `startDate`, `endDate`, and `durationDays` in the response items.

## Phase 3: Doctor and Patient Portal Frontend
- [x] 3.1 Update `src/components/doctor/rag/PrescriptionSuggestionCard.tsx` to add `startDate` and `endDate` fields with auto-calculation.
- [x] 3.2 Update `src/pages/doctor/PatientPage.tsx` to pass `startDate` and `endDate` during AI suggestion approval.
- [x] 3.3 Update `src/pages/patient/Dashboard.tsx` to display course duration (e.g. "Day X of Y · Ends Nov 19") on active medication cards.

## Phase 4: Verification
- [x] 4.1 Run `pnpm typecheck` to confirm 0 compilation errors.
- [x] 4.2 Run `pnpm -r test` to verify all API and worker tests.
- [x] 4.3 Run `pnpm run test:frontend` to verify all client tests.
- [x] 4.4 Run `pnpm run format:check` to ensure oxfmt compliance.
