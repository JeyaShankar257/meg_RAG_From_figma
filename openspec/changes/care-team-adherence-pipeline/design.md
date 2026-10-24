# Design: 4-Stage Closed-Loop Care Team Adherence Pipeline

## Context

See `proposal.md` for motivation. In previous iterations, `CareTeamPage.tsx` displayed a 5-agent stepper (`Reminder`, `Dose Logging`, `Pattern Detection`, `Escalation`, `Care Team Interaction`) populated largely with simulated browser timeouts. The backend currently logs doses synchronously, records prescription revisions, and calculates rolling 30-day adherence in `apps/api`. 

We now transition to a streamlined **4-Stage Closed-Loop Clinical Adherence Pipeline** driven by real database state, daily end-of-day evaluation, and actionable doctor escalation controls.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Dose Reminder Agent                                                 │
│ • Scheduled dose window arrives (e.g. 8:00 AM)                         │
│ • Dispatches proactive email reminder with link to Patient Portal      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Patient logs / skips doses)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Pattern Detection Agent (Daily End-of-Day Evaluation)              │
│ • Runs at end-of-day (e.g. 9:00 PM) or on-demand via Care Team trigger │
│ • Evaluates day's compliance, 7-day adherence, and skip streak         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        [2 Consecutive Skips / < 75%]
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Patient Health Warning Agent (Level 1 Escalation)                   │
│ • Synthesizes drug-specific physiological risk summary                 │
│ • Dispatches educational warning email directly to patient via Resend  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                [Persistent Non-Adherence / 3+ Day Skips]
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Doctor & Guardian SOS Agent (Level 2 Escalation)                    │
│ • Dispatches urgent SOS alert email to patient's Emergency Guardian    │
│ • Activates prominent Red SOS Banner on Doctor Care Team Page          │
│ • Provides 1-click clinical actions (Telehealth, Nurse, Adjust Meds)   │
└────────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Replace the 5-agent legacy stepper with a 4-stage closed-loop pipeline (`Dose Reminder` → `Pattern Detection` → `Patient Health Warning` → `Doctor & Guardian SOS`).
- Implement an end-of-day daily evaluation endpoint (`POST /doctor/patients/:patientId/evaluate-daily-pattern`) with on-demand trigger support (`[⚡ Run Daily Check Now]`) for testing and clinical audits.
- Support 2-tier escalations: Level 1 (patient educational email with 48h cooldown) and Level 2 (guardian SOS email + urgent doctor dashboard banner).
- Provide 1-click doctor response actions on the Care Team page: Telehealth booking, nurse outreach assignment, medication review, and audit-logged acknowledgement.
- Add guardian contact fields (`guardian_name`, `guardian_email`, `guardian_phone`) to `patients` table.

**Non-Goals:**
- Autonomous AI modification of prescriptions or dosages (prescribing remains strictly doctor-controlled).
- Sending unsolicited guardian alerts for single minor skips (guardian contact is restricted to confirmed Level 2 emergency persistence).
- Replacing the existing Hono router or database architecture.

## Decisions

### 1. End-of-Day Daily Evaluation vs. Instant Per-Click Evaluation
- **Decision**: The Pattern Detection Agent evaluates patient records once daily at the end of the day (e.g. 9:00 PM) rather than instantly on every single dose click.
- **Rationale**: Real-world patients have morning and evening medications. Evaluating immediately at 8:05 AM after a morning skip is clinically premature and causes patient alert fatigue. A daily evaluation allows full-day context.
- **Alternative considered**: Instant event-driven checks on every button press. Rejected due to alert fatigue and premature false alarms.

### 2. Collapsing Dose Logging Agent into Standard API Writes
- **Decision**: Eliminate the legacy "Dose Logging Agent" as a separate AI pipeline stage.
- **Rationale**: Recording a dose as taken or skipped is an ordinary, authoritative database write to `dose_logs`. Treating it as an autonomous AI agent added confusion without clinical value.
- **Alternative considered**: Keeping 5 stages. Rejected to streamline the workflow into meaningful clinical tiers.

### 3. Tiered Escalation: Level 1 (Patient Direct) vs Level 2 (Doctor + Guardian SOS)
- **Decision**: Level 1 empowers the patient with medical education (consequences of skipping their specific medication) and a 48-hour cooldown window. Level 2 engages the caregiver and doctor only if the patient remains unresponsive or non-adherent.
- **Rationale**: Protects doctors from notification overwhelm while guaranteeing patient safety through caregiver inclusion when real risk persists.

### 4. Interactive 1-Click Clinical Action Handlers
- **Decision**: Upgrade the Doctor Care Team escalation banner with direct POST actions:
  - `POST /doctor/escalations/:id/respond` with action type (`telehealth`, `nurse_call`, `adjust_medication`, `acknowledge`).
- **Rationale**: Moves beyond a read-only badge into an actionable clinical command center.

## Risks / Trade-offs

- **[Risk] Testability in local demos**: Waiting for 9:00 PM in demo environments would prevent real-time testing.
  - **Mitigation**: Add a visible `[⚡ Run Daily Check Now]` button in the Care Team UI that triggers the daily evaluation on-demand.
- **[Risk] Missing guardian contact details**: Some patient records may not have registered guardian emails.
  - **Mitigation**: The SOS agent validates guardian email presence before dispatch; if missing, it logs a warning and ensures the doctor alert is prominently displayed with a prompt to collect emergency contact details.
- **[Risk] Provider email limits**: Running in development mode without a paid Resend domain.
  - **Mitigation**: Support `EMAIL_MODE=capture` fallback that logs the formatted email payload to server logs and database audit events without crashing.

## Migration Plan

1. Database migration: Add `guardian_name`, `guardian_email`, `guardian_phone` to `patients` table if not already present.
2. API updates: Add daily evaluation endpoint and escalation response handler in `apps/api/src/routes/doctor/index.ts`.
3. Frontend updates: Refactor `CareTeamPage.tsx` to render the 4 stages, live log console, and interactive SOS action banner.
4. Test suite: Add unit and integration tests for daily evaluation rules, Level 1 warning generation, and Level 2 SOS triggers.
