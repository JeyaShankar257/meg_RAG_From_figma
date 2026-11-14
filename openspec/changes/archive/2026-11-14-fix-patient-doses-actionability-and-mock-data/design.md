# Design: Fix Patient Doses Actionability and Mock Data

## Overview

The Doses page (`DoseCenter.tsx`) is a clinical touchpoint where patients record their medication adherence. When a patient arrives at the page after their scheduled dose time has passed, they must still be empowered to record whether they took or skipped their dose. Furthermore, their historical logs must accurately reflect server-stored records rather than hardcoded mock placeholders.

## Technical Details

### 1. Dose Actionability State Machine

```
[ Scheduled Slot ] 
        |
        +---> Before grace window expiration:
        |       - Status: "pending"
        |       - isActionable: true, isOverdue: false
        |       - UI: "Take Dose" / "Skip Dose" buttons
        |
        +---> Past grace window without log:
        |       - Status: "pending" (or "missed")
        |       - isActionable: true, isOverdue: true
        |       - UI: "Past due window" warning badge + "Take Dose" / "Skip Dose" buttons
        |
        +---> Dose logged as taken:
        |       - Status: "taken"
        |       - isActionable: false, isOverdue: false
        |       - UI: Emerald checkmark + "Taken" pill + logged timestamp
        |
        +---> Dose logged as skipped:
                - Status: "skipped"
                - isActionable: false, isOverdue: false
                - UI: Slate pill + "Skipped" + skip reason
```

### 2. Live Adherence History

On page load:
`Promise.all([api.patients.getDoseSchedules(patientId), api.patients.getAdherence(patientId)])`

In `GET /patients/:id/adherence`:
Enrich logs query with medication information:
```sql
dose_logs -> dose_schedules -> prescriptions -> medications(name, dosage)
```

In `DoseCenter.tsx`:
- Render historical list from `adherence.logs`.
- Display formatted date ("Today", "Sep 11", etc.), formatted time, medication name + strength, and status pill.
- If no logs exist, display friendly empty state card.
- When `handleTake` or `handleSkip` executes successfully, immediately prepend the new record to `history` so the UI reflects the action without delay.

### 3. Loading & Empty States

- Skeleton cards matching the height and shape of dose cards are shown during data fetch.
- When `doses.length === 0` (no doses scheduled for today), render an uplifting empty card ("All caught up! No medication doses are scheduled for today.").
