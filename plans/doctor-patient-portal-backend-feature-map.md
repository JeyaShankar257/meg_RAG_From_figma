# Doctor and Patient Portal: Backend Feature and Purpose Map

## 1. Document Purpose

This document describes the purpose, user-facing features, backend responsibilities, suggested APIs, data entities, permissions, and workflow requirements for every page currently implemented in the MedNova doctor and patient portals.

The frontend is a React, Vite, and Tailwind application. Most current data comes from:

- `src/lib/mockData.ts`
- React component state
- `sessionStorage`
- `localStorage`

The production backend should become the authoritative source for:

- Authentication and sessions
- Role-based authorization
- Patient and clinical records
- Prescriptions and revisions
- Dose schedules and dose events
- Adherence calculations
- Patient-uploaded medical reports
- RAG indexing and AI analyses
- Escalations and care-team activity
- Consent and communication preferences
- Notifications and delivery outcomes
- Correction requests and immutable audit history

The system has two separate experiences:

- **Doctor Portal:** Patient management, clinical monitoring, AI-assisted analysis, prescription review, reports, care-team pipelines, and escalations.
- **Patient Portal:** Medication schedules, dose logging, visit history, adherence visibility, medical report uploads, consent, and preferences.

---

# 2. Shared Entry and Authentication

## 2.1 Landing Page

**Route:** `/`

### Purpose

The landing page allows a user to choose between the Doctor Portal and Patient Portal. It also communicates that AI provides advisory decision support and does not independently diagnose or prescribe.

### Features

- Doctor Portal entry
- Patient Portal entry
- Summary of doctor capabilities
- Summary of patient capabilities
- Clinical AI safety statement

### Backend Requirements

The page does not need clinical data. It may optionally check the current session and redirect:

- Authenticated doctor or clinician to `/doctor`
- Authenticated patient to `/patient`

A patient session must never be accepted as a doctor session, and a doctor session must not automatically grant patient ownership permissions.

---

## 2.2 Doctor Login

**Route:** `/doctor/login`

### Purpose

Authenticates doctors and authorized care-team members before they access clinician-facing information.

### Current Features

- Email and password inputs
- Remember-me option
- Forgot-password action
- Link to Patient Login
- Demo credentials and fictional-data notice

The current frontend only simulates authentication with a timeout.

### Backend Responsibilities

1. Validate the submitted email and password.
2. Create or refresh a secure authenticated session.
3. Confirm that the account has an allowed clinician role.
4. Reject patient-only accounts attempting to use the doctor portal.
5. Return the authenticated profile, workspace, role, and permissions.
6. Record successful and failed authentication events.
7. Support password recovery and email verification.
8. Apply rate limiting and account protection.

Possible clinician roles include:

- `doctor`
- `care_coordinator`
- `pharmacist`
- `administrator`

### Suggested APIs

```http
POST /auth/doctor/login
POST /auth/logout
POST /auth/password-reset/request
POST /auth/password-reset/confirm
GET  /me
```

### Main Data Entities

- `auth_users`
- `profiles`
- `workspaces`
- `workspace_memberships`
- `user_roles`
- `sessions`
- `audit_events`

---

## 2.3 Patient Login

**Route:** `/patient/login`

### Purpose

Authenticates patients using the account created from a doctor-issued invitation.

### Current Features

- Email and password inputs
- Remember-me option
- Forgot-password action
- Link to Doctor Login
- Demo patient information

### Backend Responsibilities

1. Verify the submitted credentials.
2. Confirm that the patient completed activation.
3. Require the patient role.
4. Resolve the authenticated account to the correct patient record.
5. Prevent the patient from selecting or accessing another patient's data.
6. Support account activation and password recovery.
7. Record authentication activity.

### Suggested APIs

```http
POST /auth/patient/login
POST /auth/logout
GET  /me
POST /auth/activation/complete
POST /auth/password-reset/request
```

### Important Authorization Rule

The backend must derive the patient record from the authenticated session. A `patientId` submitted by the browser must never be treated as proof that the user owns that patient record.

---

# 3. Doctor Portal

## 3.1 Doctor Portal Shell

**Route scope:** `/doctor/*`

### Purpose

Provides shared clinician navigation, doctor identity, assigned-patient shortcuts, escalation indicators, notifications, settings, and sign-out.

