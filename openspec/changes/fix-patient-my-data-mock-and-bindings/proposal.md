# Proposal: Fix Patient Portal My Data Mock and Bindings

## Why

In the Patient Portal, the "My Data" page (`Transparency.tsx`, route `/patient/transparency`) contains multiple mock data artifacts, hardcoded values, and broken bindings:
1. **Hardcoded Trust Score (98 / 95)**: Initial state, fallback logic, and the backend API (`GET /patients/:id/transparency`) hardcode `assuranceScore: 98` (or 95 fallback), completely ignoring the patient's actual adherence and consent metrics.
2. **Fake "Escalations" Toggle & Broken Consent Binding**: The UI renders a fake "escalations" toggle that does not exist in the database table `consent_records`. Additionally, `reports` and `escalations` both read from `share_with_care_team`, ignoring `allow_reminders`.
3. **Fake "Delivery Failures" Metric in Scheduled vs Logged**: Queries non-existent `(adherence as any).deliveryFailures ?? 0` and displays a fake "Delivery failures" card, while "Scheduled" only sums logs rather than actual assigned doses.
4. **Synthetic Verification Timestamps**: Backend generates `new Date().toISOString()` on every HTTP request, faking an instant verification timestamp rather than using the real consent or audit event timestamp.
5. **Raw Audit Log Output & Missing Empty State**: Audit events render raw strings (e.g. `Action view_patient recorded with outcome success`), and if no audit events exist, the entire card is hidden without explanation.

## What Changes

- **Backend (`apps/api/src/routes/patients/index.ts`)**:
  - Dynamically calculate `assuranceScore` based on the patient's real adherence score and consent verification status.
  - Query real total scheduled doses due so far (`totalAssignedSoFar`) in `GET /patients/:id/adherence` and return `totalAssignedCount`.
  - Format `trustSignals` with actual timestamps (`consent.updated_at`, latest audit `occurred_at`).
  - Translate audit actions into human-readable descriptions (e.g. "Care team reviewed patient chart", "Consent preferences updated").
- **Frontend (`src/pages/patient/Transparency.tsx`)**:
  - Align consent toggles 1-to-1 with `consent_records`:
    - `care_team` -> `share_with_care_team` (Required for care)
    - `reminders` -> `allow_reminders` (Routine dose reminders & notifications)
    - `ai_analysis` -> `allow_ai_analysis` (AI clinical advisory)
    - Remove the fake `escalations` toggle.
  - Calculate `trustScore` dynamically from real adherence and consent verification.
  - In "Scheduled vs. Logged", replace the fake "Delivery failures" card with real "Skipped Doses" (with reasons).
  - Add a styled empty state card when no audit events exist yet.
  - Comply with project guidelines (double quotes for apostrophes, oxfmt formatting).
- **Contracts and Types (`packages/contracts/src/index.ts`, `src/lib/types.ts`, `src/lib/api/apiClient.ts`)**:
  - Update `PatientAdherenceSummary` and `PatientTransparencyResponse` contracts to support `totalAssignedCount` and clean consent bindings.

## Capabilities

### Modified Capabilities
- `patient-portal-backend-workflows`: Return dynamically calculated assurance score, authoritative audit action descriptions, real verification timestamps, and full consent mappings.

## Impact

- **Affected Files**:
  - `src/pages/patient/Transparency.tsx`
  - `apps/api/src/routes/patients/index.ts`
  - `src/lib/api/apiClient.ts`
  - `src/lib/types.ts`
  - `packages/contracts/src/index.ts`
