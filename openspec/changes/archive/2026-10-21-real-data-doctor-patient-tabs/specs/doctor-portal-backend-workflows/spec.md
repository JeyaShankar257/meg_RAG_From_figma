# Spec Delta

## ADDED Requirements

### Requirement: Patient workspace tabs are server-authoritative and completely eliminate mock data in backend mode
The system SHALL populate all six tabs of the Doctor Portal Patient Clinical Workspace (`/doctor/patients/:patientId`) — Overview, Visits, Adherence, Reports, AI Assistant, and Prescription — from authenticated backend endpoints when backend mode is enabled. The UI MUST NOT render hardcoded demo fixtures (including `DEMO_ADHERENCE`, `DEMO_SPARKLINE`, and `DEMO_AI_ANALYSIS`) when backend mode is configured.

#### Scenario: Doctor loads patient workspace in backend mode
- **WHEN** an authenticated doctor navigates to `/doctor/patients/:patientId` with backend mode enabled
- **THEN** the system issues concurrent authorized requests for patient demographics, visits, adherence, reports, and prescriptions, rendering real database state across all tabs

#### Scenario: Doctor views an unassigned patient workspace
- **WHEN** a doctor requests a patient workspace outside their assigned roster or care-team scope
- **THEN** the system returns an authorization failure (HTTP 403 or 404) and displays a patient-access error state rather than falling back to demo records

### Requirement: Adherence calculation and reporting strictly enforces binary taken and missed metrics
The system SHALL calculate adherence scores, status breakdowns, and historical heatmap data using strictly binary dose outcomes: `taken` and `missed`. Legacy statuses `late` and `skipped` MUST be removed from calculations, metric badges, heatmap statuses, and trend tracking.

#### Scenario: Server calculates binary adherence score
- **WHEN** an adherence report is requested for a patient with logged doses
- **THEN** the system calculates score as $\frac{\text{takenCount}}{\text{takenCount} + \text{missedCount}} \times 100$, returns exact counts for `taken` and `missed`, and omits `late` and `skipped` metrics

#### Scenario: Adherence heatmap and trend rendering
- **WHEN** the doctor views the 90-day adherence heatmap or 3-month sparkline
- **THEN** daily indicators display strictly binary states (`taken` or `missed`), and the score trend chart renders server-computed periodic adherence data

### Requirement: Patient clinical tabs provide structured error handling and recoverable state transitions
Each clinical tab in the patient workspace SHALL handle loading, error, empty, and mutation states independently without causing entire-page crashes or unrecoverable blank views.

#### Scenario: Sub-resource failure does not break unaffected tabs
- **WHEN** one sub-resource (such as adherence or visits) fails to load due to network error
- **THEN** the affected tab displays a contextual error alert with a retry action, while other tabs remain interactive and functional

#### Scenario: Patient has no recorded clinical history
- **WHEN** a newly registered patient has no visits, dose logs, or uploaded reports
- **THEN** each tab displays a clean, descriptive clinical empty state instead of misleading `0%` or broken layout
