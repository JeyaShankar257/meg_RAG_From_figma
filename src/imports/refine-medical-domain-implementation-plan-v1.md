# Medical Domain System — Complete Implementation Plan

## Product boundary and resolved decisions

Build a production-oriented doctor and patient portal around a shared patient record and a five-agent medication-adherence workflow.

Resolved requirements:
- **Release target:** production clinical system foundations and operational readiness.
- **AI safety boundary:** research prototype / decision support only. AI never diagnoses, prescribes, changes medication, or contacts a patient without the required human-approved workflow.
- **Notifications:** real email reminders and reports first; WhatsApp is designed behind an integration boundary for a later phase.
- **Initial data:** fictional seeded demo workspace, clearly marked as demo data and never mixed with real records.
- **Backend platform:** Supabase for database, authentication, and storage. Server-side logic (API calls, agent runs, AI adapter) runs as **server functions inside the app's own full-stack framework runtime** (e.g. `createServerFn`-style, colocated with the frontend) rather than Supabase Edge Functions — chosen for a simpler, single-runtime, single-deploy setup that's easier to build and debug as a beginner. `pg_cron` reaches this code via secured public API routes (shared-secret header) rather than Supabase's native function scheduling.
- **AI provider:** provider-agnostic adapter, implemented as a server-only module called from the app's server functions; specific provider (Gemini/Claude/Groq) decided at implementation time, keeping the application layer swappable.
- **Existing codebase:** a half-finished single-portal "Adherence Hub" project already exists (tables including `profiles`, `user_roles`, `medications`, `dose_logs`, `escalations`). This plan **migrates and extends** that schema and removes the current half-built pages, rather than starting from a blank project.
- **Adherence pattern detection & escalation:** fully AI-driven (see Phase 6/7) — no deterministic threshold or rule-based floor. The AI's structured judgment (severity, root cause, confidence, explanation) is the trigger itself, not just an explanation layer over a fixed rule.

Because production clinical use depends on jurisdiction, this plan includes compliance-ready controls, but legal certification, medical-device classification, clinical validation, and organization-specific policies remain deployment gates rather than claims made by the application.

## Phase 0 — Product, clinical, and security definition

1. Define the initial user roles: doctor, care-team member, patient, caregiver with explicit consent, and system administrator.
2. Define tenant/workspace boundaries and whether a doctor may access every patient or only assigned patients.
3. Define patient consent, caregiver consent, data-sharing visibility, retention, correction, export, and deletion rules.
4. Define the clinical safety policy: AI output is advisory, uncertainty is visible, citations are shown, emergency symptoms produce an urgent-care warning, and only an authenticated doctor can finalize a prescription.
5. Define audit requirements for sign-in, patient access, AI requests/results, prescription edits, approvals, dose logs, notifications, escalations, acknowledgements, exports, and administrative changes. For the adherence pipeline specifically, the audit record for every AI-driven pattern/escalation decision must capture full input snapshot, structured AI output, confidence, explanation, and model/prompt version — this is the audit trail in place of a fixed rule.
6. Define the clinical review policy for seed data and the workflow for correcting incorrect AI or adherence classifications.
7. Define notification consent, quiet hours, email verification, bounce handling, and patient-controlled communication preferences.
8. Define accessibility, localization/time-zone, date/time, medication-unit, and measurement conventions.
9. Produce a threat model covering role escalation, cross-patient access, leaked links, prompt injection through medical notes/research, unsafe AI output, duplicate reminders, webhook replay, and AI misclassification risk (false-negative pattern detection, since no rule-based floor exists to catch a missed model call).
10. Create acceptance criteria for the complete doctor flow, patient flow, adherence loop, audit trail, failure states, and recovery paths.

## Phase 1 — Foundation and environment

1. Replace the current blank home placeholder with a landing page containing two clear entry buttons — **"Doctor Login"** and **"Patient Login"** — each leading to its own separate login route/form. There is no single shared login page.
2. Set up Supabase for authentication, the Postgres database, and storage. Set up the app's own full-stack server runtime (server functions colocated with the frontend) for all protected application workflows — not Supabase Edge Functions.
3. Establish development, preview, and production environments with separate seed data and secrets.
4. Add the shared design system: clinical, calm, high-contrast visual language; responsive layouts; accessible form states; status colors that are not the sole meaning; empty, loading, error, and confirmation states.
5. Add the application shell with role-aware navigation, account menu, sign out, notification center, and consistent page metadata.
6. Add error reporting, structured server logs, request correlation IDs, and a safe user-facing error pattern that never exposes medical data or secrets.
7. Add the server boundaries for authenticated functions and protected routes; verify every private read/write server-side, not only in the browser.
8. Add secure secret handling for AI and email configuration; never expose private keys to client code.
9. Add CI-quality checks for formatting, linting, type safety, route generation, security-sensitive migrations, and production build output.