### Current Features

- Doctor name and specialty
- Dashboard navigation
- Assigned patient shortcuts
- Patient alert indicator
- Add New Patient navigation
- Open escalation count
- Notification button
- Settings
- Sign out

### Backend Requirements

The shell needs:

- Authenticated clinician profile
- Workspace information
- Role and permission set
- Assigned or recently accessed patients
- Open escalation count
- Unread notification count

### Suggested API

```http
GET /doctor/bootstrap
```

Example response:

```json
{
  "profile": {},
  "workspace": {},
  "permissions": [],
  "patientShortcuts": [],
  "openEscalationCount": 1,
  "unreadNotificationCount": 3
}
```

The endpoint is useful because this data appears across all doctor pages.

---

## 3.2 Doctor Dashboard

**Route:** `/doctor`

### Purpose

Provides an operational overview of the doctor's assigned population and highlights patients requiring attention.

### Current Features

- Active escalation banner
- Active-patient count
- Average adherence score
- Open escalation count
- Reminder totals and retry counts
- Assigned patient list
- Search by patient name or public Patient ID
- Patient activation status
- Patient conditions and last visit
- Patient adherence score and trend
- Escalation badge
- Recent activity feed
- Patient registration shortcut

### Backend Reads

```http
GET /doctor/dashboard
GET /doctor/patients?search=&status=&cursor=
GET /doctor/activity?limit=20
GET /doctor/escalations?status=open
```

### Backend Calculations

The backend or worker should calculate:

- Number of assigned active patients
- Number of invited or pending patients
- Average adherence for monitored patients
- Number of unresolved escalations
- Reminder delivery, failure, and retry counts
- Latest adherence score and trend per patient
- Whether each patient has an active escalation

The browser should not download all dose events to calculate dashboard summaries.

### Main Data Entities

- `patients`
- `patient_assignments`
- `conditions`
- `adherence_summaries`
- `escalations`
- `notifications`
- `reminder_deliveries`
- `activity_events`

### Permissions

A clinician may only see:

- Patients in an authorized workspace
- Patients assigned to the clinician
- Patients accessible through permitted care-team membership
- Activity records within that authorized scope

An unauthorized request should not reveal whether a patient exists.

---

## 3.3 Add New Patient

**Route:** `/doctor/patients/new`

### Purpose

Registers a patient, creates initial clinical and care-team relationships, records consent, and starts account activation.

### Current Fields

#### Demographics

- First name
- Last name
- Date of birth
- Gender

#### Contact Information

- Email
- Phone number
- Address

#### Guardian Information

- Guardian name
- Guardian phone
- Guardian email

#### Clinical Setup

- Initial conditions
- Assigned doctor
- Care-team notes in component state

#### Consent

- Care-team data sharing
- AI-assisted decision support
- Email reminders and reports

### Successful Result

- System-generated Patient ID, such as `PT-00268`
- Patient status set to `invited` or `pending`
- Doctor and care-team assignments created
- Activation email queued
- Confirmation page displayed

### Suggested API

```http
POST /doctor/patients
```

The browser must not choose the public Patient ID.

### Transactional Backend Workflow

1. Validate the clinician and workspace.
2. Validate submitted demographic and contact data.
3. Check for an existing account or duplicate email.
4. Create the patient record.
5. Allocate a unique public Patient ID.
6. Create initial conditions.
7. Create doctor and care-team assignments.
8. Save guardian information when present.
9. Save versioned consent records.
10. Create a pending activation account or invitation.
11. Enqueue the activation email.
12. Add an audit event.
13. Commit the operation atomically.

### Guardian Modeling

Guardian information should preferably be stored as a related contact:

- Relationship type
- Contact details
- Communication permission
- Portal-access grant status
- Effective and revoked dates

Providing guardian contact information must not automatically grant access to the patient's portal.

---

# 4. Doctor Patient Workspace

**Route:** `/doctor/patients/:patientId`

This is the main clinical workspace and contains six tabs:

1. Overview
2. Visits
3. Adherence
4. Reports
5. AI Assistant
6. Prescription

Every request must verify that the clinician has access to the requested patient.

---

## 4.1 Patient Header

### Purpose

