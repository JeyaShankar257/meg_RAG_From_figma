# Five-Agent Care Team Workflow Plan

## Goal

Turn the existing mock five-agent Care Team pipeline into a durable care-coordination workflow while keeping the same five user-visible agents:

1. **Reminder Agent — rule-based**
2. **Dose Logging Agent — rule-based**
3. **Pattern Detection Agent — LLM-powered with deterministic safety floor**
4. **Escalation Agent — LLM-powered with deterministic safety floor**
5. **Care Team Interaction Agent — LLM-powered, human-approved personalized outreach**

This workflow is separate from the doctor-facing RAG assistant. It may begin after a doctor-approved prescription creates dose schedules, but it must not change RAG behavior or bypass prescription approval.

The implementation will use the planned Node.js/TypeScript Hono API, standalone Node worker, Supabase, Resend, and a private stateless Python/LangGraph service for the last three agents.

## Current Repository State

`src/pages/doctor/CareTeamPage.tsx` currently displays the five agents, escalation banners, mock logs, trust-score trend, and assigned team. Prescription approval writes `pipeline_triggered` into `sessionStorage`; the Care Team page uses timers to animate Reminder and Pattern Detection. No real email, dose mutation, LLM workflow, durable escalation, or follow-up task currently occurs.

The backend OpenSpec already plans durable jobs, Resend delivery, adherence aggregation, Gemini analysis, escalation, consent, audit, retry, and dead-letter handling. No backend services or Python/LangGraph service are implemented yet.

The older project plan says Pattern Detection is fully AI-driven without a rule floor. This refined plan intentionally supersedes that decision: the last three agents use LLMs, but deterministic rules establish mandatory minimum safety actions that the LLM cannot downgrade.

## Product Decisions

- There are exactly five user-visible agents; LangGraph is the internal orchestration runtime for Agents 3–5, not a sixth agent.
- Reminder and Dose Logging are deterministic; they do not need an LLM.
- Reminder emails contain medicine details and a **Take Medicine** button in the HTML email body. There is no file attachment.
- The email button opens a short-lived signed confirmation page showing the exact patient/dose slot. A final **Confirm Taken** POST records the event. A GET/link preview never mutates dose data, preventing email-security scanners from creating false logs.
- Patients submit **Taken** or **Skipped**. The server derives **On-time/Late** from the authoritative timestamp and derives **Missed** after the grace period.
- Fixed reminder emails may send automatically after consent, quiet-hours, recipient, suppression, and idempotency checks.
- Personalized LLM follow-up emails remain drafts until an authorized care-team member approves them.
- Concerning/urgent outcomes automatically create an auditable care-team follow-up task, not a calendar appointment.
- Deterministic policy rules set a minimum severity; LLM agents may increase it but never reduce it.
- Only the Node API/worker performs database writes, email sends, notifications, and task/escalation creation.

## Five-Agent Responsibilities

### Agent 1 — Reminder Agent (rule-based)

Responsibilities:

- Read active prescriptions, generated dose schedules, timezone, quiet hours, and reminder preferences.
- Find due dose slots through deterministic schedule queries.
- Create one fixed-purpose reminder delivery per dose slot/channel using an idempotency key.
- Render an HTML email containing:
  - patient-safe greeting;
  - medicine name;
  - strength and unit;
  - scheduled time in the patient timezone;
  - brief approved instructions;
  - **Take Medicine** CTA;
  - portal/help link and non-emergency disclaimer.
- Send through Resend only after policy checks.
- Persist queued, provider-accepted, delivered, bounced, complained, suppressed, retry-scheduled, and failed outcomes separately.
- Feed delivery outcomes to Pattern Detection so delivery failure is not mislabeled as patient non-adherence.

The Reminder Agent does not decide adherence severity and does not write dose logs.

#### Secure email action

1. Worker creates a random one-time token bound to patient, dose slot, medicine, expiry, and intended action.
2. Store only a token hash, with expiry, used-at, revoked-at, and dose-slot ID.
3. Email CTA links to `GET /dose-actions/:token`.
4. GET validates token and renders a minimal confirmation page; it never changes clinical state.
5. Patient selects **Confirm Taken**.
6. Browser sends `POST /dose-actions/:token/confirm` with CSRF/origin protections where applicable.
7. API atomically consumes the token and invokes the same idempotent Dose Logging service used by the portal.
8. Repeated confirmation returns the existing dose event and never duplicates it.
9. Expired/revoked/wrong-slot tokens show a safe portal link without revealing unrelated patient data.

Do not place patient IDs, diagnosis, raw medication IDs, or PHI in query parameters. Tokens are opaque, short-lived, one-time, and redacted from logs.

