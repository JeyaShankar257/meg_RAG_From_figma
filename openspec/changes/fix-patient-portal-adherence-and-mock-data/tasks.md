# Tasks

## 1. Backend — Progressive Adherence Calculation Starting at 0%

- [ ] 1.1 Update `GET /patients/:id/adherence` in `apps/api/src/routes/patients/index.ts`: query `dose_schedules` where `scheduled_at <= now()`. If assigned count is 0, return `score: 0`. Otherwise compute `score = Math.min(100, Math.round((takenCount / assignedCount) * 100))`.
- [ ] 1.2 Update `evaluateDailyPatternForPatient` in `apps/api/src/services/adherencePipelineService.ts`: start adherence score from 0 when no doses have been taken yet.
- [ ] 1.3 Update/add API tests in `apps/api/src/routes/patientPortalWorkflows.test.ts` to assert a new patient starts at 0% and increases as doses are taken.

## 2. Frontend — Dashboard Dynamic Content & Trend Sparkline

- [ ] 2.1 Update `src/pages/patient/Dashboard.tsx`: fetch visits in `Promise.all` and dynamically display the latest clinical note, doctor name, and doctor initials in the Care Team message card. Hide the card if no visit exists.
- [ ] 2.2 In `src/pages/patient/Dashboard.tsx`: feed real weekly adherence trend points from `adherenceResult.sparklineData` into `<TrendSparkline>` instead of static placeholder text.

## 3. Frontend — Transparency & Reports Cleanup

- [ ] 3.1 Update `src/pages/patient/Transparency.tsx`: remove hardcoded `98%` fallback for assurance score. Fix consent toggle field mapping to reference proper consent permissions.
- [ ] 3.2 Update `src/pages/patient/Reports.tsx`: remove `localStorage` base64 fallback so all report interactions use the live backend API and Supabase Storage.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck` to verify no TypeScript compilation errors across the monorepo.
- [ ] 4.2 Run `pnpm test` in `apps/api` to verify all adherence tests pass.

