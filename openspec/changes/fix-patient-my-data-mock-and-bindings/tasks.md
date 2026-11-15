# Tasks: Fix Patient Portal My Data Mock and Bindings

## Phase 1: Contracts and Backend APIs
- [x] 1.1 In `packages/contracts/src/index.ts` and `src/lib/types.ts`:
  - Add optional `totalAssignedCount` to `PatientAdherenceSummary`.
- [x] 1.2 In `apps/api/src/routes/patients/index.ts`:
  - Return `totalAssignedCount` in `GET /patients/:id/adherence`.
  - In `GET /patients/:id/transparency`:
    - Calculate dynamic `assuranceScore` based on adherence and consent.
    - Format audit action descriptions into human-readable text.
    - Use real timestamps (`consent.updated_at`, audit `occurred_at`) for trust signals.
- [x] 1.3 In `src/lib/api/apiClient.ts`:
  - Clean up fallback demo data in `getTransparency` and `getConsent`.

## Phase 2: Frontend "My Data" Page Refactoring
- [x] 2.1 In `src/pages/patient/Transparency.tsx`:
  - Refactor `consentMap` state and UI to map 1-to-1 with `consent_records` (`share_with_care_team`, `allow_reminders`, `allow_ai_analysis`).
  - Eliminate the fake "escalations" toggle.
  - Dynamically calculate and display the real `trustScore` from adherence and verified consent without hardcoded 98/95 fallbacks.
  - Replace the fake "Delivery failures" box in "Scheduled vs. Logged" with real Skipped Doses count and note.
  - Add an empty state card for the Care Team Access Audit trail when no events exist.
  - Verify all strings containing apostrophes use double quotes and format with oxfmt.

## Phase 3: Verification
- [x] 3.1 Run `pnpm typecheck` to confirm 0 TypeScript errors.
- [x] 3.2 Run `pnpm -r test` to verify API and worker tests.
- [x] 3.3 Run `pnpm run test:frontend` to verify all client tests.
- [x] 3.4 Run `pnpm run format:check` to ensure oxfmt compliance.