### Agent 2 — Dose Logging Agent (rule-based)

Responsibilities:

- Accept dose submission from the authenticated patient portal or a consumed signed email-action token.
- Verify patient ownership, active prescription, dose-slot identity, allowed action, and duplicate status.
- Use an authoritative server timestamp.
- Accept patient action:
  - `taken`
  - `skipped`, with optional structured reason
- Derive final status:
  - `taken_on_time` when confirmation is within the configured timing window;
  - `taken_late` when confirmation is after the timing window but before the slot closes;
  - `skipped` when the patient explicitly skips;
  - `missed` only when the grace period closes without a taken/skipped event.
- Preserve reminder-delivery status separately from dose status.
- Write an append-only dose event and audit event.
- Enqueue one idempotent Pattern Detection run.

The Dose Logging Agent never asks an LLM whether a submission is valid and never allows the client to choose an authoritative timestamp or mark its own dose missed.

### Agent 3 — Pattern Detection Agent (LLM-powered)

Responsibilities:

- Receive authorized, minimized adherence context prepared by the Node worker.
- Analyze seven-/thirty-day metrics, consecutive misses, timing patterns, explicit skip reasons, reminder delivery outcomes, medication risk class, recent prescription changes, and prior pattern events.
- Distinguish likely causes such as:
  - reminder delivery failure;
  - schedule conflict;
  - timing inconsistency;
  - side-effect concern;
  - behavioral/routine issue;
  - insufficient evidence/unknown.
- Return performance class, severity recommendation, confidence, root cause, reasoning, safety flags, and evidence references.
- Preserve uncertainty and abstain when context is insufficient.

The Node worker computes deterministic metrics and minimum severity before calling the LLM. Pattern Detection cannot downgrade that minimum.

### Agent 4 — Escalation Agent (LLM-powered)

Responsibilities:

- Review the Pattern Detection result plus deterministic safety policy.
- Recommend escalation category, urgency, assignee role, due time, and human follow-up intent.
- Produce structured rationale and safety flags.
- Never prescribe, alter medication, or create appointments.

The Node worker validates output and performs side effects. For final concerning/urgent outcomes it atomically creates:

- pattern event;
- escalation record;
- care-team follow-up task;
- task/audit events;
- internal care-team notifications.

The LLM cannot suppress a task required by deterministic policy.

### Agent 5 — Care Team Interaction Agent (LLM-powered)

Responsibilities:

- Draft personalized patient follow-up messages for care-team review.
- Summarize dose performance and relevant delivery issues for the assigned care-team task.
- Draft weekly/monthly narrative report highlights from structured metrics.
- Suggest care-team coordination steps and collaborator role.
- Never send email or mutate task/prescription state directly.

The Node worker stores personalized messages as drafts. An authorized care-team member can edit, approve, or reject. Approval revalidates consent, recipient, suppression, quiet hours, and current task status before Resend delivery.

## Agent Technology Boundary

### Node.js/TypeScript owns

- Authentication and authorization.
- Supabase access and RLS-aware queries.
- Schedule calculation.
- Reminder eligibility and email templates.
- Signed token creation/consumption.
- Dose validation and status derivation.
- Deterministic adherence metrics and safety rules.
- Durable jobs, retries, idempotency, and dead letters.
- Zod validation of all external/agent outputs.
- All database writes, email sends, task/escalation creation, and audit events.

### Python/LangGraph owns

Agents 3–5 as structured reasoning graphs:

```text
Pattern Detection graph
        |
        v
Escalation recommendation graph
        |
        v
Care Team Interaction draft graph
```

Add `apps/agent-service` as a private stateless service. It receives minimized opaque patient references and structured context. It has no Supabase service key, Resend key, browser exposure, or direct side-effect tools.

Suggested layout:

```text
apps/agent-service/
  pyproject.toml
  app/
    main.py
    config.py
    schemas.py
    graph.py
    nodes/
      pattern_detection.py
      escalation_recommendation.py
      care_team_interaction.py
      finalize.py
    prompts/
      pattern_v1.py
      escalation_v1.py
      interaction_v1.py
  tests/
```

Private endpoint:

```text
POST /internal/v1/care-team-assessments
```

Protect it with private networking and service-to-service authentication. Carry run ID, correlation ID, model version, prompt version, and timeout budget.

## End-to-End Data Flow

