# Proposal: Real Data Doctor Patient Clinical Tabs

## Why
Currently, several tabs in the Doctor Portal's Patient Clinical Workspace (`/doctor/patients/:patientId`) rely on in-memory mock fixtures (`DEMO_ADHERENCE`, `DEMO_SPARKLINE`, `DEMO_AI_ANALYSIS`, and static fallbacks). Furthermore, the adherence model currently tracks legacy `late` and `skipped` statuses which introduce unnecessary ambiguity. Transitioning all six specialized clinical tabs to authoritative backend APIs with a simplified binary adherence model (`taken` vs `missed`) ensures clinical accuracy, reliability, and clear doctor visibility.

## What Changes
- **Strict Binary Adherence (BREAKING for adherence calculation):**
  - Adherence metrics, scores, streaks, and heatmap data are simplified to strictly **`taken`** and **`missed`** doses.
  - Legacy **`late`** and **`skipped`** statuses are completely removed from calculations, UI cards, and visual charts.
  - Formula: $\text{score} = \frac{\text{taken}}{\text{taken} + \text{missed}} \times 100$.
- **Authoritative Data Integration for All 6 Tabs:**
  - **Overview Tab:** Uses server-calculated adherence score, binary taken/missed totals, active prescriptions, demographics, and rolling 3-month sparkline from the API.
  - **Visits Tab:** Uses authorized patient encounter records from `GET /patients/:id/visits` with live clinical notes, symptoms, and outcomes.
  - **Adherence Tab:** Uses live 90-day dose history from `GET /patients/:id/adherence`, binary heatmap (`taken` \| `missed`), and live AI root-cause analysis.
  - **Reports Tab:** Uses live patient uploaded records from `GET /patients/:id/reports`, supporting view, review, and reindexing.
  - **AI Assistant Tab:** Executes evidence-grounded queries via `POST /doctor/patients/:id/ai-analyses` with live patient context (conditions, medications, adherence %, indexed reports).
  - **Prescription Tab:** Loads active prescriptions via `GET /patients/:id/prescriptions` and persists revisions with mandatory clinical justifications via `POST /prescriptions/:id/approve`.
- **Robust Error Handling, Routing & State Management:**
  - Standardizes route authorization, loading spinners, network retry banners, 401/403/404 handling, and empty states across each tab.

## Capabilities

### Modified Capabilities
- `doctor-portal-backend-workflows`: Updates the doctor patient workspace specification to mandate server-authoritative binary adherence calculations (`taken`/`missed`), live encounter timelines, real report reviews, interactive advisory RAG queries, and audited prescription revisions across all clinical tabs.

## Impact
- **Frontend:** `src/pages/doctor/PatientPage.tsx`, `src/lib/types.ts`, `src/lib/api/apiClient.ts`, `src/components/charts/DoseHeatmap.tsx`.
- **Backend:** `apps/api/src/routes/patients/index.ts` (`GET /patients/:id/adherence`).
- **Data & Security:** Respects workspace and patient-assignment authorization guards, maintaining advisory AI boundaries and server-side prescription auditing.
