# Design

## Context

See `proposal.md` for motivation. The worker (`apps/worker/src/index.ts`) already claims `jobs` with `type = 'send_reminder'` and executes `processSendReminder`. However, neither the prescription approval route nor the schedule generation worker processor ever inserts rows with `type = 'send_reminder'` into the `jobs` table.

## Goals / Non-Goals

**Goals:**
- Automatically create `send_reminder` jobs whenever dose schedules are created.
- Provide `POST /admin/reminders/dispatch-due` to easily scan and dispatch due dose reminders.
- Ensure reminder emails include the exact medication name and instructions (e.g. "Metformin 500mg - Take 1 tablet daily").

**Non-Goals:**
- SMS or push notification channels.
- Modifying the existing doctor or patient portal UI layouts.

## Decisions

### Decision 1: Create `send_reminder` jobs concurrently when inserting `dose_schedules`
In [`apps/api/src/routes/prescriptions/index.ts`](file:///d:/meg_RAG_From_figma/apps/api/src/routes/prescriptions/index.ts) (line 387) and [`apps/worker/src/jobs/processors.ts`](file:///d:/meg_RAG_From_figma/apps/worker/src/jobs/processors.ts) (line 63), after inserting into `dose_schedules`, insert corresponding rows into `jobs`:
```typescript
const jobRows = insertedSchedules.map((sched) => ({
    type: "send_reminder",
    status: "pending",
    idempotency_key: `rem-${sched.id}`,
    correlation_id: correlationId,
    next_run_at: sched.scheduled_at,
    payload: {
        patientId: sched.patient_id,
        scheduleId: sched.id,
        prescriptionId: actualPrescriptionId,
        email: patient.contact_email,
        medicationName: medName,
        dosage: medDosage,
    }
}));
await admin.from("jobs").insert(jobRows);
```

### Decision 2: Add `POST /admin/reminders/dispatch-due`
To make routine reminders easily checkable and support on-demand triggers or hourly cron jobs, create `POST /admin/reminders/dispatch-due` in `apps/api/src/routes/admin/index.ts`. It queries dose schedules scheduled on or before the current timestamp (or for today), verifies that no notification row exists in `notifications` for this schedule today, and sends the reminder email directly using `sendEmail()`.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Duplicate reminder emails | Idempotency keys (`rem-<schedule_id>`) on jobs, plus check against the `notifications` table before dispatching |
| Missing patient email in job payload | Fallback to querying `patients.contact_email` dynamically during execution |

