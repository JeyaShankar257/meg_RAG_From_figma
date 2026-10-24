# Tasks: 4-Stage Closed-Loop Care Team Adherence Pipeline

## 1. Database & Schema Migration

- [x] 1.1 Add emergency guardian columns (`guardian_name`, `guardian_email`, `guardian_phone`) to `patients` table via Supabase migration and verify with migration query.
- [x] 1.2 Update pipeline stage keys in backend types and schema to represent the 4 canonical stages (`reminder_agent`, `pattern_detection_agent`, `patient_warning_agent`, `sos_agent`).

## 2. Backend Orchestration & Endpoints

- [x] 2.1 Implement end-of-day daily pattern evaluation endpoint (`POST /doctor/patients/:patientId/evaluate-daily-pattern`) in `apps/api/src/routes/doctor/index.ts` and verify with API test.
- [x] 2.2 Implement Level 1 Patient Health Warning generator with drug-specific risk summary and Resend/capture email dispatch and verify in test suite.
- [x] 2.3 Implement Level 2 Doctor & Guardian SOS escalation logic, creating urgent escalation records and dispatching guardian SOS alerts.
- [x] 2.4 Implement clinical escalation response endpoint (`POST /doctor/escalations/:id/respond`) supporting `telehealth`, `nurse_call`, `adjust_medication`, and `acknowledge`.
- [x] 2.5 Update `GET /doctor/patients/:patientId/pipeline` to project the 4 canonical stages and bounded logs from database state.

## 3. Frontend Care Team Page

- [x] 3.1 Refactor `src/pages/doctor/CareTeamPage.tsx` visualizer to render the 4-tier closed-loop stepper with active status indicators.
- [x] 3.2 Add interactive `[⚡ Run Daily Check Now]` button on `CareTeamPage.tsx` to trigger immediate daily evaluation for demos and testing.
- [x] 3.3 Upgrade the Care Team escalation banner to render the Urgent Red SOS alert with 1-click doctor action buttons (`[Schedule Urgent Telehealth]`, `[Nurse Outreach]`, `[Adjust Meds]`, `[Acknowledge]`).
- [x] 3.4 Connect the live dark terminal console to stream real logs for each of the 4 stages.

## 4. Verification & Test Suite

- [x] 4.1 Add automated test coverage in `apps/api/src/routes/doctorPortalWorkflows.test.ts` for daily pattern evaluation, Level 1 warnings, and Level 2 SOS actions.
- [x] 4.2 Verify project builds and typechecks cleanly with `corepack pnpm exec tsc --noEmit` and `corepack pnpm build`.
