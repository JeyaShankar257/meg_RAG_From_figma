# Proposal

## Why

In the Patient Portal Doses page (`src/pages/patient/DoseCenter.tsx`), patients encounter a critical bug preventing adherence tracking:
1. **Doses Lock Out as "Missed":** When a scheduled dose passes its grace window without an existing log, the backend calculates its status as `"missed"`. In `DoseCenter.tsx`, action buttons ("Take Dose" / "Skip Dose") are only rendered if `dose.status === "pending"`. Consequently, whenever a dose is past due, the action buttons disappear completely and are replaced with a static `<StatusPill status="missed" />`, permanently locking the patient out from recording their dose for the day.
2. **Hardcoded Recent History Mock Data:** The "Recent History" section contains static hardcoded sample data from September (`Metformin 1000mg`, `Amlodipine 5mg`) instead of retrieving live dose history from `api.patients.getAdherence(patientId)`.
3. **No Instant History Synchronization:** When a patient logs a dose, the history section does not update with the new entry until page reload.
4. **Suboptimal Empty & Loading States:** When no doses are scheduled today or while data is loading, the UI presents bare text strings rather than structured cards and loading skeletons.

## What Changes

- **Frontend (`src/pages/patient/DoseCenter.tsx`)**:
  - Introduce `isActionable` and `isOverdue` flags on each scheduled dose:
    - Any dose not yet logged (`!s.loggedAt && s.status !== "taken" && s.status !== "skipped"`) remains actionable.
    - If `s.status === "missed"` (past grace window without a log), display an amber "Past due window" indicator while keeping "Take Dose" and "Skip Dose" buttons available.
    - Once logged, transition to locked status with appropriate `StatusPill` ("Taken" or "Skipped") and logged time.
  - Query `api.patients.getAdherence(patientId)` on mount alongside `getDoseSchedules` and populate the Recent History list with live patient dose logs.
  - Prepend newly logged doses (taken or skipped) immediately to the history state for instantaneous UI synchronization.
  - Render an engaging empty state card when no doses are scheduled for today.
  - Add skeleton placeholders during initial loading.
  - Comply with project guidelines (double quotes for apostrophes, default exports, oxfmt formatting).
- **Backend (`apps/api/src/routes/patients/index.ts`)**:
  - Enrich `GET /patients/:id/adherence` logs query to join `dose_schedules(prescriptions(medications(name, dosage)))` and map `medicationName` and `dosage` onto each log entry.
- **Contracts & Types (`packages/contracts/src/index.ts`, `src/lib/types.ts`)**:
  - Support optional `medicationName` and `dosage` attributes on dose log schemas.

## Capabilities

### Modified Capabilities
- `patient-portal-backend-workflows`: Ensure scheduled doses remain actionable for patient recording even after passing the grace window, and provide enriched dose history with medication names.

## Impact

- **Affected Files**:
  - `src/pages/patient/DoseCenter.tsx`
  - `apps/api/src/routes/patients/index.ts`
  - `packages/contracts/src/index.ts`
  - `src/lib/types.ts`
- **Breaking Changes**: None.
