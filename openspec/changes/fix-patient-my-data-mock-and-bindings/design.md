# Design: Fix Patient Portal My Data Mock and Bindings

## Technical Design

### 1. Dynamic Assurance & Trust Score Calculation
Instead of hardcoding `98` in both the backend and frontend:
```ts
// Calculate assurance score dynamically:
// Base = patient adherence score (0-100)
// If consent is verified (share_with_care_team is true) -> +5 bonus
// Clamped to 0 - 100
const baseScore = totalAssignedSoFar > 0 ? Math.min(100, Math.round((takenCount / totalAssignedSoFar) * 100)) : 100;
const assuranceScore = consent?.share_with_care_team ? Math.min(100, baseScore) : Math.max(0, baseScore - 10);
```

### 2. True Database Consent Model
The Supabase table `consent_records` defines:
- `share_with_care_team` (boolean)
- `allow_reminders` (boolean)
- `allow_ai_analysis` (boolean)

Frontend `consentMap` maps directly:
```ts
const [consentMap, setConsentMap] = useState({
  shareWithCareTeam: true,
  allowReminders: true,
  allowAiAnalysis: false,
});
```
Removing the fake `escalations` toggle and binding `allowReminders` directly to routine dose reminders and notifications.

### 3. Accurate Scheduled vs. Logged Cards
Four genuine metrics:
- **Total Scheduled**: Total doses assigned due so far (`totalAssignedCount` from `dose_schedules`).
- **Logged (Taken / Late)**: Total taken doses (`takenCount + lateCount`).
- **Missed Doses**: Unlogged doses past grace window (`missedCount`).
- **Skipped Doses**: Doses explicitly recorded as skipped with patient reasons (`skippedCount`).

### 4. Humanized Audit Descriptions
Audit actions in `apps/api/src/routes/patients/index.ts` map to clinical action labels:
- `view_patient` / `read_patient`: "Care team reviewed patient chart"
- `log_dose`: "Dose recorded by patient"
- `update_consent`: "Consent preferences updated"
- `approve_prescription`: "Prescription approved by doctor"
- `upload_report`: "Medical report uploaded"
- `evaluate_daily_pattern`: "Adherence pattern evaluated"
- default: `Action ${a.action} completed`