## Phase 2 — Authentication, roles, and access control

1. Build **two separate email/password sign-in forms** — Doctor Login and Patient Login — each on its own route, plus shared sign-out, password reset, email verification, and session recovery logic.
2. Add the role model in a separate roles table; never store authorization roles on a profile record.
3. Add doctor, care-team, patient, caregiver, and administrator role assignment with server-side authorization checks.
4. Enforce **role-gated login per route**: each login form verifies the authenticating account's role matches the route used (Doctor Login only accepts doctor-role accounts, Patient Login only accepts patient-role accounts). A mismatch is rejected with a clear message — never silently routed into the other portal. Care-team, caregiver, and administrator accounts use the Doctor Login route with their respective role checked server-side, unless a dedicated route is later warranted. Include a safe unauthorized/not-found experience that does not reveal whether a patient exists.
5. Add profile, contact, time-zone, notification-consent, and emergency-contact settings.
6. Add patient-to-care-team assignment and caregiver access grants with explicit consent and revocation.
7. Write row-level policies and server checks for every patient-owned, clinician-owned, shared, audit, and agent record.
8. Test authorization with a matrix of roles, tenants, assigned/unassigned patients, revoked caregiver access, and direct URL/API access.

## Phase 3 — Clinical data model and seed data

**Migration note:** a half-finished single-portal "Adherence Hub" project already exists, with tables including `profiles`, `user_roles`, `medications`, `dose_logs`, and `escalations`. This schema **extends and renames** those existing tables toward the structure below rather than dropping and rebuilding from scratch; the current half-built pages are removed as part of this phase.

Create the persistent schema with explicit grants, row-level security, indexes, timestamps, soft-delete/retention strategy where required, and audit ownership. Core entities:

- workspaces and workspace memberships
- separate user roles and role assignments
- profiles and patient demographics, including a **system-generated, unique, human-readable Patient ID** (e.g. `PT-00231`) assigned at creation time — never entered or chosen by the doctor
- patient account status: **Invited/Pending** until the patient completes activation, then **Active**
- doctor/care-team assignments
- consent and sharing grants
- conditions and patient problem history
- visits, notes, symptoms, outcomes, and linked prior visits
- prescriptions, prescription revisions, medication details, dosage, frequency, quantity, duration, start/end times, status, and doctor approval
- dose schedule slots and adherence logs
- reminder delivery records and delivery outcomes
- pattern events, AI-generated root-cause classifications, trust-score snapshots, escalations, care-team actions
- weekly/monthly reports and report delivery status
- AI analysis runs, versioned prompts/configuration, output citations, doctor review state, and safety flags
- immutable audit events and correction/review records

Seed a fictional demo workspace in the migration itself with:
- one demo doctor and care-team member
- multiple demo patients with different demographics and access relationships
- five visits per patient with expanded notes and outcomes
- active and historical prescriptions
- taken, late, skipped, and reminder-delivery records
- one normal patient, one improving patient, and one escalation case
- research citations and AI analysis examples clearly labeled as demo/research output

Never seed records on page load or through a client-callable function. Add database tests that verify the seed is isolated and all private data policies work.

## Phase 4 — Doctor portal

### Doctor portal page list
1. **Doctor Login** — dedicated login form (see Phase 1/2)
2. **Doctor Home / Dashboard**
3. **Add New Patient** (form/modal)
4. **Unified Patient Page** (core page, loads on entering/selecting a Patient ID)
5. **Care Team Page** (per-patient adherence pipeline view)
6. **Account / Settings**

### Build tasks