```text
Doctor approves prescription
        |
        v
Node worker generates dose slots
        |
        v
Agent 1 finds due slot and sends fixed HTML reminder
        |
        v
Patient clicks Take Medicine
        |
        v
Signed confirmation page -> Confirm Taken POST
        |
        v
Agent 2 validates and stores dose event in Supabase
        |
        v
Node worker computes adherence metrics + mandatory safety floor
        |
        v
Agent 3 LLM detects pattern/root cause/severity
        |
        v
Agent 4 LLM recommends escalation/task details
        |
        v
Node worker validates and atomically creates required records
        |
        v
Agent 5 LLM drafts follow-up/report content
        |
        v
Care Team member reviews task and approves personalized outreach
```

## Trigger and Scheduling Rules

- Prescription approval: generate dose schedules; do not infer poor adherence before events exist.
- Due dose slot: enqueue one reminder job.
- Reminder delivery webhook: persist outcome and enqueue monitoring when relevant.
- Dose taken/skipped: enqueue Pattern Detection after idempotent persistence.
- Missing-dose scanner: hourly scan closes expired grace periods and creates missed events.
- Daily aggregation: create one patient-local-day snapshot.
- Weekly/monthly schedule: Agent 5 drafts report narrative from deterministic metrics.

Idempotency keys include patient, dose slot/window, action/job type, and source event. Overlapping event/cron runs must converge rather than duplicate email, dose events, analyses, escalations, or tasks.

## Deterministic Safety Floor

Use versioned, configurable fictional/demo defaults that require clinician approval before production.

Metrics:

- Taken count = on-time + late.
- True missed count = missed + skipped, with delivery failures preserved as separate context and excluded from patient-attributable metrics when policy says so.
- Retain late and skipped internally even if simplified UI groups them.
- Calculate seven-/thirty-day adherence and consecutive true misses.

Initial minimum policy:

- Stable: seven-day adherence at least 80%, fewer than two consecutive true misses, no high-risk trigger.
- Reminder needed: one overdue slot or seven-day adherence 70–79%, without higher trigger.
- Concerning minimum: two consecutive true misses, at least three true misses in seven days, or seven-day adherence below 70%.
- Urgent minimum: three consecutive true misses, seven-day adherence below 50%, or a high-risk medication with at least two consecutive true misses.

Final severity is the maximum of deterministic minimum and validated LLM recommendation.

If the LLM service fails, mandatory concerning/urgent tasks are still created with `AI explanation unavailable`; no personalized email draft is generated. Stable/reminder-only cases remain pending/retryable rather than falsely classified by AI.

## Structured LangGraph Contract

### Input

```json
{
  "runId": "uuid",
  "patientRef": "opaque-id",
  "monitoringWindow": { "start": "timestamp", "end": "timestamp" },
  "metrics": {
    "scheduledCount": 14,
    "takenOnTimeCount": 8,
    "takenLateCount": 2,
    "skippedCount": 1,
    "missedCount": 3,
    "consecutiveTrueMisses": 2,
    "adherence7d": 0.71,
    "adherence30d": 0.82
  },
  "policyMinimumSeverity": "concerning",
  "deliveryContext": {
    "accepted": 12,
    "delivered": 10,
    "bounced": 1,
    "suppressed": 0,
    "failed": 1
  },
  "medicationContext": [],
  "recentDoseEvents": [],
  "priorPatternEvents": [],
  "modelConfigVersion": "care-team-v1"
}
```

### Output

Validate with Pydantic and again with Zod:

```json
{
  "runId": "uuid",
  "pattern": {
    "performanceClass": "stable|reminder_needed|concerning|urgent",
    "severity": "none|mild|concerning|urgent",
    "rootCause": "delivery_failure|schedule_conflict|timing|side_effect_concern|behavioral|unknown",
    "reasoning": "string",
    "confidence": 0.0,
    "evidenceEventIds": [],
    "safetyFlags": []
  },
  "escalation": {
    "action": "none|create_follow_up",
    "recommendedAssigneeRole": "care_coordinator|attending_physician|pharmacist",
    "priority": "normal|high|urgent",
    "dueWithinMinutes": 240,
    "rationale": "string"
  },
  "interaction": {
    "emailAction": "none|personalized_draft",
    "emailSubjectDraft": "string|null",
    "emailBodyDraft": "string|null",
    "reportHighlights": [],
    "requiresHumanApproval": true
  },
  "modelVersion": "string",
  "promptVersions": {
    "pattern": "string",
    "escalation": "string",
    "interaction": "string"
  }
}
```

User-entered notes and delivery text are untrusted content. Delimit them and prohibit instructions/tool calls from changing policy or side-effect boundaries.

## Data Model

Add or extend:

### Dose/reminder records

- `dose_schedules`
- `dose_slots`
- `dose_events` append-only
- `reminder_deliveries`
- `dose_action_tokens` with token hash, dose slot, expiry, used/revoked timestamps

