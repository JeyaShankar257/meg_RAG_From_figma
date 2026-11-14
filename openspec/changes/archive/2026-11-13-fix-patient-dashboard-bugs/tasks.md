# Tasks

## 1. Backend Adherence Correction

- [x] 1.1 Fix `skippedCount` in `apps/api/src/routes/patients/index.ts`: return the dynamic `skippedCount` instead of hardcoded `0` in `GET /patients/:id/adherence`. Verify by running `pnpm --filter @mednova/api test`.

## 2. Frontend Dashboard Bug Fixes

- [x] 2.1 In `src/pages/patient/Dashboard.tsx`, replace premature zero-stat card rendering with a clean skeleton/loading state while `loading` is true. Verify no zero values flash on initial mount.
- [x] 2.2 Cross-reference active medications with `scheduleResult.schedules` in `Dashboard.tsx` to dynamically compute and display real next dose times (e.g. "Today at 09:00 AM", "Completed today") instead of static "See dose schedule".
- [x] 2.3 Update the hero next dose card when all scheduled doses for today are completed to show "All doses completed for today!".
- [x] 2.4 Add an empty state placeholder card in the "Current Medications" section when `activeMeds.length === 0`.
- [x] 2.5 Fix streak text pluralization (`1 day on track` vs `X days on track`) and remove unused import `isBackendConfigured`.

## 3. Verification

- [x] 3.1 Run `pnpm typecheck` and `pnpm run format:check` to ensure 0 TypeScript compilation or linting issues.
- [x] 3.2 Run `pnpm -r test` to verify all backend and worker unit/integration tests pass.