Provides persistent patient identity and current clinical context across all tabs.

### Current Features

- Patient name
- Public Patient ID
- Activation status
- Age and gender
- Conditions
- Last visit
- Adherence or trust score
- Active escalation indicator
- Care-team members
- Link to Care Team View

### Required Backend Data

- Patient profile
- Current conditions
- Current assignments
- Care-team members
- Latest adherence summary
- Latest visit
- Open escalation count

Age should generally be calculated from date of birth rather than stored as an independently editable value.

### Suggested API

```http
GET /doctor/patients/:patientId
```

---

## 4.2 Overview Tab

### Purpose

Provides a concise clinical summary before the doctor opens detailed records.

### Current Features

- Adherence score
- Taken and missed totals
- Active medications
- Patient demographics
- Three-month adherence trend

### Suggested APIs

```http
GET /doctor/patients/:patientId/overview
GET /doctor/patients/:patientId/adherence/summary?period=90d
GET /doctor/patients/:patientId/prescriptions?status=active
```

### Main Data Entities

- `patients`
- `conditions`
- `prescriptions`
- `medications`
- `dose_schedules`
- `dose_events`
- `adherence_summaries`

The overview endpoint should return a read-optimized response rather than requiring the frontend to combine many raw datasets.

---

## 4.3 Visits Tab

### Purpose

Shows the patient's longitudinal clinical history and relationships between visits.

### Current Features

- Visit timeline
- Visit date
- Condition
- Symptoms
- Clinical notes
- Proposed solution
- Outcome
- Related visits

### Suggested APIs

```http
GET   /doctor/patients/:patientId/visits
GET   /doctor/patients/:patientId/visits/:visitId
POST  /doctor/patients/:patientId/visits
PATCH /doctor/patients/:patientId/visits/:visitId
```

### Main Data Entities

- `visits`
- `visit_symptoms`
- `visit_conditions`
- `visit_relationships`
- `clinical_notes`

### Security Considerations

Clinical notes are sensitive. Access should be scope-checked and auditable. Patient-facing visit responses may contain a separately approved summary rather than all internal clinical notes.

---

## 4.4 Adherence Tab

### Purpose

Allows the doctor to understand medication behavior and distinguish patient-attributable missed doses from reminder or delivery failures.

### Current Features

- Two-state clinical totals:
  - Taken
  - Missed
- 90-day dose heatmap
- Delivery failures excluded from miss count
- AI root-cause classification
- Severity
- Confidence
- Explanation
- Model version
- Doctor-review warning

### Suggested APIs

```http
GET /doctor/patients/:patientId/adherence?from=&to=
GET /doctor/patients/:patientId/adherence/heatmap?days=90
GET /doctor/patients/:patientId/pattern-analyses/latest
GET /doctor/patients/:patientId/pattern-analyses
```

### Adherence Calculation

The raw event model may preserve detailed states:

- Taken on time
- Taken late
- Skipped
- Missed
- Reminder delivery failed

The doctor view can aggregate them:

```text
Taken  = taken on time + taken late
Missed = skipped + true missed
```

Reminder delivery failures should remain separate and should not automatically count as patient-attributable misses.

The backend must preserve detailed source events even when the UI shows a simplified two-state summary.

### AI Pattern Analysis Provenance

Store:

- Analysis period
- Dose-event snapshot or references
- Reminder-delivery snapshot or references
- Root cause
- Severity
- Confidence
- Explanation
- Safety flags
- Model version
- Prompt or configuration version
- Creation time
- Review state
- Related escalation
- Correlation ID

---

## 4.5 Reports Tab

### Purpose

Allows the doctor to review medical documents uploaded by the patient and manage document indexing for RAG.

### Current Features

- Patient-uploaded report list
- Report category and date
- Upload time
- Filename and file size
- Patient note
- Secure report viewing
- Mark as reviewed
- Indexing status
- Retry failed indexing

### Suggested APIs

```http
GET  /doctor/patients/:patientId/reports
POST /doctor/reports/:reportId/review
POST /reports/:reportId/reindex
GET  /reports/:reportId/download-url
```

### Storage Design

Do not store report contents or base64 data in Postgres.

Use:

- Private object storage for files
- Postgres for metadata
- Short-lived signed URLs for authorized viewing

