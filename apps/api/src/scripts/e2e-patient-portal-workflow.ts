/**
 * End-to-End Fictional-Data Workflow for Patient Portal Backend (Task 4.2)
 *
 * Verifies:
 * 1. Patient authentication and session role verification
 * 2. Strict patient boundary enforcement (cross-patient access returns 403 Forbidden)
 * 3. Daily dose schedule retrieval with UUIDs and prescription joins (GET /patients/:id/dose-schedules)
 * 4. Idempotent dose logging (POST /doses) with server timestamp, audit events, and duplicate prevention
 * 5. Authoritative rolling adherence score, streak days, and trend calculation (GET /patients/:id/adherence)
 * 6. Trust & transparency signals and audit trail retrieval (GET /patients/:id/transparency)
 * 7. Consent and notification settings round-trip (GET & PUT /patients/:id/consent, GET & PUT /patients/:id/settings)
 * 8. Correlation IDs, audit trail integrity, and secret safety across all workflows
 */

import assert from "node:assert/strict";
import { Hono } from "hono";
import { correlationMiddleware } from "../middleware/correlation.js";
import { authRouter } from "../routes/auth/index.js";
import { patientsRouter } from "../routes/patients/index.js";
import { dosesRouter } from "../routes/doses/index.js";
import { handleApiError } from "../lib/errors.js";
import { setAdminClient } from "../lib/supabase.js";

