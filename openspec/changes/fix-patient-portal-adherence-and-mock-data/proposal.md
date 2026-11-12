# Proposal

## Why

1. **Incorrect Adherence Calculation & Starting Score**: The system currently defaults adherence score to `100%` or `92%` for new patients with no logs. Instead, adherence MUST start at `0%` for all patients and increase progressively as doses are taken: `(Doses Taken So Far / Doses Assigned So Far) * 100`.
2. **Mock Data in Patient Portal**: Multiple patient pages contain static dummy text or mock fallbacks (e.g., hardcoded Care Team message on the Dashboard, hardcoded 98% assurance score in Transparency, legacy base64 localStorage fallback in Reports, and improper consent key mappings).

## What Changes

- **Accurate Progressive Adherence Calculation**:
  - Update `GET /patients/:id/adherence` in `apps/api/src/routes/patients/index.ts` and `adherencePipelineService.ts`.
  - Denominator = total doses assigned/scheduled up to current time (`scheduled_at <= now()`).
  - Numerator = doses marked `taken` so far.
  - If doses assigned so far = 0, adherence score starts at `0%`.
  - As doses are taken, score accurately reflects `(taken / assignedSoFar) * 100`.
- **Dynamic Care Team Message on Dashboard**:
  - Replace hardcoded "Dr. Jeya Shankar M / HbA1c trending down" with the latest real clinical visit note from `api.patients.getVisits()`. Hide gracefully if no visits exist yet.
- **Dynamic Adherence Trend Sparkline**:
  - Connect weekly adherence calculation points to `<TrendSparkline>` instead of static placeholder text.
- **Fix Transparency Page**:
  - Remove hardcoded `98%` assurance score fallback; calculate dynamically from audit trail outcomes or default to clean state.
  - Correct consent field mapping so `reports` reflects care team sharing rather than `allow_reminders`.
- **Clean Reports & Storage**:
  - Remove legacy `localStorage` base64 fallback in `Reports.tsx` and rely solely on live Supabase storage and endpoints.

## Capabilities

### Modified Capabilities

- `patient-portal-backend-workflows`: Changes adherence score calculation to start at 0% and scale strictly by `(taken / dosesAssignedSoFar) * 100`. Updates patient dashboard and transparency data contracts to remove hardcoded demo values.

## Impact

- **Backend**: `apps/api/src/routes/patients/index.ts`, `apps/api/src/services/adherencePipelineService.ts`.
- **Frontend**: `src/pages/patient/Dashboard.tsx`, `src/pages/patient/Transparency.tsx`, `src/pages/patient/Reports.tsx`.
- **Compatibility**: Non-breaking API changes; adheres to existing TypeScript schemas.

