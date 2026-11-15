# Proposal: Medication Start and End Date Lifecycle

## Why

In the Doctor Portal AI Assistant tab, prescribing medicine only captures a duration in `days` without explicit `start_date` or `end_date` tracking. This causes severe cascade issues:
1. **No End Dates in Schema**: Neither `medications` nor `prescriptions` records `start_date` or `end_date`.
2. **Hardcoded 30-Day Schedules**: Regardless of whether a medication was prescribed for 3, 5, or 14 days, the backend always generates 30 days of dose schedules.
3. **Medications Never Expire**: Because `is_active` is initialized to `true` and never set to `false`, expired prescriptions linger on the Patient Portal Home page forever with "No doses today", cluttering the patient's care plan with ended medications.

## What Changes

- **Database**:
  - Migration adding `start_date`, `end_date`, and `duration_days` to `medications` and `prescriptions`.
- **Backend API**:
  - In `apps/api/src/routes/prescriptions/index.ts`:
    - Persist `start_date`, `end_date`, and `duration_days` on prescription approval.
    - Bound dose schedule generation strictly to the prescribed `duration_days` (e.g. 5 days for a 5-day course).
  - In `apps/api/src/routes/patients/index.ts`:
    - In `GET /patients/:id/medications`, filter for medications that are currently active (`is_active = true` AND `end_date >= current_date`), preventing expired courses from showing as active medicines.
    - Return `startDate`, `endDate`, and `durationDays` in the medication response.
- **Doctor Portal Frontend**:
  - In `PrescriptionSuggestionCard.tsx` and `PatientPage.tsx`:
    - Add explicit `startDate` and `endDate` fields.
    - Auto-compute `endDate` from `startDate` + `days`, and vice versa.
    - Pass both dates upon approval.
- **Patient Portal Frontend**:
  - In `Dashboard.tsx`:
    - Display course progress (e.g., "Day 2 of 5 · Ends Nov 19") on each active medication card.

## Capabilities

### Modified Capabilities
- `patient-portal-backend-workflows`: Exclude expired medications from active lists and provide medication lifecycle dates.
- `doctor-portal-backend-workflows`: Support start and end dates on prescription approval and generate dose schedules strictly matching duration.

## Impact

- **Affected Files**:
  - `supabase/migrations/0007_medication_dates_and_lifecycle.sql`
  - `apps/api/src/routes/prescriptions/index.ts`
  - `apps/api/src/routes/patients/index.ts`
  - `src/components/doctor/rag/PrescriptionSuggestionCard.tsx`
  - `src/pages/doctor/PatientPage.tsx`
  - `src/pages/patient/Dashboard.tsx`
  - `src/lib/types.ts`
