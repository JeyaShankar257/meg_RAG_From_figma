# Tasks: Real Data Integration for Doctor Patient Clinical Tabs

## 1. Backend Binary Adherence & Trend Projection

- [x] 1.1 Update `GET /patients/:id/adherence` in `apps/api/src/routes/patients/index.ts` to calculate adherence score strictly using `taken` and `missed` doses, eliminating `late` and `skipped` from totals and ratios. Verify with `patientPortalWorkflows.test.ts`.
- [x] 1.2 Extend `GET /patients/:id/adherence` to return a 90-day binary `heatmapData` array (`{ date: string, status: "taken" | "missed" }[]`) and 3-month periodic `sparklineData` array (`{ date: string, value: number }[]`). Verify response payload structure in API tests.

## 2. Shared Types & API Client Integration

- [x] 2.1 Update `PatientAdherence` and related types in `src/lib/types.ts` to reflect the binary adherence schema (`takenCount`, `missedCount`, `heatmapData`, `sparklineData`) and remove `lateCount` / `skippedCount` requirements. Verify with `pnpm run typecheck`.
- [x] 2.2 Verify and ensure `api.patients.getAdherence(patientId)` is exposed in `src/lib/api/apiClient.ts` with correct typings and fallback behavior. Verify in client test suite.

## 3. Patient Clinical Workspace Real-Data Integration (`PatientPage.tsx`)

- [x] 3.1 Update the initial loading flow in `PatientPage.tsx` to fetch adherence via `api.patients.getAdherence(patientId)` concurrently with patient profile, visits, reports, and prescriptions. Verify parallel dispatch on mount.
- [x] 3.2 Update **Overview Tab**: Wire live adherence score ring, binary taken vs missed stat breakdown, and server sparkline chart to live state, eliminating all uses of `DEMO_ADHERENCE` and `DEMO_SPARKLINE`. Verify rendering and empty state.
- [x] 3.3 Update **Adherence Tab**: Remove all `late` and `skipped` cards and UI logic; wire `<DoseHeatmap />` to server `heatmapData`, and connect live AI root-cause analysis (replacing static `DEMO_AI_ANALYSIS`). Verify binary visualization.
- [x] 3.4 Verify **Visits Tab** and **Reports Tab**: Ensure timeline encounters and uploaded records use live API state, with graceful empty states, error retry banners, and functional review/reindex mutations.
- [x] 3.5 Verify **AI Assistant Tab** and **Prescription Tab**: Ensure live binary adherence metrics are injected into RAG context preview, AI suggestions approve into the database, and in-line prescription edits append audited revisions.

## 4. End-to-End Verification & Validation

- [x] 4.1 Run full TypeScript typecheck (`pnpm run typecheck`) to ensure zero contract mismatches or broken prop types across frontend and backend.
- [x] 4.2 Run API automated tests (`npm run test:api`) to verify binary adherence calculations, security authorization guards, and prescription approval workflows.
