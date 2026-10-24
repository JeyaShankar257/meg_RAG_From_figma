# Proposal

## Why

The current Care Team page visualizes a legacy 5-agent pipeline that includes redundant stages (such as treating direct UI dose logging as an AI agent) and lacks real-time triggers, resulting in a static, simulated experience. Furthermore, non-adherence currently lacks a tiered, closed-loop escalation model that distinguishes routine reminders from early patient health education (Level 1) and urgent caregiver/doctor intervention (Level 2 SOS). 

Transitioning to a calm, clinically realistic **4-Stage Closed-Loop Adherence Pipeline** evaluated at the end of each day ensures patients receive proactive reminders, empowers them with drug-specific risk education upon repeated skips, and alerts guardians and doctors only when true medical danger emerges.

## What Changes

- **Streamline Pipeline Stepper**: Replace the legacy 5-agent stepper on [`CareTeamPage.tsx`](file:///d:/meg_RAG_From_figma/src/pages/doctor/CareTeamPage.tsx) with a 4-tier closed-loop visualizer:
  1. **Dose Reminder Agent**: Scheduled daily reminders via Resend / in-app notifications.
  2. **Pattern Detection Agent**: End-of-day daily evaluation of adherence score, streaks, and consecutive skips.
  3. **Patient Health Warning Agent (Level 1)**: Personalized drug-specific risk warning email to patient upon repeated skips.
  4. **Doctor & Guardian SOS Agent (Level 2)**: Persistent non-adherence alert triggering emergency guardian notification and clinical dashboard escalation.
- **Daily End-of-Day Pattern Evaluation**: Transition pattern detection from instant/premature daytime triggers to a daily end-of-day batch assessment (with a demo button `[⚡ Run Daily Check Now]` on the Care Team page for instant testing).
- **Interactive Doctor SOS Escalation**: Upgrade the Care Team escalation banner with 1-click clinical actions (`[Schedule Urgent Telehealth]`, `[Assign Nurse Outreach]`, `[Adjust Medication]`, and `[Mark Acknowledged]`).
- **Emergency Guardian Notifications**: Integrate emergency guardian contact details (`guardian_name`, `guardian_email`) for Level 2 SOS dispatches.
- **Live Terminal Console**: Stream real timestamped execution logs for the 4 agents inside the Care Team terminal.

## Capabilities

### New Capabilities
- `care-team-adherence-pipeline`: Covers the 4-stage closed-loop adherence monitoring workflow, end-of-day pattern detection, Level 1 patient health warning dispatch, and Level 2 Guardian & Doctor SOS escalation.

### Modified Capabilities
- `doctor-portal-backend-workflows`: Extends doctor portal pipeline retrieval and escalation handling to support 4-stage agent tracking and one-click clinical response actions.

## Impact

- **Frontend**: Updates [`CareTeamPage.tsx`](file:///d:/meg_RAG_From_figma/src/pages/doctor/CareTeamPage.tsx) visualizer, interactive SOS banner, and live agent log terminal.
- **Backend API**: Adds end-of-day pattern evaluation endpoint (`POST /doctor/patients/:patientId/evaluate-daily-pattern`), wires Level 1 & Level 2 notifications via Resend/capture, and handles response actions in [`apps/api/src/routes/doctor/index.ts`](file:///d:/meg_RAG_From_figma/apps/api/src/routes/doctor/index.ts).
- **Database**: Extends `patients` table with emergency guardian contact fields (`guardian_name`, `guardian_email`, `guardian_phone`) and records pipeline stage transitions in `pipeline_stages`.
- **Security & Clinical Safety**: Enforces role-based doctor authorization, preserves audit logs for every escalation action, and guarantees AI cannot autonomously alter prescriptions.
