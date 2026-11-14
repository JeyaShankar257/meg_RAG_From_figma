# Proposal

## Why

The Patient Portal Home page (`Dashboard.tsx`) exhibits several UX and data synchronization defects:
- When opening the dashboard, premature zero metrics flash before live server data loads.
- Medication cards statically display "See dose schedule" instead of calculating the next real dose timing.
- When all scheduled doses for the day have been completed, the hero card redundantly shows "Next Dose Due: See dose schedule" instead of a congratulatory completion message.
- A new patient with zero prescribed medications sees an empty void without a friendly empty state card.
- Streak counter displays grammatically incorrect text (`1 days on track`).
- In the backend `GET /patients/:id/adherence` endpoint, `skippedCount` is hardcoded to `0` in the returned JSON instead of returning the dynamically filtered skipped logs count.

Fixing these defects ensures the Patient Portal displays accurate, responsive, and grammatically correct adherence and medication status.

## What Changes

- **Frontend (`src/pages/patient/Dashboard.tsx`)**:
  - Add a dedicated skeleton / loading placeholder while `loading` is true to eliminate the flash of zeroed statistics.
  - Dynamically match each medication in `activeMeds` against `scheduleResult.schedules` to display actual upcoming dose timing (e.g., "Today at 09:00 AM" or "Completed today").
  - Update `nextScheduledDose` status when all doses for today have been logged as taken to render "All doses completed for today!".
  - Add a fallback empty state card when `activeMeds.length === 0` ("No active medications prescribed yet").
  - Fix streak day count grammar (`1 day on track` vs `X days on track`).
  - Remove unused import `isBackendConfigured`.
- **Backend (`apps/api/src/routes/patients/index.ts`)**:
  - Return the actual calculated `skippedCount` in `GET /patients/:id/adherence` instead of hardcoding `0`.

## Capabilities

### Modified Capabilities
- `patient-portal-backend-workflows`: Fix `skippedCount` adherence reporting and require accurate dynamic next dose presentation on the patient dashboard without static placeholder text.

## Impact

- **Affected Files**:
  - `src/pages/patient/Dashboard.tsx` (frontend dashboard presentation)
  - `apps/api/src/routes/patients/index.ts` (`GET /patients/:id/adherence` response payload)
- **APIs**: `GET /patients/:id/adherence` correctly reflects `skippedCount`.
- **Breaking Changes**: None. All changes are backward-compatible.
