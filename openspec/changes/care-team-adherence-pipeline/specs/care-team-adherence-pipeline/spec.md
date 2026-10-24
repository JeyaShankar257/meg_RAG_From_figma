# care-team-adherence-pipeline Specification

## Purpose

Provides a closed-loop, tiered clinical adherence workflow featuring proactive dose reminders, end-of-day daily pattern detection, personalized patient health warnings, and doctor/guardian SOS escalation alerts.

## ADDED Requirements

### Requirement: Daily End-of-Day Pattern Evaluation
The system SHALL evaluate patient medication adherence at the end of each day (or on-demand via the authorized care-team evaluation trigger). The evaluation MUST calculate rolling 7-day adherence, current streak, and consecutive skipped days across all active scheduled doses.

#### Scenario: Normal adherence evaluated at end-of-day
- **WHEN** daily evaluation runs and the patient has adherence >= 80% with no consecutive skips
- **THEN** the system marks the Pattern Detection stage complete, maintains the current streak, and leaves escalation stages idle

#### Scenario: Emerging non-adherence triggers Level 1 warning
- **WHEN** daily evaluation detects 2 consecutive skipped days or 7-day adherence below 75%
- **THEN** the system transitions the Patient Health Warning stage to active, generates drug-specific clinical risk information, dispatches an educational email to the patient, and records a 48-hour cooldown

### Requirement: Level 2 Doctor and Guardian SOS Escalation
The system SHALL escalate to Level 2 SOS when a patient exhibits persistent non-adherence after a Level 1 warning (e.g. 48-72 hours non-responsive or 3+ consecutive skipped days). The system MUST create an urgent escalation banner on the doctor's dashboard and dispatch an emergency notification to the patient's registered guardian.

#### Scenario: Persistent non-adherence triggers SOS alert
- **WHEN** a patient continues skipping medication for 3 or more consecutive days after receiving a Level 1 warning
- **THEN** the system generates an urgent escalation record, flags the Doctor Care Team view with high-priority SOS status, and delivers an SOS alert email to the patient's registered emergency guardian

#### Scenario: Guardian notification respects registered contact authorization
- **WHEN** Level 2 SOS is triggered for a patient with registered emergency guardian details (`guardian_name`, `guardian_email`)
- **THEN** the system dispatches the SOS notification to the registered guardian email and logs the delivery outcome in the audit trail
