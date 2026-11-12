# Spec Delta

## Purpose

Enforces server-authoritative adherence calculation starting at 0% and scaling with doses taken versus doses scheduled so far, and removes hardcoded mock placeholders from the Patient Portal.

## MODIFIED Requirements

### Requirement: The system SHALL provide authenticated patient dashboard data including active prescription summaries, next scheduled dose timestamps, server-computed adherence percentages (taken, late, missed, skipped), current adherence streak count, and trend indicators via `GET /patients/:id/adherence`. Patient dashboard reads SHALL enforce strict patient session authorization so that an account with `role: 'patient'` may only access its own clinical record where `user.patientId === :id` and `user.patientStatus === 'active'`. The response SHALL include freshness metadata and identify unavailable metrics rather than substituting hardcoded demo values.
The system SHALL calculate the overall adherence score starting at 0% when no scheduled doses have elapsed. When scheduled doses have elapsed up to the current timestamp (`scheduled_at <= now()`), the system SHALL compute the score as `Math.round((dosesTakenSoFar / dosesAssignedSoFar) * 100)`. Doses scheduled in future days SHALL NOT be counted in the denominator. The Patient Dashboard SHALL render real visit notes in the Care Team card and display live adherence sparkline trends without hardcoded demo strings.

#### Scenario: New patient starts at zero percent adherence
- **WHEN** an authenticated patient with a newly approved prescription has zero elapsed dose schedules
- **THEN** `GET /patients/:id/adherence` returns `score: 0`, `takenCount: 0`, and streak count `0`

#### Scenario: Progressive adherence calculation as doses elapse
- **WHEN** a patient has 3 doses scheduled so far and has taken 2 of them
- **THEN** `GET /patients/:id/adherence` returns `score: 67` (representing 2/3 doses taken so far)

#### Scenario: Real visit note rendered on dashboard
- **WHEN** an authenticated patient opens their dashboard and has an active visit history
- **THEN** the Care Team message card renders the attending doctor's name, initials, and latest clinical consultation note from the visits table