1. Build the doctor home page with patient search, patient ID lookup, assigned-patient list (showing each patient's Patient ID and activation status), an **"Add New Patient" button**, active escalations, and recent activity.
2. Build the **Add New Patient** flow: a form capturing demographics, contact info, and initial doctor/care-team assignment/consent. On submit, the system auto-generates the unique Patient ID, shows a confirmation screen with that ID (with copy action), and sends the patient an activation email (Phase 9) to set their own password. The patient shows as "Invited/Pending" in the doctor's list until activation, then "Active."
3. Build the unified patient page with patient header, demographics, Patient ID, assigned care team, current treatment, adherence trust badge, trend, and active escalation banner.
4. Build the five-visit interactive timeline with expandable notes, condition, proposed solution, outcome, dates, and related-case links.
5. Build the adherence/root-cause panel with dose heatmap, schedule-vs-actual summary, late logging, delivery failures, current score, trend, and the AI's explainable classification (severity, root cause, confidence, reasoning).
6. Build the AI diagnostic assistant with symptom entry, context preview, analysis status, structured result summary, confidence/uncertainty, related prior visits, safety warnings, research citations, and an expandable explanation.
7. Keep the AI result visibly separate from the clinical record until a doctor reviews it. Preserve the exact generated result and model/configuration version for audit.
8. Build the editable prescription review panel with medication, strength, units, frequency, quantity, duration, instructions, contraindication/allergy prompts, and explicit accept/edit/replace actions. Include an expandable **"Evidence for this suggestion"** section showing the citation(s) behind the AI-suggested medicine — source title, publisher, publication date, a one-line relevance note explaining why it applies to this patient, and a guideline-vs-research-study tag — shown collapsed by default, before the doctor accepts, edits, or replaces the suggestion.
9. Require doctor confirmation and show a final review step before saving; write the visit outcome and prescription revision atomically or show a recoverable failure.
10. After confirmation, generate the adherence schedule and show the downstream pipeline status without claiming delivery until email delivery is confirmed.
11. Build a per-patient care-team page showing pipeline stages, active escalations (with the AI's severity/confidence/reasoning displayed as the justification), agent logs, trust trend, recent activity, reports, acknowledgements, and response actions.
12. Add patient access safeguards, no-results states, stale-data indicators, and audit-visible actions.

## Phase 4.5 — Frontend Design & Page Structure

### Design system
- **Visual language:** clinical, calm, trustworthy. Clean whites with a teal-blue primary palette. High contrast for readability. No purple/violet hues.
- **Color system (6 ramps + neutrals):**

| Ramp | Usage | Primary shade |
|---|---|---|
| Primary (Teal) | Actions, active states, branding | #0d9488 |
| Secondary (Slate Blue) | Secondary actions, info | #475569 |
| Accent (Cyan) | Highlights, AI badges | #0891b2 |
| Success (Emerald) | Taken doses, resolved | #10b981 |
| Warning (Amber) | Late doses, pending | #f59e0b |
| Error (Rose) | Missed, escalation, danger | #e11d48 |
| Neutral (Slate) | Backgrounds, text, borders | #f8fafc → #0f172a |

- **Typography:** Inter font family, 3 weights (400 body, 600 semibold headings, 700 bold emphasis), 150% body line-height, 120% headings.
- **Spacing:** 8px grid (8, 16, 24, 32, 48, 64).
- **Interactive elements:** hover lifts, smooth transitions (200ms), skeleton loaders, toast notifications, modal/drawer progressive disclosure, animated charts, dose heatmaps, expandable timeline cards.

### Page inventory

**Shared**
| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Landing | `/` | Brand intro + two entry buttons: Doctor Login, Patient Login |

**Doctor Portal (6 pages)**
| # | Page | Route | Key sections |
|---|---|---|---|
| 2 | Doctor Login | `/doctor/login` | Email/password form, role-gated |
| 3 | Doctor Dashboard | `/doctor` | Patient search, patient ID lookup, assigned patient list with status badges, active escalations banner, recent activity feed, "Add New Patient" button |
| 4 | Add New Patient | `/doctor/patients/new` (modal/page) | Demographics form, contact info, care-team assignment, consent toggle → confirmation screen with generated Patient ID + copy button |
| 5 | Unified Patient Page | `/doctor/patients/:id` | Tabbed/scroll layout with 5 sub-sections (below) |
| 6 | Care Team Page | `/doctor/patients/:id/care-team` | Pipeline stages, escalation banner with AI reasoning, agent logs, trust trend chart, acknowledgements, response actions |
| 7 | Doctor Settings | `/doctor/settings` | Profile, contact, time-zone, notification preferences |

Unified Patient Page sub-sections (scroll/tab):
- **5a. Patient Header** — name, Patient ID, demographics, care team chips, adherence trust badge + trend sparkline, escalation banner if active
- **5b. Visit Timeline** — 5 interactive expandable cards with notes, condition, proposed solution, outcome, dates, related-case links
- **5c. Adherence Panel** — dose heatmap (calendar grid), schedule-vs-actual summary, late/skipped stats, delivery failures, current score + trend, AI root-cause classification (severity, root cause, confidence, reasoning)
- **5d. AI Diagnostic Assistant** — symptom entry, context preview, analysis status, structured result, confidence/uncertainty, related visits, safety warnings, research citations, expandable explanation
- **5e. Prescription Review** — editable medication fields, contraindication/allergy prompts, expandable evidence section (citations, relevance note, guideline-vs-research tag) for the AI-suggested medicine, accept/edit/replace actions, final review confirmation step

**Patient Portal (7 pages)**
| # | Page | Route | Key sections |
|---|---|---|---|
| 8 | Patient Login | `/patient/login` | Email/password form, role-gated |
| 9 | Patient Dashboard | `/patient` | Current medications cards, next dose countdown, reminder status, adherence summary ring, care-team messages |
| 10 | Visit History | `/patient/visits` | Read-only timeline of visits (sharing-policy filtered) |
| 11 | Dose Center | `/patient/doses` | Scheduled doses list, Taken/Skipped/Log Manually buttons, late logging with reason, duplicate prevention, timestamp/method/status display |
| 12 | Transparency Dashboard | `/patient/transparency` | Scheduled vs. logged comparison, trust-score explanation with component breakdown, tracked inputs list, care-team visibility, escalations shared, consent controls |
| 13 | Reports | `/patient/reports` | Weekly/monthly report cards with adherence %, missed-dose days, trend chart, encouraging language |
| 14 | Patient Settings | `/patient/settings` | Medication prefs, email, time-zone, quiet hours, accessibility, consent management, correction/request-review flow |

### Navigation structure

```text
Landing (/)
├── Doctor Login → /doctor/login
│   └── Doctor Shell (sidebar nav)
│       ├── Dashboard → /doctor
│       ├── Patient → /doctor/patients/:id
│       │   ├── (scroll sections 5a–5e)
│       │   └── Care Team → /doctor/patients/:id/care-team
│       └── Settings → /doctor/settings
│
└── Patient Login → /patient/login
    └── Patient Shell (bottom nav on mobile, top nav on desktop)
        ├── Dashboard → /patient
        ├── Doses → /patient/doses
        ├── Visits → /patient/visits
        ├── Transparency → /patient/transparency
        ├── Reports → /patient/reports
        └── Settings → /patient/settings
```

The doctor and patient route trees are fully separate — the Landing page is the only shared entry point, and there is no post-login switching between shells (consistent with the corrected login architecture in Phase 1/2).

### Component architecture

```text
src/
├── components/
│   ├── ui/              # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx
│   │   ├── Input.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── TrustBadge.tsx
│   │   └── StatusPill.tsx
│   ├── charts/
│   │   ├── AdherenceRing.tsx
│   │   ├── DoseHeatmap.tsx
│   │   ├── TrendSparkline.tsx
│   │   └── ScoreTrendChart.tsx
│   ├── doctor/
│   │   ├── DoctorShell.tsx
│   │   ├── PatientList.tsx
│   │   ├── PatientHeader.tsx
│   │   ├── VisitTimeline.tsx
│   │   ├── AdherencePanel.tsx
│   │   ├── AIDiagnosticAssistant.tsx
│   │   ├── PrescriptionReview.tsx
│   │   ├── CareTeamPipeline.tsx
│   │   └── EscalationBanner.tsx
│   ├── patient/
│   │   ├── PatientShell.tsx
│   │   ├── MedicationCard.tsx
│   │   ├── DoseLogger.tsx
│   │   ├── TransparencyView.tsx
│   │   └── ReportCard.tsx
│   └── shared/
│       ├── Landing.tsx
│       ├── LoginForm.tsx
│       └── NotificationCenter.tsx
├── pages/
│   ├── Landing.tsx
│   ├── doctor/ (7 pages)
│   └── patient/ (7 pages)
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   └── types.ts
└── App.tsx (router)
```

### Interactive/attractive design highlights
- **Landing page:** animated medical cross pulse, gradient mesh background (teal→cyan), floating cards previewing both portals, smooth entrance animations
- **Dashboards:** animated adherence rings that fill on load, live "next dose" countdown timers, escalation banners with pulse animation
- **Dose heatmap:** calendar grid with color intensity per adherence level, hover tooltips showing dose details
- **Visit timeline:** expandable accordion cards with smooth height transitions, connecting line with milestone dots
- **AI assistant:** typing indicator during "analysis," structured result cards with confidence bars, collapsible reasoning sections
- **Prescription review:** side-by-side compare view, inline editing with save highlight, allergy warning callouts
- **Care team pipeline:** horizontal stage flow with status icons, animated escalation cards, acknowledgement buttons with confirmation
- **Patient dose center:** large tap-friendly action buttons, satisfying check animation on "Taken," reason dropdown for skips
- **Reports:** encouraging tone with progress celebrations, trend arrows, printable layout

### Frontend build order
1. Design system + UI primitives (Button, Card, Badge, Input, Modal, Toast, Skeleton)
2. Landing page with dual login entry
3. Auth (two login forms, role gating, session)
4. Doctor shell + dashboard (patient list, search, escalations)
5. Add New Patient flow
6. Unified Patient Page (header → timeline → adherence → AI → prescription)
7. Care Team Page (pipeline, escalations, agent logs)
8. Patient shell + dashboard
9. Dose Center
10. Transparency Dashboard + Reports
11. Settings pages (both roles)
12. Charts (heatmap, rings, sparklines, trends) integrated throughout

## Phase 5 — Patient portal

1. Build the patient home page with current medications, next dose, safe reminder status, adherence summary, and outstanding care-team messages.
2. Build the read-only profile and visit history view with only information permitted by sharing policy.
3. Build the dose center with scheduled doses, Taken, Skipped, and Log manually actions; support late logging and a reason where appropriate.
4. Prevent duplicate dose submissions and make every log show timestamp, method, status, and correction path.
5. Build the transparency dashboard showing scheduled vs. logged doses, trust-score explanation, tracked inputs, care-team visibility, escalations shared, and consent controls.
6. Build weekly/monthly reports with encouraging language, adherence percentage, missed-dose days, trend, patterns, and a portal link.
7. Build medication, email, time-zone, quiet-hour, accessibility, and consent preferences.
8. Add patient-visible correction/request-review flow for incorrect dose or sharing data.
9. Ensure the patient never sees raw clinician-only reasoning unless explicitly approved by policy; show safe summaries and clear research-prototype labeling.

## Phase 6 — Five-agent adherence workflow

Implement each agent as durable, idempotent server-side business logic with a recorded run, input snapshot, output, status, retry policy, and audit event.

**Pattern Detection and Escalation are fully AI-driven** — there is no deterministic threshold or rule-based floor. The AI's structured judgment is the trigger itself. Every run's full input, output, confidence, explanation, and model/prompt version is stored as the audit trail in place of a fixed rule.

### Reminder Agent
1. On doctor-approved prescription, generate dose slots from frequency, quantity, duration, time zone, and start time.
2. Create idempotent reminder jobs and suppress obsolete slots when a prescription changes.
3. Adapt timing only within consent, quiet-hour, and clinician-approved limits using prior response history.
4. Send one fixed-purpose email per expected reminder event through the approved app-email path.
5. Record attempted, accepted, delivered, bounced, suppressed, and failed outcomes; never call a delivery failure a patient miss.
6. Include a signed, time-limited portal link only if the security policy allows it; otherwise use a normal authenticated login link.

### Dose Logging Agent
1. Accept portal logs first; reserve email reply/other channels for a later adapter.
2. Validate patient ownership, prescription, slot, status, timestamp, and duplicate constraints.
3. Store taken/skipped, late/on-time, logging method, optional reason, and correction history.
4. Recalculate derived adherence summaries after a successful write and show errors without losing the patient's input.

### Pattern Detection Agent — Fully AI-Driven
1. Runs after every new dose log event, and/or on a scheduled evaluation cycle.
2. **Input per run:** full dose log (taken/skipped/late, timestamps), reminder delivery outcomes (so a delivery failure is never mistaken for a patient miss), current prescription details, and the patient's historical adherence trend (prior patterns, prior escalations, prior root-causes).
3. **AI reasoning replaces fixed thresholds entirely** — no hardcoded "3 consecutive misses" or "40% over 7 days." The model reasons contextually over the shape of the pattern (e.g., a miss right after a dosage-timing change may be judged differently than an unexplained multi-week decline).
4. **Structured output:** `pattern_detected` (yes/no), `severity` (none/mild/concerning/urgent), `root_cause_hypothesis` (non-adherence / reminder-delivery failure / patient-reported reason / unexplained), `explanation` (natural-language reasoning), `confidence` (model's own confidence).
5. Store the full structured output with the input snapshot and model/prompt version for every run — this is the audit trail.

### Escalation Agent — Fully AI-Driven
1. Escalation fires directly off the AI's `severity` and `pattern_detected` output — no separate hardcoded threshold check and no deterministic floor.
2. AI also decides **who to notify** (doctor only vs. broader care team) based on its severity reasoning.
3. Create one idempotent escalation per pattern window and notify the authorized care team.
4. Show the banner, AI severity, AI explanation, root-cause hypothesis, confidence, score trend, and required acknowledgement — the doctor always sees the full reasoning behind why the system escalated, since there is no fixed rule to point to instead.
5. Support acknowledge, respond, resolve, reopen, and correction actions with audit records — clinician correction of an AI escalation decision is especially important here since it's the main safeguard against a wrong AI judgment persisting uncorrected.

### Care Team Interaction Agent
1. Coordinate escalation outreach and record recipient, consent, message, delivery, acknowledgement, and action.
2. Generate patient-facing weekly and monthly reports from the source adherence log.
3. Deliver reports by email first with idempotency and provider outcome handling.
4. Keep clinician digest delivery behind a policy flag until explicitly approved.
5. Provide a later WhatsApp adapter without coupling it to schedule, scoring, or escalation logic.

### Agent orchestration & trigger model

Each agent runs as server-side logic inside the app's own server-function runtime (not Supabase Edge Functions), triggered by either a **direct call from a user action**, a **secured public API route hit by `pg_cron`** (time-based, scheduled), or **invoked in-process from another server function in the same chain** (reactive — no separate database webhook needed, since the write path already lives in app code).

| Agent | Trigger type | Mechanism |
|---|---|---|
| Reminder Agent | Direct call + cron | Direct: prescription approval calls a server function that generates `dose_schedule_slots`. Cron: `pg_cron` hits a secured public route (`/api/public/cron/reminders`, shared-secret header) every few minutes, which sends due reminders and writes `reminder_deliveries`. |
| Dose Logging Agent | Direct call (no background trigger) | Patient portal action calls a server function directly — synchronous request/response. |
| Pattern Detection Agent | Chained call + cron | Chained: the dose-logging server function calls the pattern-detection server function in-process right after a successful log. Cron: daily safety-net run via a secured public route, since a patient logging *nothing* produces no event to chain from. |
| Escalation Agent | Chained call | Invoked in-process by the pattern-detection function when `severity` is `concerning`/`urgent` — no separate trigger needed. |
| Care Team Interaction Agent | Chained call + cron | Chained: invoked by the escalation function right after an escalation is created. Cron: weekly/monthly secured public route generates and sends patient reports. |

**Idempotency requirement:** every server function above must check whether its work has already been done (e.g., a `reminder_deliveries` row already exists for this slot) before writing, since cron and chained calls can overlap for the same underlying event. This directly satisfies the "durable, idempotent server-side business logic" requirement stated at the top of Phase 6.

### Scaling considerations and known bottlenecks

These are not blockers for an initial build/demo, but should be tracked as the patient base grows:

1. **Reminder batch sending (cron).** The reminders route queries all due dose slots across every patient in one run. At high patient/prescription volume this risks exceeding request execution time limits and delaying sends. Mitigation path: paginate/batch the due-slot query, or move to a proper background queue instead of one function looping over all due rows in a single invocation.
2. **AI cost/latency on every dose log.** Because Pattern Detection is fully AI-driven with no rule-based pre-filter (a deliberate decision — see Phase 6), *every* dose log triggers an AI call, even the large majority that are routine. This scales linearly with logging volume and is exposed to AI-provider rate limits, especially during predictable peak windows (e.g., most patients logging a morning dose around the same time). Any pre-filtering added later must not itself become a silent deterministic floor that undermines the fully-AI-driven design intent — this should be a conscious tradeoff decision, not a default optimization.
3. **In-process chain latency per dose log.** A single dose log can cascade through 2–3 chained server-function calls in sequence (pattern detection → escalation → care-team notification) within the same request lifecycle. This is a fixed, non-recursive pipeline, but it means the patient's "log dose" request stays open until the whole chain completes unless later steps are deliberately deferred/queued — worth deciding explicitly rather than defaulting to fully synchronous chaining as volume grows.
4. **RLS query overhead.** Patient-scoped tables queried frequently (`dose_logs`, `pattern_events`) rely on `EXISTS` subqueries against `doctor_patient_assignments`/`caregiver_access_grants` for every row-level check. These subqueries must be indexed correctly as table size grows, or read performance degrades across the whole system, not just one query.
5. **Audit table growth.** `audit_events` is insert-only and grows unbounded by design. Any future compliance/audit-history query surface (e.g., "show this patient's access history") will need partitioning or archival strategy once this table is large, even though writes to it stay cheap indefinitely.

## Phase 7 — Trust score and root-cause model

1. Define and version a transparent score using dose-taking percentage, timing consistency, response to reminders, and escalation history.
2. Show the score as a clinical signal, never a punitive label; expose component explanations to both roles according to policy.
3. Recompute after adherence changes and preserve snapshots for trend charts.
4. **Root-cause classification is produced by the AI Pattern Detection Agent (Phase 6), not a separate rule engine** — the trust score is a numeric summary, while root cause is the AI's contextual explanation of *why* the score is what it is.
5. Allow clinician review/correction of the AI's root-cause classification and preserve both the original AI output and the corrected value — this correction history doubles as the evaluation data for monitoring model drift over time.
6. Add tests for boundary values, missing reminders, prescription changes, late logs, and timezone transitions in the score calculation itself (the score formula remains deterministic even though pattern/escalation are not).

## Phase 8 — AI and research layer

1. Build a provider-agnostic server adapter, implemented as a server-only module in the app's own server-function runtime, with a stable input/output contract and model configuration registry. This same adapter is used by the diagnostic assistant AND the Pattern Detection Agent's AI calls.
2. Call the chosen AI provider (Gemini, Claude, or Groq — decided at implementation time) from the server adapter only; all model calls happen server-side, never from the browser.
3. Send only the minimum authorized patient context; redact or omit unnecessary identifiers.
4. Add external research retrieval through a controlled server boundary with source allowlisting, citation capture, publication date, retrieval timestamp, and failure handling. Once a specific medicine is being suggested, scope the retrieval query by **drug + condition together**, not just condition alone, so the evidence returned actually supports the suggested medicine rather than the diagnosis in general.
5. Treat external pages, notes, and retrieved research as untrusted content; defend against prompt injection and unsupported claims.
6. Return structured fields: hypotheses, uncertainty, related visits, adherence context, suggested options, safety flags, research citations, and "doctor review required." Each citation used to support a suggested medicine additionally carries a **relevance note** (one line explaining why it applies to this patient) and a **citation type** (`guideline` / `research_study` / `other`), so the doctor can weigh guideline-strength evidence differently from a single study.
7. Prohibit direct prescription writes, automatic medication changes, and patient-facing diagnosis claims. **Note:** automatic escalation decisions are now permitted by design (Phase 6) as a deliberate, explicit exception to this general AI-boundary rule — call this out clearly in any compliance/safety documentation so it isn't mistaken for an oversight.
8. Add groundedness checks, citation display, abstention behavior, and clear terminal error messages for AI gateway failures; bounded retry only for rate limits/transient server errors. **For Pattern Detection specifically, define what happens on an AI gateway failure** — since there is no rule-based fallback, a failed AI call means no pattern judgment is made at all for that cycle; this gap needs an explicit, monitored handling path (e.g., retry policy, alerting on repeated failures) rather than silent skipping.
9. Version prompts, model, retrieval sources, safety rules, and outputs for reproducibility — critical for Pattern Detection/Escalation since the model version is effectively "the rule" in this design.
10. Add offline evaluation fixtures using fictional cases and clinician review criteria; never use real patient data for development evaluation without an approved process. **For Pattern Detection, build a labeled reference set of dose-log scenarios with clinician-agreed expected severity/root-cause judgments** — this is the primary tool for catching model drift or regression across prompt/model version changes, since there's no rule to regression-test against instead.

## Phase 9 — Email delivery and operational notifications

1. Configure the managed app-email sending domain and sender identity before enabling sends.
2. Scaffold fixed-purpose reminder, weekly report, monthly report, escalation, acknowledgement, **patient activation/invitation**, and account-notice templates.
3. Keep all sends in server-side feature actions with fixed recipients/templates and event-derived idempotency keys.
4. Handle suppression, bounce, complaint, rate limit, and disabled-domain states without duplicate retries.
5. Add delivery status to doctor/patient views where relevant and use the email event receiver for bounce/complaint follow-up.
6. Do not create a custom email queue, email table, unsubscribe route, or bulk campaign system.
7. Document WhatsApp as a later provider adapter with consent, template, webhook verification, and delivery-log requirements.

## Phase 10 — Security, privacy, and compliance readiness

1. Enforce least privilege in client, server function, database policy, storage policy, and administrative operations.
2. Encrypt transport, use managed secret storage, avoid sensitive data in logs/URLs, and redact AI/provider telemetry.
3. Add audit event immutability, actor identity, timestamp, before/after values where safe, reason, and correlation ID.
4. Add export, correction, retention, deletion, consent withdrawal, and incident-response workflows.
5. Add secure session handling, rate limiting, CSRF/origin protections where applicable, replay protection for callbacks, and signed webhook verification.
6. Add backup/restore and disaster-recovery procedures, monitoring, alerting, and operational runbooks.
7. Run dependency, secret, authorization, and data-exposure scans.
8. Create a compliance checklist for the deployment jurisdiction, including privacy notices, data processing agreements, clinical governance, human oversight, and breach procedures. **Explicitly document the fully-AI-driven escalation design as a named risk item** for clinical governance review, since it departs from the more common deterministic-threshold pattern.
9. Gate production use on legal/compliance review and clinician sign-off; demo data remains the default until those gates pass.

## Phase 11 — Testing and validation

1. Unit-test dosage scheduling, frequency parsing, timezone conversion, late logging, score calculation, and idempotency (the trust-score formula remains deterministic and unit-testable even though pattern/escalation are not).
2. Integration-test authentication, RLS, role boundaries, patient assignment, prescription confirmation, schedule generation, email outcomes, and audit writes.
3. Test AI with fictional fixtures for uncertainty, unsafe requests, missing context, research failures, prompt injection, malformed output, and gateway statuses — **including a dedicated labeled fixture set for Pattern Detection/Escalation** covering clear-cut misses, ambiguous cases, reminder-failure-only cases, and edge timing scenarios, with clinician-agreed expected outputs.
4. End-to-end test: doctor signs in → opens patient → reviews history → runs analysis → edits/approves prescription → schedule is created → patient logs dose → **AI evaluates the pattern** → escalation is acknowledged.
5. Test at least two demo patients in parallel to prove records do not bleed across patients.
6. Test reloads, duplicate clicks, stale tabs, network failures, provider failures, retry limits, and partial downstream failures — **including AI gateway failure during a Pattern Detection run**, verifying the defined fallback/alerting behavior from Phase 8 actually fires.
7. Test keyboard navigation, screen readers, color contrast, zoom, mobile layouts, and long names/medication text.
8. Run performance tests for patient search, dashboard load, timeline, reports, and agent processing.
9. Perform a security review and clinician workflow review using the acceptance criteria from Phase 0, with specific sign-off on the fully-AI-driven escalation design.

## Phase 12 — Deployment and launch gates

1. Apply the schema and seed migrations to development, verify grants/RLS, and promote only reviewed migrations.
2. Configure preview and production secrets, email domain, monitoring, allowed origins, and environment-specific AI settings.
3. Run production builds and route checks; verify no blank placeholder remains and every content route has unique metadata.
4. Conduct a demo-data UAT with a doctor reviewer and a patient reviewer.
5. Conduct a privacy/security UAT with unauthorized-user and direct-request tests.
6. Conduct a controlled pilot with fictional or explicitly approved non-clinical data before any real patient record.
7. Publish only after compliance, clinician safety, email deliverability, backup/restore, incident response, and rollback sign-offs — **with explicit clinical-governance sign-off on the fully-AI-driven Pattern Detection/Escalation design specifically.**
8. Monitor AI failures, email delivery, agent backlog, escalations, authorization denials, and audit completeness after launch — **with dedicated ongoing monitoring of AI escalation precision/recall against clinician feedback**, since there's no static rule to fall back on if the model drifts.
9. Document support ownership, on-call response, model/prompt change review, threshold change review, and release rollback. **Any change to the Pattern Detection/Escalation model or prompt should go through the same review rigor as a threshold change would in a rule-based system**, since the model effectively is the threshold now.

## Definition of complete

The project is complete for the agreed release when:
- Doctors and patients can sign in and only see authorized records.
- The doctor can review a patient's five-visit timeline, adherence context, AI research-prototype analysis, and editable prescription.
- A doctor-approved prescription generates an auditable dose schedule and real email reminders.
- Patients can log on-time, late, and skipped doses and see the same underlying adherence truth.
- **AI-driven pattern detection distinguishes reminder failure from patient non-adherence and escalates based on its own severity judgment, with full reasoning, confidence, and model version captured for every decision.**
- Doctors can acknowledge, resolve, and correct AI-driven escalations from the care-team view.
- Patients can see what is tracked and shared, plus weekly/monthly reports.
- All sensitive actions are auditable, idempotent, authorization-tested, and recoverable.
- AI output is clearly advisory, cited, versioned, failure-aware, and never an automatic prescription or diagnosis — **with escalation triggering as the one explicit, documented exception to "AI never changes clinical state automatically."**
- Seeded fictional demo data passes the full end-to-end flow without exposing real data.
- Production deployment gates, compliance review, clinician sign-off (including specific sign-off on the AI-driven escalation design), monitoring, and rollback documentation are complete.

## Technical implementation order

```text
Cloud + auth + roles
        ↓
Schema + RLS + fictional seed data
        ↓
Doctor/patient shells and clinical records
        ↓
Prescription approval + dose schedule
        ↓
Dose logging + scoring (deterministic) + AI-driven pattern detection
        ↓
AI-driven escalations + care-team workflows
        ↓
Email templates + delivery outcomes
        ↓
AI/research adapter + safety controls + pattern-detection eval fixtures
        ↓
Reports + transparency + audit exports
        ↓
Security/compliance validation + E2E testing (incl. AI drift monitoring)
        ↓
Pilot gates + production release
```
