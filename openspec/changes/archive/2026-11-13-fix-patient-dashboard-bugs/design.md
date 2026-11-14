# Design

## Context

See `proposal.md` for motivation.
Currently, `Dashboard.tsx` fetches:
- `api.patients.getMedications(patientId)`
- `api.patients.getAdherence(patientId)`
- `api.patients.getDoseSchedules(patientId)`
- `api.patients.getVisits(patientId)`

However, during data fetching, the component leaves `loading: true` while mounting all metric cards with default zero data. Furthermore, the schedule results are not cross-referenced with `activeMeds` to show dynamic dose times, leading to static placeholders like "See dose schedule". On the backend, `GET /patients/:id/adherence` contains a typo where `skippedCount: 0` is returned instead of the variable `skippedCount`.

## Goals / Non-Goals

**Goals:**
- Provide smooth loading UX without flashing zeroed stats.
- Accurately compute next dose status per medication and overall for today.
- Provide clear completion and empty states.
- Fix backend adherence `skippedCount` reporting.

**Non-Goals:**
- Redesigning the visual theme or layout grid.
- Modifying other tabs (Visits, Reports, Transparency).

## Decisions

### 1. Skeleton Loading State
Instead of rendering empty `Card` components alongside a small text banner `<p>Loading...</p>`, render a pulse-skeleton grid while `loading === true`. This completely avoids the momentary flash of 0% metrics.

### 2. Next Dose Resolution per Medication
Cross-reference each medication from `medicationResult.medications` with `scheduleResult.schedules`:
```ts
const upcomingSchedule = schedules.find(
  (s) => s.status === "scheduled" && (s.medicationName?.toLowerCase() === med.name?.toLowerCase())
);
const takenToday = schedules.some(
  (s) => s.status === "taken" && (s.medicationName?.toLowerCase() === med.name?.toLowerCase())
);
const nextDoseText = upcomingSchedule
  ? `Today at ${upcomingSchedule.scheduledTime}`
  : takenToday
    ? "Completed today"
    : "No doses today";
```

### 3. Daily Completion Banner
When `scheduleResult.schedules` contains at least one item for today, but none are in `"scheduled"` status (all taken, skipped, or missed), set `nextScheduledDose` to `"All doses completed for today! 🎉"` or `"No pending doses for today"`.

### 4. Backend Fix for `skippedCount`
In `apps/api/src/routes/patients/index.ts`:
Change line 784 from `skippedCount: 0,` to `skippedCount,`.

## Risks / Trade-offs

- **[Risk] Medication Name Mismatch** → If the prescription medication name in `dose_schedules` differs slightly in casing or whitespace from `medications` table, matching could fail.
  - *Mitigation*: Normalize casing with `.trim().toLowerCase()` and check both medication name and `prescription_id` when available.