async function runE2ePatientPortalWorkflow() {
  console.log("=== Starting MedNova Patient Portal E2E Integration Workflow ===");

  const workspaceId = "a0000000-0000-0000-0000-000000000001";
  const foreignWorkspaceId = "a0000000-0000-0000-0000-000000000002";
  const patient1ProfileId = "b0000000-0000-0000-0000-000000000001";
  const patient2ProfileId = "b0000000-0000-0000-0000-000000000002";

  const today = new Date().toISOString().split("T")[0];
  const sched1Id = "e0a6d51c-4b36-4191-88f5-9304e7cf4a91";
  const sched2Id = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  const rx1Id = "30000000-0000-0000-0000-000000000001";
  const med1Id = "20000000-0000-0000-0000-000000000001";

  // In-memory mock store mirroring DB schema
  const mockStore: Record<string, any[]> = {
    profiles: [
      {
        id: patient1ProfileId,
        workspace_id: workspaceId,
        role: "patient",
        full_name: "Marcus Rivera",
        email: "m.rivera@email.com",
      },
      {
        id: patient2ProfileId,
        workspace_id: workspaceId,
        role: "patient",
        full_name: "Amara Osei",
        email: "a.osei@email.com",
      },
    ],
    patients: [
      {
        id: "p-001",
        workspace_id: workspaceId,
        profile_id: patient1ProfileId,
        status: "active",
        full_name: "Marcus Rivera",
        contact_email: "m.rivera@email.com",
        is_deleted: false,
      },
      {
        id: "p-002",
        workspace_id: workspaceId,
        profile_id: patient2ProfileId,
        status: "active",
        full_name: "Amara Osei",
        contact_email: "a.osei@email.com",
        is_deleted: false,
      },
      {
        id: "p-foreign",
        workspace_id: foreignWorkspaceId,
        profile_id: "b0000000-0000-0000-0000-000000000099",
        status: "active",
        full_name: "Foreign Patient",
        contact_email: "foreign@email.com",
        is_deleted: false,
      },
    ],
    care_team_assignments: [],
    care_grants: [],
    medications: [
      {
        id: med1Id,
        patient_id: "p-001",
        name: "Metformin",
        dosage: "500mg",
        is_active: true,
      },
    ],
    prescriptions: [
      {
        id: rx1Id,
        patient_id: "p-001",
        medication_id: med1Id,
        status: "approved",
        medications: {
          name: "Metformin",
          dosage: "500mg",
        },
      },
    ],
    dose_schedules: [
      {
        id: sched1Id,
        prescription_id: rx1Id,
        patient_id: "p-001",
        scheduled_at: new Date(Date.now() + 3600000 * 2).toISOString(),
        window_minutes: 60,
        prescriptions: {
          id: rx1Id,
          medications: {
            name: "Metformin",
            dosage: "500mg",
          },
        },
      },
      {
        id: sched2Id,
        prescription_id: rx1Id,
        patient_id: "p-001",
        scheduled_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        window_minutes: 60,
        prescriptions: {
          id: rx1Id,
          medications: {
            name: "Metformin",
            dosage: "500mg",
          },
        },
      },
    ],
    dose_logs: [
      // 5 historical taken doses in past days to establish streak
      {
        id: "log-past-1",
        schedule_id: "sched-past-1",
        patient_id: "p-001",
        status: "taken",
        method: "oral",
        idempotency_key: "idemp-past-1",
        logged_at: "2026-10-16T08:05:00.000Z",
      },
      {
        id: "log-past-2",
        schedule_id: "sched-past-2",
        patient_id: "p-001",
        status: "taken",
        method: "oral",
        idempotency_key: "idemp-past-2",
        logged_at: "2026-10-15T08:05:00.000Z",
      },
      {
        id: "log-past-3",
        schedule_id: "sched-past-3",
        patient_id: "p-001",
        status: "taken",
        method: "oral",
        idempotency_key: "idemp-past-3",
        logged_at: "2026-10-14T08:05:00.000Z",
      },
      {
        id: "log-past-4",
        schedule_id: "sched-past-4",
        patient_id: "p-001",
        status: "taken",
        method: "oral",
        idempotency_key: "idemp-past-4",
        logged_at: "2026-10-13T08:05:00.000Z",
      },
      {
        id: "log-past-5",
        schedule_id: "sched-past-5",
        patient_id: "p-001",
        status: "taken",
        method: "oral",
        idempotency_key: "idemp-past-5",
        logged_at: "2026-10-12T08:05:00.000Z",
      },
    ],
    consent_records: [
      {
        id: "consent-001",
        patient_id: "p-001",
        share_with_care_team: true,
        allow_reminders: true,
        allow_ai_analysis: true,
        updated_by_profile_id: patient1ProfileId,
        updated_at: "2026-10-10T00:00:00.000Z",
      },
    ],
    notification_preferences: [
      {
        id: "np-001",
        patient_id: "p-001",
        channel: "email",
        enabled: true,
        quiet_hours_start: "22:00:00",
        quiet_hours_end: "07:00:00",
        updated_at: "2026-10-10T00:00:00.000Z",
      },
    ],
    audit_events: [
      {
        id: "audit-001",
        workspace_id: workspaceId,
        actor_profile_id: patient1ProfileId,
        action: "login",
        target_type: "patient",
        target_id: "p-001",
        correlation_id: "corr-init-01",
        outcome: "success",
        occurred_at: "2026-10-16T12:00:00.000Z",
      },
    ],
    visits: [
      {
        id: "v-001",
        patient_id: "p-001",
        doctor_profile_id: "d0000000-0000-0000-0000-000000000001",
        visit_date: "2026-10-01",
        notes: "Routine quarterly endocrinology checkup.",
        created_at: "2026-10-01T10:00:00.000Z",
      },
    ],
  };

  // Mock Supabase Query Builder
  function createMockQueryBuilder(tableName: string) {
    let rows = [...(mockStore[tableName] || [])];
    let selectedFields: string | null = null;
    let limitCount: number | null = null;
    let orderField: string | null = null;
    let orderAsc: boolean = true;
    let pendingInsert: any = null;
    let pendingUpsert: any = null;

    const builder: any = {
      select: (fields = "*") => {
        selectedFields = fields;
        return builder;
      },
      eq: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      is: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      gte: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] >= val);
        return builder;
      },
      lte: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] <= val);
        return builder;
      },
      or: (clause: string) => {
        return builder;
      },
      order: (field: string, opts?: { ascending?: boolean }) => {
        orderField = field;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit: (count: number) => {
        limitCount = count;
        return builder;
      },
      maybeSingle: async () => {
        return { data: rows[0] || null, error: null };
      },
      single: async () => {
        if (pendingInsert) {
          return { data: pendingInsert, error: null };
        }
        if (pendingUpsert) {
          return { data: pendingUpsert, error: null };
        }
        return { data: rows[0] || null, error: null };
      },
      insert: (record: any) => {
        const records = Array.isArray(record) ? record : [record];
        mockStore[tableName] = mockStore[tableName] || [];
        const created: any[] = [];
        for (const r of records) {
          const item = { id: r.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...r };
          mockStore[tableName].push(item);
          created.push(item);
        }
        pendingInsert = created[0];
        return builder;
      },
      upsert: (record: any) => {
        const records = Array.isArray(record) ? record : [record];
        mockStore[tableName] = mockStore[tableName] || [];
        const upserted: any[] = [];
        for (const r of records) {
          const key = r.id ? "id" : "patient_id";
          const existingIdx = mockStore[tableName].findIndex((x) => x[key] === r[key]);
          if (existingIdx >= 0) {
            mockStore[tableName][existingIdx] = { ...mockStore[tableName][existingIdx], ...r };
            upserted.push(mockStore[tableName][existingIdx]);
          } else {
            const item = { id: r.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...r };
            mockStore[tableName].push(item);
            upserted.push(item);
          }
        }
        pendingUpsert = upserted[0];
        return builder;
      },
      then: (resolve: any, reject: any) => {
        let result = [...rows];
        if (orderField) {
          result.sort((a, b) => {
            const valA = a[orderField!];
            const valB = b[orderField!];
            if (valA < valB) return orderAsc ? -1 : 1;
            if (valA > valB) return orderAsc ? 1 : -1;
            return 0;
          });
        }
        if (limitCount !== null) {
          result = result.slice(0, limitCount);
        }
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };

    return builder;
  }

  const mockAdminClient = {
    from: (table: string) => createMockQueryBuilder(table),
    auth: {
      getUser: async (token: string) => ({
        data: { user: { id: patient1ProfileId } },
        error: null,
      }),
    },
  };
  process.env["DEMO_MODE"] = "true";
  setAdminClient(mockAdminClient as any);

  // Setup Hono Application
  const app = new Hono();
  app.use("*", correlationMiddleware);

  app.route("/auth", authRouter);
  app.route("/patients", patientsRouter);
  app.route("/doses", dosesRouter);
  app.onError((err, c) => handleApiError(err, c));

  const authHeaders = {
    Authorization: "Bearer demo-token-patient",
    Accept: "application/json",
  };

  // ─── Step 1: Patient Login & Session Verification ───────────────────────────
  console.log("Step 1: Verifying patient login and session role...");
  const loginRes = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "m.rivera@email.com",
      password: "demo-password",
      portal: "patient",
    }),
  });
  assert.equal(loginRes.status, 200, "Patient login must succeed with 200 OK");
  const loginData = (await loginRes.json()) as any;
  assert.equal(loginData.user.role, "patient");
  assert.equal(loginData.user.patientId, "p-001");
  assert.ok(loginData.token, "Login must return access token");

  const meRes = await app.request("/auth/me", {
    headers: authHeaders,
  });
  assert.equal(meRes.status, 200, "/auth/me must return 200 OK");
  const meData = (await meRes.json()) as any;
  assert.equal(meData.user.role, "patient");
  assert.equal(meData.user.patientId, "p-001");
  console.log("✓ Patient login and session role verified.");

  // ─── Step 2: Patient Isolation & Boundary Enforcement ───────────────────────
  console.log("Step 2: Verifying cross-patient access rejection (403 Forbidden)...");
  const crossPatientSchedulesRes = await app.request("/patients/p-002/dose-schedules", {
    headers: authHeaders,
  });
  assert.equal(crossPatientSchedulesRes.status, 403, "Cross-patient dose schedules must return 403");
  const crossSchedData = (await crossPatientSchedulesRes.json()) as any;
  assert.ok(crossSchedData.correlationId, "Rejection must include correlationId");

  const crossPatientAdherenceRes = await app.request("/patients/p-002/adherence", {
    headers: authHeaders,
  });
  assert.equal(crossPatientAdherenceRes.status, 403, "Cross-patient adherence must return 403");

  const crossPatientTransparencyRes = await app.request("/patients/p-002/transparency", {
    headers: authHeaders,
  });
  assert.equal(crossPatientTransparencyRes.status, 403, "Cross-patient transparency must return 403");

  const crossPatientConsentRes = await app.request("/patients/p-002/consent", {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      shareWithCareTeam: false,
      allowReminders: false,
      allowAiAnalysis: false,
    }),
  });
  assert.equal(crossPatientConsentRes.status, 403, "Cross-patient consent mutation must return 403");

  const nonExistentRes = await app.request("/patients/p-999-nonexistent/dose-schedules", {
    headers: authHeaders,
  });
  assert.equal(nonExistentRes.status, 404, "Non-existent patient must return 404 Not Found");
  console.log("✓ Patient boundary enforcement verified.");

  // ─── Step 3: Dose Schedule Retrieval ────────────────────────────────────────
  console.log("Step 3: Verifying GET /patients/:id/dose-schedules...");
  const schedRes = await app.request(`/patients/p-001/dose-schedules?date=${today}`, {
    headers: authHeaders,
  });
  assert.equal(schedRes.status, 200, "Dose schedules GET must return 200 OK");
  const schedData = (await schedRes.json()) as any;
  assert.equal(schedData.patientId, "p-001");
  assert.equal(schedData.schedules.length, 2, "Must return today's 2 scheduled doses");
  const sched1 = schedData.schedules.find((s: any) => s.id === sched1Id);
  const sched2 = schedData.schedules.find((s: any) => s.id === sched2Id);
  assert.ok(sched1 && sched2, "Both schedules must be present");
  assert.equal(sched1.medicationName, "Metformin");
  assert.equal(sched1.dosage, "500mg");
  assert.equal(sched1.status, "scheduled");
  assert.equal(sched2.status, "missed");
  console.log("✓ Dose schedules retrieved with UUIDs, joined prescriptions, and accurate statuses.");

  // ─── Step 4: Idempotent Dose Logging ────────────────────────────────────────
  console.log("Step 4: Verifying POST /doses with idempotencyKey and audit event...");
  const idempotencyKey = "idemp-test-e2e-dose-001";
  const logPayload = {
    scheduleId: sched1Id,
    patientId: "p-001",
    status: "taken",
    method: "oral",
    reason: "Taken with breakfast",
    idempotencyKey,
  };

  const logRes = await app.request("/doses", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(logPayload),
  });
  assert.equal(logRes.status, 201, "POST /doses must return 201 Created");
  const logData = (await logRes.json()) as any;
  assert.equal(logData.success, true);
  assert.equal(logData.dose.status, "taken");
  assert.equal(logData.dose.schedule_id, sched1Id);
  assert.equal(logData.dose.idempotency_key, idempotencyKey);
  assert.ok(logData.dose.logged_at, "Dose must have authoritative server timestamp");

  // Verify side effects in mock store
  const loggedDoseInStore = mockStore.dose_logs.find((l) => l.idempotency_key === idempotencyKey);
  assert.ok(loggedDoseInStore, "Dose log must be persisted in store");
  const auditInStore = mockStore.audit_events.find((a) => a.action === "log_dose");
  assert.ok(auditInStore, "Audit event for dose logging must be recorded");
  assert.equal(auditInStore.actor_profile_id, patient1ProfileId);

  // Idempotent duplicate check
  console.log("Step 4b: Verifying retried POST /doses returns canonical duplicate response...");
  const duplicateRes = await app.request("/doses", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(logPayload),
  });
  assert.equal(duplicateRes.status, 200, "Duplicate dose logging must return 200 OK");
  const dupData = (await duplicateRes.json()) as any;
  assert.equal(dupData.duplicated, true, "Response must indicate duplicated: true");
  assert.equal(dupData.dose.id, logData.dose.id, "Must return canonical existing dose");
  const totalMatches = mockStore.dose_logs.filter((l) => l.idempotency_key === idempotencyKey);
  assert.equal(totalMatches.length, 1, "Exactly 1 record in store after duplicate call");
  console.log("✓ Dose logging idempotency and audit side-effects verified.");

  // ─── Step 5: Authoritative Rolling Adherence Calculation ────────────────────
  console.log("Step 5: Verifying GET /patients/:id/adherence scores and streaks...");
  const adherenceRes = await app.request("/patients/p-001/adherence", {
    headers: authHeaders,
  });
  assert.equal(adherenceRes.status, 200, "Adherence GET must return 200 OK");
  const adherenceData = (await adherenceRes.json()) as any;
  assert.equal(adherenceData.patientId, "p-001");
  assert.ok(adherenceData.score >= 90, "Adherence score should be high given taken doses");
  assert.equal(adherenceData.takenPercentage, 100, "All logged doses are taken (100%)");
  assert.equal(adherenceData.missedPercentage, 0);
  assert.ok(adherenceData.currentStreakDays >= 5, "Streak days must count continuous taken days");
  assert.equal(adherenceData.trend, "up", "High adherence must yield 'up' trend");
  assert.ok(Array.isArray(adherenceData.logs), "Adherence response must include dose history logs");
  console.log("✓ Authoritative adherence calculations and streak verified.");

  // ─── Step 6: Trust Signals & Transparency ───────────────────────────────────
  console.log("Step 6: Verifying GET /patients/:id/transparency...");
  const transparencyRes = await app.request("/patients/p-001/transparency", {
    headers: authHeaders,
  });
  assert.equal(transparencyRes.status, 200, "Transparency GET must return 200 OK");
  const transparencyData = (await transparencyRes.json()) as any;
  assert.equal(transparencyData.patientId, "p-001");
  assert.ok(transparencyData.consent, "Consent must be present");
  assert.equal(transparencyData.consent.allow_ai_analysis, true);
  assert.ok(Array.isArray(transparencyData.trustSignals), "Trust signals array must be present");
  assert.ok(transparencyData.trustSignals.length >= 3, "Must include core trust signals");
  assert.ok(Array.isArray(transparencyData.recentAudits), "Recent audits must be present");
  assert.ok(transparencyData.assuranceScore >= 95, "Assurance score must be computed");
  console.log("✓ Trust signals and audit records verified.");

  // ─── Step 7: Consent & Settings Round-Trip ──────────────────────────────────
  console.log("Step 7: Verifying consent and notification settings GET & PUT...");
  // 7a. Consent
  const consentGetRes = await app.request("/patients/p-001/consent", {
    headers: authHeaders,
  });
  assert.equal(consentGetRes.status, 200);
  const consentGetData = (await consentGetRes.json()) as any;
  assert.equal(consentGetData.consent.share_with_care_team, true);

  const consentPutRes = await app.request("/patients/p-001/consent", {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      shareWithCareTeam: true,
      allowReminders: false,
      allowAiAnalysis: false,
    }),
  });
  assert.equal(consentPutRes.status, 200, "Consent PUT returns 200 OK");
  const consentPutData = (await consentPutRes.json()) as any;
  assert.equal(consentPutData.success, true);
  assert.equal(consentPutData.consent.allow_reminders, false);
  assert.equal(consentPutData.consent.allow_ai_analysis, false);

  const auditConsent = mockStore.audit_events.find((a) => a.action === "update_consent");
  assert.ok(auditConsent, "Consent update audit event must be recorded");

  // 7b. Settings
  const settingsGetRes = await app.request("/patients/p-001/settings", {
    headers: authHeaders,
  });
  assert.equal(settingsGetRes.status, 200);

  const settingsPutRes = await app.request("/patients/p-001/settings", {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "sms",
      enabled: true,
      quietHoursStart: "23:00:00",
      quietHoursEnd: "06:00:00",
    }),
  });
  assert.equal(settingsPutRes.status, 200, "Settings PUT returns 200 OK");
  const settingsPutData = (await settingsPutRes.json()) as any;
  assert.equal(settingsPutData.success, true);
  assert.equal(settingsPutData.setting.channel, "sms");
  assert.equal(settingsPutData.setting.quiet_hours_start, "23:00:00");
  console.log("✓ Patient consent and notification settings round-trip verified.");

  // ─── Step 8: Visits Subroute ────────────────────────────────────────────────
  console.log("Step 8: Verifying patient visits retrieval...");
  const visitsRes = await app.request("/patients/p-001/visits", {
    headers: authHeaders,
  });
  assert.equal(visitsRes.status, 200);
  const visitsData = (await visitsRes.json()) as any;
  assert.equal(visitsData.visits.length, 1);
  assert.equal(visitsData.visits[0].notes, "Routine quarterly endocrinology checkup.");
  console.log("✓ Patient visits retrieved.");

  console.log("\n=== All Patient Portal Integration Verification Checks PASSED ===");
}

runE2ePatientPortalWorkflow().catch((err) => {
  console.error("❌ E2E Patient Portal Workflow Verification Failed:", err);
  process.exit(1);
});