### Report Metadata

- Patient ID
- Title
- Category
- Report date
- Patient note
- Object-storage path
- MIME type
- File size
- Checksum
- Upload state
- Malware-scan state, when available
- Sharing state
- Reviewer ID and review time
- Indexing state
- Indexing error
- Indexed time

### Suggested Indexing States

```text
uploaded → queued → extracting → embedding → ready
                              ↘ failed
```

The original report must remain available to authorized users even when text extraction or embedding fails.

---

## 4.6 AI Assistant Tab

### Purpose

Provides evidence-grounded, patient-scoped clinical decision support using RAG. The result remains advisory and requires doctor review.

### Current Features

- Single “Ask AI with RAG” field
- Patient-context preview
- Pending and running states
- Retrieved-evidence section
- AI conclusion
- Confidence and severity
- Safety flags
- Citations
- AI medication suggestions
- Editable medication suggestion fields
- Doctor approval preview

### Existing Frontend API Contract

```http
POST /doctor/patients/:patientId/ai-analyses
GET  /doctor/ai-analyses/:analysisId
GET  /doctor/ai-analyses/:analysisId/evidence
POST /reports/:reportId/reindex
```

### Backend Workflow

1. Authenticate the clinician.
2. Verify access to the patient.
3. Verify the patient's applicable AI consent.
4. Create an analysis request with `pending` status.
5. Capture an authorized patient-context snapshot.
6. Generate an embedding for the clinical question.
7. Retrieve only permitted evidence.
8. Apply relevance thresholds.
9. Send delimited evidence and permitted context to Gemini.
10. Treat every retrieved document as untrusted evidence.
11. Validate the structured AI response.
12. Store the output and complete provenance.
13. Return `complete`, `error`, or `needs_review`.

### Permitted Evidence Types

- Approved clinical guidelines
- Reviewed research sources
- Medication references
- Authorized patient visits
- Authorized patient reports
- Permitted medication and adherence context

### Required Provenance

- Original question
- Patient-context snapshot
- Retrieved source IDs
- Retrieved chunk IDs
- Excerpts
- Similarity scores
- Retrieval rank
- Top-k setting
- Similarity threshold
- Prompt version
- Model version
- Structured response
- Confidence
- Severity
- Safety flags
- Citations
- Doctor-review state
- Creation and completion times

### Critical Safety Boundary

An AI medication suggestion is not an active prescription. The AI analysis endpoint must never independently create or activate a prescription.

---

## 4.7 Prescription Tab

### Purpose

Allows an authorized doctor to manage prescriptions and turn reviewed AI suggestions into doctor-approved prescriptions.

### Current Features

- Active prescriptions
- AI-suggested indicator
- Doctor-approved indicator
- Medication name and generic name
- Strength and unit
- Frequency
- Quantity
- Duration
- Instructions
- Start and end dates
- Evidence associated with AI suggestions
- Prescription editing
- Required reason for every edit
- Before-and-after confirmation
- Revision history
- AI-suggestion approval
- Triggering of dose schedule and care-team pipeline work

### Suggested APIs

```http
GET  /doctor/patients/:patientId/prescriptions
POST /doctor/patients/:patientId/prescriptions
POST /doctor/ai-analyses/:analysisId/prescriptions/approve
POST /doctor/prescriptions/:prescriptionId/revisions
POST /doctor/prescriptions/:prescriptionId/pause
POST /doctor/prescriptions/:prescriptionId/discontinue
```

### Prescription Approval Transaction

The backend should atomically:

1. Verify doctor permission.
2. Verify the related AI analysis and patient.
3. Validate edited medication values.
4. Save the exact values reviewed by the doctor.
5. Create the prescription.
6. Record doctor identity and approval time.
7. Create an origin or revision snapshot.
8. Preserve evidence references.
9. Write an audit event.
10. Enqueue dose-schedule generation.
11. Enqueue reminder configuration.
12. Commit the transaction.

No partially approved prescription should remain if a critical database operation fails.

### Revision History

Preserve:

- Original values
- Updated values
- Reason for change
- Doctor identity
- Change timestamp
- Prescription version
- Correlation ID

Do not overwrite the previous clinical values without retaining immutable history.

---

# 5. Care Team View

