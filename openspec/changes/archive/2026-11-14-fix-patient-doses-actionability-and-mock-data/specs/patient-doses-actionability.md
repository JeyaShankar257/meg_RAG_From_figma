# patient-doses-actionability Spec

## Requirements

### Requirement 1: Actionable Doses Beyond Grace Window
Scheduled doses for today that have not yet been recorded as taken or skipped MUST remain actionable in the Patient Portal Doses UI.
- If the dose time has passed the grace window without an existing log, the UI MUST display a past-due indicator while providing "Take Dose" and "Skip Dose" actions.
- Action buttons MUST NOT be hidden purely because the backend returns `status: "missed"`.
- Upon taking or skipping, the dose transitions to recorded state with logged timestamp or skip reason.

### Requirement 2: Live Adherence History
The "Recent History" section on the Doses page MUST reflect live dose logs returned by `api.patients.getAdherence(patientId)` rather than static hardcoded mock entries.
- Each history row must display the localized date, medication name and dosage, time/reason, and status pill.
- If no logs exist for the patient, a clear empty state card MUST be shown.
- Logging a dose as taken or skipped MUST immediately prepend the new record to the local history state.

### Requirement 3: Enriched Adherence API Response
The `GET /patients/:id/adherence` endpoint MUST include medication name and dosage when available via relationship join `dose_schedules -> prescriptions -> medications`.