### Agent/run records

- `dose_monitoring_runs`: trigger, window, status, attempts, idempotency, policy/model/prompt versions, safe errors.
- `pattern_events`: metrics snapshot, policy minimum, LLM recommendation, final severity, root cause, confidence, reasoning, review/correction.

### Follow-up records

- `escalations`
- `care_team_tasks`
- `care_team_task_events` append-only
- notification/email draft and delivery records linked to task/pattern/dose slot.

Care-team task states:

```text
open -> acknowledged -> in_progress -> resolved
                         \-> dismissed (reason required)
```

Default routing:

- Concerning: Care Coordinator Priya Dharshini.
- Urgent: Attending Physician Dr. Jeya Shankar M; notify Care Coordinator.
- Medication/side-effect pattern: suggest Pharmacist Parvathi as collaborator.

All tables require workspace/patient scoping, RLS, explicit API authorization, timestamps, idempotency constraints, and immutable audit events.

## API and Job Interfaces

### Jobs

```text
generate_dose_schedule
send_dose_reminder
close_missed_dose_slot
evaluate_dose_pattern
create_escalation_and_task
generate_follow_up_draft
send_approved_follow_up_email
generate_periodic_report
retry_failed_agent_run
```

### Dose action APIs

```text
GET  /dose-actions/:token
POST /dose-actions/:token/confirm
POST /patient/dose-slots/:slotId/skip
```

GET is read-only. Confirm/skip mutations are idempotent and validated server-side.

### Care Team APIs

```text
GET  /doctor/patients/:patientId/care-team
GET  /doctor/patients/:patientId/care-team/runs
GET  /doctor/patients/:patientId/care-team/tasks
GET  /doctor/care-team/tasks/:taskId
POST /doctor/care-team/tasks/:taskId/acknowledge
POST /doctor/care-team/tasks/:taskId/assign
POST /doctor/care-team/tasks/:taskId/start
POST /doctor/care-team/tasks/:taskId/resolve
POST /doctor/care-team/tasks/:taskId/dismiss
POST /doctor/care-team/tasks/:taskId/email-draft/approve
POST /doctor/care-team/tasks/:taskId/email-draft/reject
POST /doctor/care-team/runs/:runId/retry
```

Every mutation uses Zod, authentication/assignment checks, idempotency, and audit events.

## Care Team View Changes

Keep `/doctor/patients/:patientId/care-team` and the five-stage pipeline.

Replace mock `sessionStorage` and timers in backend mode with:

1. Patient and monitoring header.
2. Summary counters: open/urgent tasks, reminder failures, email drafts awaiting approval.
3. Actionable follow-up task queue.
4. Selected task details with metrics, deterministic trigger, Agent 3 reasoning, Agent 4 escalation rationale, and Agent 5 draft.
5. A five-agent pipeline showing real queued/running/retry/complete/failed/dead-letter states.
6. Safe expandable run logs.
7. Existing trend chart and named care team.

The pipeline labels must communicate implementation type:

- Reminder Agent — Rule-based
- Dose Logging Agent — Rule-based
- Pattern Detection Agent — LLM + safety rules
- Escalation Agent — LLM + safety rules
- Care Team Interaction Agent — LLM + human approval

Keep an explicit demo adapter only; backend mode must never silently fall back to simulated success.

## Relationship to RAG

| Workflow | Purpose | Effect of this plan |
|---|---|---|
| RAG AI Assistant | Doctor asks evidence-grounded clinical question | No change |
| Prescription approval | Doctor edits/confirms medication | No change; starts schedule generation |
| Reminder Agent | Due-dose reminder email and secure CTA | Rule-based implementation |
| Dose Logging Agent | Validate/derive/persist dose status | Rule-based implementation |
| Pattern Detection Agent | Contextual adherence/root-cause assessment | LLM with safety floor |
| Escalation Agent | Recommend and explain escalation/task | LLM with safety floor; Node performs write |
| Care Team Interaction Agent | Draft outreach/reports/task summary | LLM; personalized email requires approval |

No agent may create or alter a prescription.

## Failure and Edge Cases