**Route:** `/doctor/patients/:patientId/care-team`

### Purpose

Provides operational visibility into the patient's medication-monitoring pipeline, care-team membership, adherence trend, and escalations.

### Current Features

- Escalation severity
- Root cause
- Confidence
- Explanation
- Model version
- Escalation status
- Acknowledge action
- Respond action placeholder
- Five-agent pipeline
- Stage status and last run
- Agent logs
- Trust-score trend
- Care-team members

### Five-Agent Pipeline

1. Reminder Agent
2. Dose Logging Agent
3. Pattern Detection Agent
4. Escalation Agent
5. Care Team Interaction Agent

### Suggested APIs

```http
GET  /doctor/patients/:patientId/care-team
GET  /doctor/patients/:patientId/pipeline-runs
GET  /doctor/pipeline-runs/:runId/stages
GET  /doctor/pipeline-stages/:stageId/logs
GET  /doctor/patients/:patientId/escalations
POST /doctor/escalations/:escalationId/acknowledge
POST /doctor/escalations/:escalationId/respond
POST /doctor/escalations/:escalationId/resolve
```

### Agent 1: Reminder Agent

- Reads upcoming dose schedule events
- Applies patient time zone
- Applies quiet hours
- Sends reminders
- Stores delivery state
- Retries transient delivery failures

### Agent 2: Dose Logging Agent

- Validates patient dose submissions
- Prevents duplicate submissions
- Uses an authoritative server timestamp
- Associates a dose event with the correct schedule slot

### Agent 3: Pattern Detection Agent

- Analyzes adherence and reminder outcomes
- Produces root cause, severity, confidence, and reasoning
- Stores model and input provenance

### Agent 4: Escalation Agent

- Applies escalation policy
- Creates one retry-safe escalation
- Selects recipients based on consent and team membership
- Creates notifications

### Agent 5: Care Team Interaction Agent

- Coordinates outreach
- Produces weekly and monthly reports
- Tracks acknowledgement and response
- Records communication delivery outcomes

### Log Safety

Clinician-visible logs must be sanitized. They must not expose:

- Credentials or API keys
- Raw provider payloads
- Unnecessary patient data
- Private model prompts
- Internal infrastructure secrets

---

# 6. Doctor Settings

**Route:** `/doctor/settings`

### Purpose

Manages the clinician's profile and communication preferences.

### Current Features

- First and last name
- Email
- Specialty
- Time zone
- Notification frequency
- Escalation alerts
- Patient dose-log notifications
- Weekly adherence reports
- AI analysis completion notifications

### Suggested APIs

```http
GET   /doctor/settings
PATCH /doctor/settings/profile
PATCH /doctor/settings/preferences
PATCH /doctor/settings/notifications
```

### Main Data Entities

- `profiles`
- `clinician_profiles`
- `user_preferences`
- `notification_preferences`

Changing an authenticated email address may require a separate verification workflow.

---

# 7. Patient Portal

## 7.1 Patient Portal Shell

**Route scope:** `/patient/*`

### Purpose

Provides patient identity, navigation, and session handling.

### Current Features

- Patient identity
- Home navigation
- Dose Center navigation
- Visit History navigation
- My Data navigation
- Reports navigation
- Settings navigation
- Sign out

### Backend Data

- Authenticated patient profile
- Public Patient ID
- Current setup or consent status
- Optional unread message count

### Suggested API

```http
GET /patient/bootstrap
```

Patient endpoints should derive patient ownership from the session rather than accepting an arbitrary patient selector.

---

## 7.2 Patient Home Dashboard

**Route:** `/patient`

### Purpose

Shows the patient's immediate medication responsibilities and high-level adherence progress.

### Current Features

- Welcome and public Patient ID
- Next-dose countdown
- Taken, late, and missed summary
- Overall adherence score and trend
- Current medications
- Next dose for each medication
- Care-team message
- Link to Dose Center

### Suggested API

```http
GET /patient/dashboard
```

### Suggested Response Sections

- Patient summary
- Next scheduled dose
- Today's dose counts
- 30-day adherence summary
- Adherence trend
- Active medications
- Latest care-team message

### Important Backend Behavior

The next dose should be calculated from:

- Active prescriptions
- Generated dose schedules
- Patient time zone
- Current date and time
- Already recorded dose events

