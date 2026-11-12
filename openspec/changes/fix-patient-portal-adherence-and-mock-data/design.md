# Design

## Context

See `proposal.md` for background. The current adherence endpoint counts logs in `dose_logs`. If `totalCount == 0`, it defaults to 100%. This is clinically incorrect for a new patient who has taken nothing yet. Additionally, comparing against all 30 days upfront would unfairly penalize someone on Day 1 (1/30 = 3%). The correct denominator is `dosesAssignedSoFar` (`scheduled_at <= now()`).

## Goals / Non-Goals

**Goals:**
- Progressive Adherence Formula:
  $$\text{score} = \begin{cases} 0 & \text{if dosesAssignedSoFar} = 0 \\ \min\left(100, \text{round}\left(\frac{\text{takenCount}}{\text{dosesAssignedSoFar}} \times 100\right)\right) & \text{otherwise} \end{cases}$$
- Replace Dashboard hardcoded care team message with latest clinical visit note.
- Render `<TrendSparkline>` using historical weekly adherence points.
- Clean up mock storage fallbacks in Reports and Transparency.

**Non-Goals:**
- Redesigning the Patient portal layout.
- Adding real-time chat or messaging system.

## Decisions

### Decision 1: Query `dose_schedules` for denominator
In `apps/api/src/routes/patients/index.ts`:
Query `dose_schedules` for the patient where `scheduled_at <= now()`.
- `dosesAssignedSoFar = scheduledCount`
- `takenCount = count of dose_logs with status = 'taken'`
- If `dosesAssignedSoFar === 0`, return `score: 0`.

### Decision 2: Dashboard Care Team Card
In `src/pages/patient/Dashboard.tsx`:
Add `api.patients.getVisits(patientId)` to the initial data loader.
Render the note and doctor name from `visits[0]` if present, else hide the card.

### Decision 3: Remove LocalStorage in Reports
In `src/pages/patient/Reports.tsx` and `src/lib/patientReports.ts`:
Ensure report upload and listing exclusively communicate with backend endpoints and Supabase storage.

