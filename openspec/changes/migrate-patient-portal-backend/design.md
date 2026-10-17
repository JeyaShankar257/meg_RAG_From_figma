# Design: Patient Portal Backend Migration

## Context

See `proposal.md` for motivation. The backend foundation (`apps/api`, `apps/worker`), database tables (`doses`, `dose_schedules`, `prescriptions`, `patient_consents`, `patient_preferences`, `visits`, `audit_logs`), and doctor portal workflows are established. The patient portal (`src/pages/patient/*`) currently interacts with some endpoints (`/doses/log`, `/reports`) but continues to depend on static mock fixtures (`DEMO_PRESCRIPTIONS`, `DEMO_ADHERENCE`, `DEMO_SPARKLINE`, `DEMO_VISITS`, `DEMO_TRUST_COMPONENTS`) for schedules, aggregates, and transparency.

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Authenticated Patient
    participant Frontend as Patient Portal (React)
    participant API as Fastify API (apps/api)
    participant Auth as Auth & RLS Policy Guard
    participant DB as Postgres & Audit Log
    participant Worker as Durable Worker Queue

    Note over Patient,Frontend: Session holds JWT with patient role
    Patient->>Frontend: Open Dose Center / Dashboard
    Frontend->>API: GET /patients/:id/dose-schedules (Bearer Token)
    API->>Auth: Validate JWT subject matches :id or proxy claim
    Auth-->>API: Authorized (patient: p-001)
    API->>DB: Query scheduled slots for date range
    DB-->>API: Return schedule slots & dose log status
    API-->>Frontend: 200 OK (Authoritative Schedules & Statuses)
    Frontend-->>Patient: Render authoritative dose list & countdown

    Patient->>Frontend: Click "Take Dose" (Metformin 1000mg)
    Frontend->>API: POST /doses/log {scheduleId, status: "taken", idempotencyKey}
    API->>Auth: Verify caller identity
    API->>DB: Check idempotency table (idempotency_key)
    alt Retried request
        DB-->>API: Existing dose log record found
        API-->>Frontend: 200 OK (Cached canonical response)
    else New dose event
        API->>DB: INSERT INTO doses, UPDATE schedule status
        API->>DB: INSERT INTO audit_logs (event: dose_logged)
        API->>Worker: Enqueue adherence aggregation & streak recalculation
        API-->>Frontend: 200 OK {doseId, status: "taken", loggedAt}
    end
    Frontend-->>Patient: Update UI with confirmation & streak animation
```

## Goals / Non-Goals

**Goals:**
- Provide typed, authorized endpoints for patient daily dose schedules, live adherence aggregates, visits history, and consent management.
- Ensure idempotent dose logging using client request keys with server-recorded timestamps.
- Display verified, server-calculated adherence percentages and streaks without hardcoded fallbacks in backend-configured mode.
- Enforce strict patient-isolation security: patients can only access their own records (`patient_id = auth.uid()`).
- Maintain bounded development demo mode when backend environment variables are absent.

**Non-Goals:**
- Self-registration / sign-up flow without clinician invite (covered in clinical identity specification).
- Real-time WebRTC or messaging chat with clinicians (adherence messaging uses asynchronous care team notifications).
- Patient-initiated medication prescription creation (prescriptions strictly require doctor approval).

## Decisions

### 1. Daily Dose Schedule Resolution via Server Query
- **Decision**: Introduce a dedicated endpoint `GET /patients/:id/dose-schedules?date=YYYY-MM-DD` that evaluates active prescriptions, frequencies, and scheduled time windows, joining existing dose logs for that date.
- **Alternatives Considered**:
  - *Compute schedule client-side from prescription frequency*: Rejected because clinical adherence logic (e.g., missed window thresholds, grace periods, dose timings) must remain server-authoritative and synchronized between doctor and patient views.
  - *Pre-generate all future schedule rows in database*: Rejected as inflexible when prescriptions are adjusted or discontinued. Dynamic range resolution over active prescriptions and schedule slots is leaner and prevents orphan future records.

### 2. Client-Supplied Idempotency Key for Dose Events
- **Decision**: Require `idempotencyKey: UUID` on `POST /doses/log`. The API checks for existing completed operations within a 24-hour window before creating new dose events or audit rows.
- **Alternatives Considered**:
  - *Rely solely on schedule ID and date*: Disallows intentional multi-dose correction or late adjustment if needed. An explicit idempotency key guarantees safe retries across flaky mobile networks.

### 3. Server-Computed Adherence Aggregates and Streak Counts
- **Decision**: Expose `GET /patients/:id/adherence` returning rolling 7-day, 30-day, and all-time compliance rates (`takenPercentage`, `latePercentage`, `missedCount`, `currentStreakDays`, `trend`).
- **Alternatives Considered**:
  - *Send all raw dose logs to the client and calculate in React*: Inefficient for patients with long histories; leaks internal log schemas and makes cross-platform metric calculation inconsistent.

### 4. Patient Isolation & Authorization Boundaries
- **Decision**: All patient endpoints enforce that `req.user.role === 'patient'` AND `req.user.patientId === req.params.id` (or caregiver proxy). Clinicians must have active patient assignments. Attempts to query cross-patient IDs return standard 404/403 without revealing existence.
- **Audit Boundary**: Every dose mutation, consent toggle, and settings update writes an immutable record to `audit_logs` capturing `user_id`, `patient_id`, `action`, `metadata`, and `ip/user_agent`.

### 5. Explicit Bounded Fallback Architecture
- **Decision**: Preserve `isBackendConfigured()` guard in frontend API client. In development without backend, patient pages use localized mock snapshots (`todayDoses`, `DEMO_ADHERENCE`, etc.). When backend is configured, failures display actionable retry states and never silently fall back to demo numbers.

## Risks / Trade-offs

- **[Risk] Flaky mobile connections causing repeated dose button taps** → *Mitigation*: Client disables button on first tap and passes `crypto.randomUUID()` idempotency key; API deduplicates within transaction.
- **[Risk] Discrepancy between doctor dashboard adherence and patient dashboard adherence** → *Mitigation*: Both portals consume the exact same underlying adherence aggregate calculation service in `apps/api`.
- **[Risk] Patient toggling consent while clinical worker is processing a pipeline stage** → *Mitigation*: Worker re-verifies consent at execution time before dispatching reminders or sharing notes.

## Migration Plan

1. **Contracts & API Endpoints**: Add patient schedule and adherence response schemas in `@mednova/contracts`, implement endpoints in `apps/api/src/routes/patients/` and `apps/api/src/routes/doses/`.
2. **Frontend Client & State Wiring**: Update `apiClient.ts` with typed methods, wire `DoseCenter.tsx`, `Dashboard.tsx`, `Visits.tsx`, `Transparency.tsx`, and `Settings.tsx`.
3. **Verification**: Run frontend integration tests, API contract tests, and end-to-end verification.