The frontend can display a live countdown, but the due time must come from the backend.

---

## 7.3 Dose Center

**Route:** `/patient/doses`

### Purpose

Allows the patient to record what happened to each scheduled medication dose.

### Current Features

- Today's scheduled doses
- Taken state
- Late logging
- Skipped dose with reason
- Pending-dose actions
- Recent dose history
- Late logging up to 72 hours after schedule time

### Suggested APIs

```http
GET  /patient/doses?date=2026-09-12
GET  /patient/doses/history?cursor=&limit=
POST /patient/dose-events
POST /patient/dose-events/:eventId/correction-requests
```

Example mutation:

```json
{
  "scheduleEventId": "dose-slot-123",
  "status": "taken",
  "reportedAt": "2026-09-12T19:05:00Z",
  "reason": null,
  "idempotencyKey": "client-generated-uuid"
}
```

### Critical Backend Rules

- Confirm that the schedule slot belongs to the authenticated patient.
- Use an authoritative server receipt timestamp.
- Preserve the patient-reported time separately.
- Prevent duplicate dose events for one schedule slot.
- Support safe retries with an idempotency key.
- Validate the allowed late-logging period.
- Store skipped-dose reasons.
- Do not silently mutate historical dose events.
- Use a correction request when a historical event is disputed.

---

## 7.4 Patient Visit History

**Route:** `/patient/visits`

### Purpose

Provides a read-only history of patient-visible care encounters.

### Current Features

- Visit timeline
- Condition
- Symptoms
- Doctor
- Patient-visible notes
- Outcome
- Consent notice
- Direction to contact the care team for corrections

### Suggested APIs

```http
GET  /patient/visits
GET  /patient/visits/:visitId
POST /patient/correction-requests
```

### Patient-Visible Data

The doctor and patient may not receive identical visit payloads. Consider separate fields for:

- Internal clinician note
- Patient-visible summary
- Shared outcome
- Sharing state
- Released time

---

## 7.5 My Data / Transparency

**Route:** `/patient/transparency`

### Purpose

Explains how adherence is calculated, shows what information is tracked, allows the patient to manage optional consent, and provides a correction-request workflow.

### Current Features

- Adherence trust score
- Weighted trust-score components
- Explanation that the score is a clinical signal, not a grade
- Tracked-data disclosure
- Scheduled versus logged comparison
- Delivery failures separated from true misses
- Consent controls
- Data-correction request entry point

### Current Consent Controls

- Share adherence data with care team
- Allow escalation sharing with the broader care team
- Receive weekly and monthly reports
- Allow AI analysis

### Suggested APIs

```http
GET   /patient/transparency
GET   /patient/consents
PATCH /patient/consents/:consentType
POST  /patient/correction-requests
GET   /patient/correction-requests
```

### Consent Storage

Consent should be versioned rather than stored as a single mutable boolean. Preserve:

- Consent type
- Granted or revoked state
- Policy version
- Effective time
- Actor
- Collection method
- Optional expiration
- Audit event

Required consent should not simply be switchable off without explaining the effect on care or initiating the appropriate service-change process.

### Correction Request Data

- Target type
- Target record ID
- Patient explanation
- Supporting attachment, if permitted
- Submitted status
- Review status
- Reviewer
- Resolution
- Creation and completion times

The original clinical record should remain unchanged.

---

## 7.6 Patient Reports

**Route:** `/patient/reports`

### Purpose

Allows patients to upload medical documents for their doctor and read automatically generated adherence reports.

### Medical Upload Features

- Report title
- Report category
- Report date
- PDF, JPG, or PNG selection
- Optional note for doctor
- Upload and share
- Doctor-review state
- RAG indexing state
- Retry failed indexing
- View uploaded file

### Adherence Report Features

- Weekly and monthly reports
- Adherence percentage
- Trend
- Missed days
- Personalized insights
- Email-delivery date
- Next-report schedule

### Suggested APIs

```http
POST /patient/reports/upload-intent
POST /patient/reports
GET  /patient/reports
GET  /patient/reports/:reportId/download-url
POST /patient/reports/:reportId/reindex

GET /patient/adherence-reports
GET /patient/adherence-reports/:reportId
```

### Recommended Upload Flow

