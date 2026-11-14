# medication-lifecycle Spec

## Requirements

### Requirement 1: Explicit Start and End Dates
Prescriptions and medications MUST record `start_date` and `end_date`.
- If not explicitly provided, `start_date` defaults to the date of prescription approval.
- `end_date` defaults to `start_date + duration_days`.

### Requirement 2: Duration-Bounded Dose Schedules
The system MUST generate dose schedules only for the duration of the prescription.
- A 5-day prescription MUST NOT generate 30 days of dose schedules.
- Dose schedules MUST only be created between `start_date` and `end_date`.

### Requirement 3: Automated Expiration of Completed Medications
Medications that have passed their `end_date` MUST NOT be returned in active medication queries (`GET /patients/:id/medications`).
- Patient Portal Home page MUST only display medications whose `end_date >= current_date`.
