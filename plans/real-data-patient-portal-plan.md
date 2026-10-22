# Real Data Patient Portal Plan

## Purpose

Replace mock and fixed values in the existing doctor patient workflow with the existing API and database data flow. This plan does not introduce a new architecture, new pages, or new data sources.

The project goal is to give doctors a reliable, patient-scoped clinical view while keeping AI advisory only and requiring doctor review before clinical action.

## Existing Data Rules

- Database records are the source of truth.
- The API performs authorization and business calculations.
- The frontend displays API responses and does not calculate a second version of clinical metrics.
- Mock data is used only when backend mode is explicitly disabled.
- Patient, visit, prescription, dose, report, and AI records remain scoped to the same patient and workspace.

## Phase 1 Implementation Status: Complete & Archived

- **OpenSpec Change:** `2026-10-21-real-data-doctor-patient-tabs` (Archived & specs synced)
- **Backend Binary Adherence:** Implemented in `apps/api/src/routes/patients/index.ts` with strict $\frac{\text{taken}}{\text{taken} + \text{missed}}$ calculation and server projections for 84-day (12-week) binary `heatmapData` and 12-week periodic `sparklineData`.
- **Frontend Workspace:** All 6 tabs in [PatientPage.tsx](file:///d:/meg_RAG_From_figma/src/pages/doctor/PatientPage.tsx) fully wired to real endpoints (`api.patients.get`, `getVisits`, `getAdherence`, `getPrescriptions`, `reports.list`, `escalations.list`, `careTeam.list`).
- **Tests & Quality:** All 103 backend API tests, all 43 frontend tests, and TypeScript compiler checks pass with 0 errors.

## Phase 2 Implementation Status: Complete & Archived

- **OpenSpec Change:** `2026-10-21-hybrid-ai-assistant-mcp` (Archived & specs synced)
- **MCP Client & Medical Tools:** Implemented `apps/api/src/services/mcp/` (`openFdaTool.ts`, `clinicalGuidelinesTool.ts`, `mcpClient.ts`) with bounded 2.5s timeout guarantee and offline fallback.
- **Hybrid RAG Orchestration:** Updated `POST /doctor/patients/:patientId/ai-analyses` in `apps/api/src/routes/doctor/index.ts` to execute live MCP tools for external clinical practice guidelines and OpenFDA drug-drug interaction safety checks.
- **UI Enhancements:** Updated [RetrievedEvidence.tsx](file:///d:/meg_RAG_From_figma/src/components/doctor/rag/RetrievedEvidence.tsx) to render dual-tier badges (`[Patient Record]` vs `[External Literature (MCP)]` with clickable provenance links) and [PrescriptionSuggestionCard.tsx](file:///d:/meg_RAG_From_figma/src/components/doctor/rag/PrescriptionSuggestionCard.tsx) to display live FDA safety verification pills and high-visibility contraindication warnings.
- **Tests & Quality:** All 109 backend tests (11 test files), all 43 frontend tests, and TypeScript compiler check pass with 0 errors.


## 1. Patient Overview

**Page:** `/doctor/patients/:patientId`

### Existing data sources

- Patient profile: existing patient API and `patients` table.
- Visits: existing `GET /patients/:id/visits` endpoint and `visits` table.
- Prescriptions: existing patient prescriptions endpoint and `prescriptions`/`medications` tables.
- Adherence: existing `GET /patients/:id/adherence` endpoint and dose data.
- Reports: existing reports API and `patient_reports` table.

### Current problem

`PatientPage` loads the patient, visits, reports, and prescriptions, but does not load adherence. The Overview tab therefore displays:

- `patient.adherenceScore`, which remains `0`.
- `DEMO_ADHERENCE` for Taken and Missed.
- `DEMO_SPARKLINE` for the three-month chart.

### Existing-flow correction

Add the existing adherence request to the current patient page loading flow:

```text
get patient
get visits
get adherence
get reports
get prescriptions
```

Use the returned adherence object for:

- Patient header trust/adherence badge.
- Overview adherence score.
- Taken and missed counts.
- Three-month trend.
- AI Assistant patient context.

Remove the Overview tab's use of `DEMO_ADHERENCE` and `DEMO_SPARKLINE` when backend mode is enabled.

## 2. Visits Tab

### Existing data source

```text
GET /patients/:id/visits
```

The API reads the `visits` table, verifies patient access, and sorts records by `visit_date` descending.

### Existing processing

1. The page requests visits for the selected patient.
2. The API authorizes the request.
3. The API returns the patient's visits.
4. The page renders the timeline and expandable clinical details.

### Required behavior

- Keep the current visits endpoint and timeline UI.
- Remove the initial mock flash when backend mode is enabled.
- Refetch the existing visits list after a visit is created or edited.
- A visit should not directly change adherence.
- A visit should be included in the next AI context because symptoms, notes, plan, and outcome are clinically relevant evidence.

## 3. Adherence Tab

### Existing data sources

- `dose_schedules`: expected doses.
- `dose_logs`: patient dose outcomes.
- `notifications`: reminder delivery information where available.
- Existing endpoint: `GET /patients/:id/adherence`.

### Existing processing

The API currently reads recent dose logs and calculates taken, late, missed, skipped, score, trend, and streak values.

The frontend must use this one response for both Overview and Adherence tabs.

### Calculation rule

```text
successful doses = taken + late
unsuccessful doses = missed + skipped
score = successful doses / (successful doses + unsuccessful doses) * 100
```

For the currently displayed example:

```text
69 successful doses + 21 missed doses = 90 total doses
69 / 90 * 100 = 76.7% adherence
```

The exact score must come from the API response, not a frontend calculation.

### Existing-flow correction

Replace the Adherence tab's use of:

- `DEMO_ADHERENCE` counts.
- `DEMO_ADHERENCE.heatmapData`.
- `DEMO_ADHERENCE.deliveryFailures`.

with the live adherence response.

If the current API response does not contain enough data for the heatmap or three-month trend, extend that existing response rather than creating a second adherence endpoint. The response should include the date/status series needed by the current chart components.

### Update behavior

Refetch adherence when:

- A patient logs a dose.
- A doctor corrects a dose.
- A scheduled dose passes its grace period.
- A prescription creates or changes dose schedules.
- The patient page opens.
- The existing page refresh/polling mechanism runs.

When there are no dose records, show an explicit empty state instead of presenting `0%` as a calculated clinical score.

## 4. Reports Tab

### Existing data sources

- `patient_reports` for metadata and review state.
- Medical reports storage bucket for files.
- Existing reports list, signed-view, review, and reindex APIs.

### Existing processing

1. Load reports for the patient.
2. Display shared/reviewed state.
3. Open files through signed URLs.
4. Mark reports reviewed through the API.
5. Retry failed indexing through the existing reindex flow.

### AI relationship

Only reports with a successful indexing status should be included in RAG retrieval. Unindexed, failed, unauthorized, or cross-patient reports must not enter the AI context.

## 5. AI Assistant Tab

### Current behavior

The page contains two different AI paths:

1. The static root-cause section renders `DEMO_AI_ANALYSIS`.
2. The interactive RAG Assistant chooses either the existing API adapter or mock adapter based on `VITE_RAG_MODE` and `VITE_DEMO_MODE`.

### Existing live API flow

The existing interactive API endpoint is:

```text
POST /doctor/patients/:patientId/ai-analyses
```

The current backend flow:

1. Validate the request.
2. Authorize the doctor and patient relationship.
3. Check patient AI-consent settings.
4. Retrieve authorized patient evidence.
5. Generate an advisory analysis.
6. Persist the analysis in `ai_analyses`.
7. Persist citations in `ai_citations`.
8. Return the analysis and evidence to the UI.

The current polling hook already polls analysis status while an analysis is pending or running.

### Existing-flow correction

- Configure the existing frontend RAG mode to use the API adapter.
- Replace the static `DEMO_AI_ANALYSIS` card with the existing live analysis state.
- Load the latest saved analysis when the patient page opens if the existing API supports it; otherwise use the existing analysis-by-ID flow after a new request.
- Do not show a mock analysis in backend mode.
- If no analysis exists, show an empty state explaining that the doctor can run an analysis.

### Live AI context

The existing patient context should use:

- Live patient conditions.
- Live active prescriptions.
- Live adherence score and counts.
- Live recent visits.
- Live indexed patient reports.
- Existing consent and authorization state.

The current `patient.adherenceScore` value must not be used until it has been populated from the existing adherence response.

### AI safety behavior

- AI remains advisory only.
- Suggestions require doctor review.
- AI must not directly approve or change prescriptions.
- Every result must retain model version, prompt version, evidence, citations, confidence, safety flags, and review status.

## 6. Prescription Tab

### Existing data sources

- `prescriptions`.
- `medications`.
- `prescription_revisions`.
- Generated `dose_schedules`.

### Existing processing

1. Load prescriptions from the existing API.
2. Allow doctor edits.
3. Require a reason for changes.
4. Save revision history.
5. Approve AI suggestions only after doctor confirmation.
6. Generate or update dose schedules through the existing backend workflow.

### Relationship to adherence

After a prescription changes:

1. The backend updates future dose schedules.
2. Historical logs remain unchanged.
3. Adherence recalculates using the new schedule and existing logs.
4. The current page refreshes prescriptions and adherence.

## 7. Care Team View

### Existing data sources

- Care-team assignments.
- Care grants.
- Escalations.
- Pipeline runs and stage logs.

### Required behavior

- Use live pipeline and escalation data in backend mode.
- Keep mock pipeline data only for explicit demo mode.
- Refresh the care-team view after adherence analysis or escalation changes.
- Use the same live adherence result as the patient page rather than a separate mock score.

## Shared Refresh Behavior

Use the existing API methods and page state. Do not create a second clinical data store in React.

After dose, visit, prescription, report, or AI actions, refetch only the affected existing data:

```text
Dose action       -> adherence, schedules, pipeline
Visit action      -> visits, AI context
Prescription      -> prescriptions, schedules, adherence
Report action     -> reports, AI context
AI action         -> analysis, evidence, pipeline if applicable
```

Use the existing page lifecycle and a bounded refresh interval while the page is active. Upgrade to existing Supabase Realtime infrastructure only if it is already configured in the project; otherwise polling is the smallest compatible behavior.

## Implementation Order

1. Load the existing adherence API in `PatientPage`.
2. Replace mock Overview score, counts, and trend.
3. Replace mock Adherence tab counts and heatmap.
4. Ensure the current visits flow refreshes after visit changes.
5. Pass live adherence into the existing AI context.
6. Enable the existing API RAG adapter.
7. Replace the static mock AI classification with live analysis state.
8. Refresh related existing data after dose, visit, prescription, report, and AI actions.
9. Add focused tests for adherence calculation and mock-data removal.
10. Verify the complete workflow with patient `P-100018`.

## Acceptance Criteria

- Overview no longer displays `DEMO_ADHERENCE` or `DEMO_SPARKLINE` in backend mode.
- Adherence score, Taken, Missed, heatmap, and trend come from the existing API/database flow.
- Visits come from the existing visits endpoint and refresh after changes.
- AI Assistant does not render `DEMO_AI_ANALYSIS` in backend mode.
- AI context contains the real adherence value, not `0%` from the patient summary.
- AI results remain patient-scoped, evidence-grounded, advisory, and doctor-reviewed.
- No new page, database table, or unrelated architecture is introduced.