1. Patient submits report metadata and file information.
2. Backend validates MIME type and maximum size.
3. Backend issues a signed upload URL or receives the upload.
4. The file is stored in private object storage.
5. Backend verifies the uploaded object.
6. Backend creates report metadata.
7. Backend applies the current sharing consent.
8. Backend enqueues document indexing.
9. Assigned doctor receives a notification.
10. An audit event is recorded.

The current frontend stores base64 report content in `localStorage`. This behavior must be removed in backend-enabled environments.

---

## 7.7 Patient Settings

**Route:** `/patient/settings`

### Purpose

Manages patient contact details, reminders, communication preferences, time zone, quiet hours, and accessibility.

### Current Features

- Email
- Phone
- Time zone
- Quiet-hour start and end
- Email dose reminders
- Weekly report emails
- Monthly report emails
- Care-team messages
- High-contrast mode
- Large-text mode
- Reduced-motion mode

### Suggested APIs

```http
GET   /patient/settings
PATCH /patient/settings/contact
PATCH /patient/settings/reminders
PATCH /patient/settings/communications
PATCH /patient/settings/accessibility
```

### Server-Relevant Preferences

Store these in the backend:

- Time zone
- Quiet hours
- Reminder channels
- Weekly and monthly report preferences
- Care-team communication preferences

Accessibility preferences may be stored in the backend for cross-device consistency or locally if they only affect one browser.

---

# 8. Core Backend Data Domains

## 8.1 Identity and Authorization

- `workspaces`
- `profiles`
- `user_roles`
- `workspace_memberships`
- `patient_accounts`
- `care_team_members`
- `patient_assignments`
- `caregiver_grants`

## 8.2 Patient and Clinical Data

- `patients`
- `patient_contacts`
- `conditions`
- `visits`
- `visit_relationships`
- `clinical_notes`

## 8.3 Medication and Adherence

- `medications`
- `prescriptions`
- `prescription_revisions`
- `dose_schedules`
- `dose_schedule_events`
- `dose_events`
- `adherence_summaries`

## 8.4 Reports and Files

- `patient_reports`
- `report_reviews`
- `document_indexing_jobs`
- Private object storage

## 8.5 RAG and AI

- `knowledge_sources`
- `knowledge_chunks`
- `rag_queries`
- `rag_retrieval_results`
- `ai_analyses`
- `ai_suggestions`
- `ai_review_actions`

## 8.6 Care-Team Operations

- `pipeline_runs`
- `pipeline_stage_runs`
- `agent_logs`
- `escalations`
- `escalation_actions`
- `care_team_messages`

## 8.7 Notifications and Background Work

- `jobs`
- `notifications`
- `notification_deliveries`
- `reminder_deliveries`
- `webhook_events`

## 8.8 Governance

- `consent_records`
- `correction_requests`
- `audit_events`

---

# 9. Important End-to-End Workflows

## 9.1 Patient Registration

```text
Doctor creates patient
→ backend generates Patient ID
→ assignments and consent are saved
→ activation job is created
→ worker sends activation email
→ provider delivery state is saved
→ patient activates account
→ patient status changes to active
```

## 9.2 Prescription to Dose Schedule

```text
Doctor approves prescription
→ prescription and revision are committed
→ schedule-generation job is created
→ worker creates dose schedule slots
→ reminder jobs are created
→ patient sees the next dose
→ reminders are delivered
→ patient logs a dose
→ adherence summary is recalculated
```

## 9.3 Report to RAG

```text
Patient uploads report
→ private file is stored
→ report metadata is saved
→ assigned doctor is notified
→ indexing job runs
→ text is extracted
→ text is normalized and chunked
→ embeddings are created
→ indexing state becomes ready
→ authorized doctor asks a RAG question
→ patient-scoped chunks can be retrieved
```

## 9.4 Adherence Escalation

```text
Dose events accumulate
→ adherence aggregation runs
→ pattern analysis runs
→ root cause, severity, and confidence are recorded
→ escalation policy is evaluated
→ escalation is created
→ authorized care team is notified
→ doctor acknowledges or responds
→ escalation is resolved with an audit trail
```

---

# 10. Cross-Cutting Backend Requirements

## 10.1 Authorization

Every protected request must verify:

