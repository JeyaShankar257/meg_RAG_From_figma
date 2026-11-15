# Design: Medication Start and End Date Lifecycle

## Architectural Overview

A medication prescription has a distinct clinical lifecycle:
```
[ Prescribed ] ---> [ Active: startDate <= today <= endDate ] ---> [ Completed: today > endDate ]
```

### 1. Database Schema
Add columns to `medications` and `prescriptions`:
- `start_date`: Date (ISO YYYY-MM-DD)
- `end_date`: Date (ISO YYYY-MM-DD)
- `duration_days`: Integer

### 2. Dose Schedule Bounds
Dose schedules should only exist for the active duration:
- If `duration_days = 5`, generate schedules for Day 0 through Day 4.
- Total days generated = `Math.max(1, duration_days)`.

### 3. Active Medication Queries
In `GET /patients/:id/medications`:
- Query: `is_active = true` AND (`end_date is null` OR `end_date >= current_date`).
- Any medication whose `end_date` is in the past is treated as completed, not currently active.
- Self-heal `is_active = false` if `end_date < current_date`.

### 4. Doctor UI Interaction
In `PrescriptionSuggestionCard.tsx`:
- Inputs:
  - `Start date`: defaults to `today`
  - `Duration`: number of days (e.g. 7)
  - `End date`: automatically calculated as `start date + duration days`
- Doctors can edit either `Duration` or `End date` seamlessly.