- Email scanner opens CTA: GET is read-only, so no dose is logged.
- Token expired/used/revoked: show safe failure and portal link; do not issue a new event.
- Duplicate confirm: return existing dose event.
- Patient takes dose after marked missed: append a correction/late event according to policy; never overwrite audit history silently.
- Reminder bounced/suppressed: do not blame patient; update delivery context and stop blind retries.
- Quiet hours: schedule send after quiet period unless approved urgent-notification policy applies.
- No dose logs: hourly scanner still closes overdue slots.
- LangGraph timeout/malformed output: bounded retry; mandatory policy tasks still created; no personalized draft.
- LLM lowers mandatory severity: retain deterministic minimum and audit the discrepancy.
- LLM recommends medication change: discard recommendation and flag it for review.
- Existing open task: link/update according to deduplication policy instead of creating duplicates.
- Consent revoked: cancel unsent email, exclude prohibited actions/context, preserve historical audit.
- Cross-patient/workspace request: deny without revealing record existence.

## OpenSpec Changes

Create `openspec/changes/add-care-team-agentic-workflow/` depending on `setup-backend-infrastructure` and separate from `add-rag-ai-assistant`.

Update conflicting language in the domain/backend plans:

- Replace “fully AI-driven with no rule floor” with the two-rule-agent/three-LLM-agent architecture.
- Document secure email CTA behavior.
- Document server-derived late/missed statuses.
- Document deterministic minimum severity and LLM merge rule.
- Document personalized email approval.
- Document Python/LangGraph service boundary.
- Document care-team task semantics and role routing.

## Verification

### Unit

- Schedule and reminder eligibility, timezone, quiet hours.
- Token generation/hash/expiry/replay/revocation.
- Email GET cannot mutate; confirm POST is idempotent.
- On-time/late/skipped/missed derivation at every timing boundary.
- Adherence metrics and every safety-rule threshold.
- LLM merge rule cannot downgrade severity.
- Pydantic/Zod schema parity.

### Integration

- Prescription approval -> dose schedule -> reminder email.
- CTA -> confirmation page -> confirm POST -> Supabase dose event.
- Dose event/missed closure -> Agent 3 -> Agent 4 -> Agent 5.
- Concerning/urgent -> atomic escalation + task.
- Personalized draft cannot send without approval.
- Consent, quiet hours, suppression, bounce, and complaint behavior.
- Agent timeout, invalid output, retry, dead-letter, policy fallback.
- Cross-patient/workspace isolation.

### End-to-end fictional scenarios

1. Due dose sends one email with medicine details and secure CTA.
2. Email scanner preview does not log a dose.
3. Patient confirms; one taken event is stored and classified on-time/late by server time.
4. Patient skips with reason; event is stored and monitoring runs.
5. Grace period expires; server creates missed event.
6. Delivery failure changes root-cause context and avoids patient blame.
7. Two/three consecutive misses create the correct task priority/assignee.
8. LLM outage still creates mandatory policy task without personalized draft.
9. Care team approves personalized email and Resend outcome is persisted.
10. Task is acknowledged, assigned, started, and resolved with append-only history.
11. Duplicate jobs/webhooks/clicks create no duplicate side effects.
12. RAG and prescription-approval behavior remain unchanged.

## Implementation Order

1. Add/reconcile the new OpenSpec change and remove the old fully-LLM/no-rule-floor conflict.
2. Implement backend foundation: Auth, RLS, Hono API, worker, durable jobs, audit, Resend.
3. Add dose schedules/slots/events, reminder delivery, and one-time token migrations.
4. Implement rule-based Reminder Agent and secure HTML email CTA flow.
5. Implement rule-based Dose Logging Agent and server-derived status logic.
6. Add monitoring/pattern/task migrations and versioned safety policy.
7. Implement private Python/LangGraph Agents 3–5 with Pydantic tests.
8. Integrate Node worker, Zod revalidation, merge rule, retry/dead-letter behavior.
9. Implement atomic escalation/task creation and role routing.
10. Implement personalized email draft review/approval and periodic report generation.
11. Add Hono care-team APIs.
12. Replace Care Team page mock timers/sessionStorage with typed API state and task UI.
13. Complete unit, integration, E2E, security, privacy, and clinician evaluation.
14. Run fictional-data UAT and release gates.

## Concise Refined Description

The Care Team view contains five agents. The first two are deterministic: the Reminder Agent sends a policy-approved HTML email with medicine details and a secure **Take Medicine** CTA, and the Dose Logging Agent validates the confirmed submission, stores it in Supabase, and derives on-time, late, skipped, or missed status from server rules. The last three agents use LLMs through an internal Python/LangGraph service: Pattern Detection analyzes adherence and root cause, Escalation recommends severity and follow-up, and Care Team Interaction drafts personalized communication and reports. Deterministic safety rules set a minimum escalation level that LLMs cannot downgrade. Node services—not the LLM—send email, write clinical records, and create tasks. Fixed reminders may send automatically; personalized LLM follow-ups require care-team approval. The workflow remains separate from RAG and cannot prescribe or modify medicine.