- Authenticated account
- User role
- Workspace membership
- Patient ownership or assignment
- Care-team membership
- Caregiver grant, where applicable
- Current consent state

Frontend route protection is not sufficient. Authorization must be enforced by the API and database policies.

## 10.2 Auditability

Record append-only audit events for:

- Login and logout
- Failed authentication
- Private patient-record access
- Patient registration
- Report upload and viewing
- Report review
- Dose logging
- Prescription creation, approval, and editing
- AI analysis creation and review
- Escalation actions
- Consent changes
- Settings changes
- Exports and administrative actions

Audit events should include:

- Actor
- Action
- Target type and ID
- Timestamp
- Workspace
- Correlation ID
- Outcome

Do not store secrets or raw credentials in audit records.

## 10.3 Idempotency

Require idempotency boundaries for:

- Dose logging
- Prescription approval
- Patient registration submission
- Report metadata creation
- Job enqueueing
- Reminder sending
- Notification delivery
- AI-analysis retries
- Webhook processing

## 10.4 Background Jobs

Durable jobs should support:

- Queued state
- Claimed or running state
- Retry count
- Exponential backoff
- Terminal failure
- Dead-letter visibility
- Idempotency key
- Correlation ID

## 10.5 File Security

- Keep medical reports in private storage.
- Validate MIME type, extension, and file size.
- Use short-lived signed download URLs.
- Confirm ownership and authorization before issuing URLs.
- Store checksums and metadata.
- Add malware scanning where available.
- Never expose internal object paths as public permanent URLs.

## 10.6 AI Safety

- Keep provider credentials on the server.
- Minimize patient information sent to the model.
- Store model and prompt versions.
- Validate structured output.
- Treat uploaded and retrieved text as untrusted.
- Preserve uncertainty and conflicting evidence.
- Never allow AI output to activate a prescription.
- Require explicit doctor review for clinical action.

---

# 11. Recommended Backend Implementation Order

## Phase 1: Authentication and Authorization

- Doctor and patient sessions
- `/me`
- Role-gated login
- Protected API middleware
- Workspace and assignment checks

## Phase 2: Core Patient Data

- Patients
- Doctors and care team
- Conditions
- Assignments
- Consent
- Patient registration and activation

## Phase 3: Dashboard and Patient Reads

- Doctor dashboard
- Patient overview
- Visit history
- Active medications
- Patient dashboard

## Phase 4: Prescription and Dose Scheduling

- Prescription model
- Revision history
- Dose schedule generation
- Upcoming dose calculation

## Phase 5: Dose Logging and Adherence

- Idempotent patient dose logging
- Late and skipped dose handling
- Adherence summaries
- Heatmap and trend calculations

## Phase 6: Private Medical Reports

- Private object storage
- Upload flow
- Signed viewing
- Doctor review state

## Phase 7: Prescription Approval Transactions

- AI suggestion review
- Doctor confirmation
- Prescription creation
- Revision and audit records
- Downstream schedule jobs

## Phase 8: Worker and Notifications

- Durable jobs
- Reminder delivery
- Email provider integration
- Delivery webhooks
- Weekly and monthly reports

## Phase 9: Care-Team Pipeline and Escalations

- Pipeline runs and stages
- Pattern analyses
- Escalation creation
- Acknowledge, respond, and resolve

## Phase 10: RAG and Gemini

- Report extraction
- Chunking and embeddings
- pgvector retrieval
- Authorization-aware evidence search
- Gemini structured output
- Complete provenance

## Phase 11: Governance

- Consent history
- Correction requests
- Immutable audit queries
- Security and authorization tests

## Phase 12: Remove Production Mock Behavior

- Replace direct `mockData` reads
- Remove production `localStorage` report persistence
- Add loading, empty, unauthorized, stale, and error states
- Keep mocks only behind an explicit development-only flag

---

# 12. Final Architecture Principle

The frontend should display clinical state and collect user intent. The backend must own:

- Identity
- Authorization
- Clinical truth
- Adherence calculations
- Workflow transitions
- File storage
- AI provenance
- Prescription activation
- Notification delivery state
- Consent enforcement
- Immutable history

This separation is necessary to make the doctor and patient portals persistent, secure, auditable, and safe for future backend expansion.
