# patient-my-data-transparency Spec

## Requirements

### Requirement 1: Dynamic Trust Score Calculation
The trust score displayed on the My Data page MUST be dynamically calculated from the patient's real adherence records and verified consent state. Hardcoded fallbacks (e.g. 98 or 95) MUST be eliminated.

### Requirement 2: 1-to-1 Real Consent Bindings
Consent toggles MUST strictly bind to the existing `consent_records` columns: `share_with_care_team`, `allow_reminders`, and `allow_ai_analysis`. Non-existent toggles (such as `escalations`) MUST NOT be presented.

### Requirement 3: Genuine Scheduled and Logged Adherence Metrics
The "Scheduled vs. Logged" section MUST display real counts:
- Total scheduled doses due so far from `dose_schedules`.
- Logged taken/late doses.
- True missed doses.
- Skipped doses with reasons.
Synthetic metrics (such as fake delivery failures) MUST NOT be displayed.

### Requirement 4: Real Timestamps and User-Friendly Audit Trail
Trust signals MUST use actual verification timestamps (`consent.updated_at`, latest audit timestamp). The audit trail MUST present user-friendly descriptions and include a supportive empty state when no events exist.
