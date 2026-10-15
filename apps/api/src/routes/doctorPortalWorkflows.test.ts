import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { correlationMiddleware } from "../middleware/correlation.js";
import { doctorRouter } from "./doctor/index.js";
import { prescriptionsRouter } from "./prescriptions/index.js";
import { handleApiError } from "../lib/errors.js";

vi.mock("../config.js", () => ({
    getConfig: vi.fn(() => ({
        demoMode: true,
        signedUrlExpirySeconds: 300,
    })),
    initConfig: vi.fn(),
}));

const doctorProfileId = "d0000000-0000-0000-0000-000000000001";
const doctorWorkspaceId = "a0000000-0000-0000-0000-000000000001";
const otherWorkspaceId = "a0000000-0000-0000-0000-000000000002";

let mockStore: Record<string, any[]> = {};

function resetMockStore() {
    mockStore = {
        profiles: [
            {
                id: doctorProfileId,
                workspace_id: doctorWorkspaceId,
                role: "doctor",
                full_name: "Dr. Sarah Chen",
                email: "s.chen@mednova.clinic",
                preferences: {
                    displayName: "Dr. Sarah Chen",
                    specialty: "Cardiology",
                    phone: "+1-555-0199",
                    notification: {
                        channels: ["email", "push"],
                        quietHoursStart: "22:00",
                        quietHoursEnd: "07:00",
                    },
                },
            },
        ],
        patients: [
            {
                id: "p-001",
                workspace_id: doctorWorkspaceId,
                full_name: "Marcus Rivera",
                date_of_birth: "1978-04-12",
                is_deleted: false,
            },
            {
                id: "p-002",
                workspace_id: doctorWorkspaceId,
                full_name: "David Kowalski",
                date_of_birth: "1965-09-23",
                is_deleted: false,
            },
            {
                id: "p-unassigned",
                workspace_id: doctorWorkspaceId,
                full_name: "Unassigned Patient",
                date_of_birth: "1990-01-01",
                is_deleted: false,
            },
            {
                id: "p-cross-workspace",
                workspace_id: otherWorkspaceId,
                full_name: "Cross Workspace Patient",
                date_of_birth: "1985-05-05",
                is_deleted: false,
            },
        ],
        care_team_assignments: [
            {
                id: "cta-001",
                patient_id: "p-001",
                doctor_profile_id: doctorProfileId,
                revoked_at: null,
            },
            {
                id: "cta-002",
                patient_id: "p-002",
                doctor_profile_id: doctorProfileId,
                revoked_at: null,
            },
        ],
        adherence_records: [
            { patient_id: "p-001", adherence_rate: 0.92, window_days: 30 },
            { patient_id: "p-002", adherence_rate: 0.88, window_days: 30 },
        ],
        escalations: [
            {
                id: "esc-001",
                patient_id: "p-001",
                severity: "high",
                status: "open",
                reasoning: "Missed dose pattern detected",
                created_at: "2026-10-13T10:00:00.000Z",
                correlation_id: "corr-esc-001",
            },
        ],
        notifications: [
            { id: "notif-001", patient_id: "p-001", status: "delivered", channel: "sms" },
            { id: "notif-002", patient_id: "p-002", status: "delivered", channel: "email" },
            { id: "notif-003", patient_id: "p-001", status: "queued", channel: "push" },
        ],
        prescriptions: [
            {
                id: "rx-001",
                patient_id: "p-001",
                name: "Lisinopril",
                dosage: "20mg",
                frequency: "daily",
                status: "pending_review",
                patients: { id: "p-001", workspace_id: doctorWorkspaceId },
            },
        ],
        prescription_revisions: [],
        pipeline_runs: [],
        pipeline_stages: [],
        pipeline_stage_logs: [],
        jobs: [],
        audit_events: [],
    };
}

vi.mock("../lib/supabase.js", () => {
    const mockFrom = (table: string) => {
        let currentFilter = [...(mockStore[table] || [])];

        const query: any = {
            select: vi.fn().mockImplementation(() => query),
            insert: vi.fn().mockImplementation((rows: any) => {
                const list = Array.isArray(rows) ? rows : [rows];
                const inserted: any[] = [];
                for (const row of list) {
                    const rowWithId = { id: row.id || `gen-${Math.random().toString(36).substring(2, 9)}`, ...row };
                    if (!mockStore[table]) mockStore[table] = [];
                    mockStore[table].push(rowWithId);
                    inserted.push(rowWithId);
                }
                return {
                    select: () => ({
                        single: async () => ({ data: inserted[0], error: null }),
                    }),
                    single: async () => ({ data: inserted[0], error: null }),
                    then: (resolve: any) => resolve({ data: inserted, error: null }),
                };
            }),
            update: vi.fn().mockImplementation((updates: any) => {
                return {
                    eq: vi.fn().mockImplementation((field: string, val: any) => {
                        const items = mockStore[table] || [];
                        let matched: any = null;
                        for (const item of items) {
                            if (item[field] === val) {
                                Object.assign(item, updates);
                                matched = item;
                            }
                        }
                        return {
                            select: () => ({
                                single: async () => ({ data: matched, error: null }),
                            }),
                            single: async () => ({ data: matched, error: null }),
                            then: (resolve: any) => resolve({ data: matched, error: null }),
                        };
                    }),
                };
            }),
            eq: vi.fn().mockImplementation((field: string, val: any) => {
                currentFilter = currentFilter.filter((r) => r[field] === val);
                return query;
            }),
            in: vi.fn().mockImplementation((field: string, vals: any[]) => {
                currentFilter = currentFilter.filter((r) => vals.includes(r[field]));
                return query;
            }),
            is: vi.fn().mockImplementation((field: string, val: any) => {
                currentFilter = currentFilter.filter((r) => r[field] === val);
                return query;
            }),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation((n: number) => {
                currentFilter = currentFilter.slice(0, n);
                return query;
            }),
            single: vi.fn().mockImplementation(async () => {
                const item = currentFilter[0];
                return {
                    data: item || null,
                    error: item ? null : { message: `${table} record not found` },
                };
            }),
            maybeSingle: vi.fn().mockImplementation(async () => {
                const item = currentFilter[0];
                return { data: item || null, error: null };
            }),
            then: (resolve: any) => resolve({ data: currentFilter, error: null }),
        };

        return query;
    };

    return {
        getAdminClient: vi.fn(() => ({
            from: mockFrom,
        })),
        getUserClient: vi.fn(),
    };
});

describe("Doctor Portal Backend Workflows (Tasks 2.1 - 2.8)", () => {
    let app: Hono;

    beforeAll(() => {
        process.env["DEMO_MODE"] = "true";
        app = new Hono();
        app.use("*", correlationMiddleware);
        app.route("/doctor", doctorRouter);
        app.route("/prescriptions", prescriptionsRouter);
        app.onError(handleApiError);
    });

    beforeEach(() => {
        resetMockStore();
    });

    // ─── 1. Doctor Dashboard Aggregates (Task 2.1) ────────────────────────────
    describe("GET /doctor/dashboard", () => {
        it("returns assignment-scoped metrics and activity for authorized doctor", async () => {
            const res = await app.request("/doctor/dashboard", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(200);
            const data = (await res.json()) as any;

            expect(data.patientCount).toEqual({ value: 2, availability: "available" });
            expect(data.averageAdherence.availability).toBe("available");
            expect(data.averageAdherence.value).toBe(90); // (92 + 88) / 2
            expect(data.openEscalations).toEqual({ value: 1, availability: "available" });
            expect(data.remindersDelivered).toEqual({ value: 2, availability: "available" });
            expect(data.recentActivity).toBeInstanceOf(Array);
            expect(data.recentActivity.length).toBeGreaterThan(0);
            expect(data.freshnessTimestamp).toBeDefined();
            expect(data.correlationId).toBeDefined();
        });

        it("returns safe zero metrics when doctor has zero assigned patients", async () => {
            // Revoke all assignments
            mockStore.care_team_assignments = [];

            const res = await app.request("/doctor/dashboard", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(200);
            const data = (await res.json()) as any;
            expect(data.patientCount.value).toBe(0);
            expect(data.averageAdherence.value).toBe(0);
            expect(data.openEscalations.value).toBe(0);
            expect(data.remindersDelivered.value).toBe(0);
            expect(data.recentActivity).toEqual([]);
        });
    });

    // ─── 2. Prescription Approval & Pipeline Linkage (Tasks 2.2 - 2.5) ────────
    describe("POST /prescriptions/:id/approve", () => {
        it("approves prescription, persists AI snapshot, creates pipeline run and stages, and enqueues work", async () => {
            const idempotencyKey = "idem-test-key-001";
            const suggestion = {
                name: "Losartan",
                genericName: "losartan potassium",
                strength: "50mg",
                frequency: "daily",
                reasoning: "Patient developed ACE cough on Lisinopril",
                citations: [{ id: "c-1", title: "NEJM Guideline", publisher: "NEJM" }],
            };

            const res = await app.request("/prescriptions/rx-001/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify({
                    idempotencyKey,
                    suggestion,
                    editedValues: { dosage: "50mg", frequency: "daily" },
                    reason: "Switched from ACEi due to cough",
                }),
            });

            expect(res.status).toBe(200);
            const data = (await res.json()) as any;
            expect(data.success).toBe(true);
            expect(data.prescription.status).toBe("approved");
            expect(data.prescription.idempotency_key).toBe(idempotencyKey);
            expect(data.prescription.ai_suggestion_snapshot).toBeDefined();
            expect(data.pipelineRunId).toBeDefined();

            // Verify revision recorded
            expect(mockStore.prescription_revisions.length).toBe(1);
            expect(mockStore.prescription_revisions[0].prescription_id).toBe("rx-001");

            // Verify pipeline run and 5 stages created
            expect(mockStore.pipeline_runs.length).toBe(1);
            expect(mockStore.pipeline_runs[0].patient_id).toBe("p-001");
            expect(mockStore.pipeline_stages.length).toBe(5);

            // Verify initial stage keys
            const stageKeys = mockStore.pipeline_stages.map((s: any) => s.stage_key);
            expect(stageKeys).toContain("reminder_agent");
            expect(stageKeys).toContain("dose_logging_agent");
            expect(stageKeys).toContain("pattern_detection_agent");
            expect(stageKeys).toContain("escalation_agent");
            expect(stageKeys).toContain("care_team_interaction_agent");

            // Verify downstream job enqueued with pipeline_run_id and pipeline_stage_id
            expect(mockStore.jobs.length).toBe(1);
            expect(mockStore.jobs[0].type).toBe("generate_dose_schedule");
            expect(mockStore.jobs[0].pipeline_run_id).toBe(data.pipelineRunId);
            expect(mockStore.jobs[0].pipeline_stage_id).toBeDefined();
        });

        it("idempotency: retrying approval with same key returns original canonical response without duplicates", async () => {
            const idempotencyKey = "idem-repeat-002";
            const payload = {
                idempotencyKey,
                suggestion: { name: "Metformin" },
            };

            // First call
            const firstRes = await app.request("/prescriptions/rx-001/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify(payload),
            });
            expect(firstRes.status).toBe(200);
            const firstData = (await firstRes.json()) as any;
            expect(firstData.success).toBe(true);
            const initialJobCount = mockStore.jobs.length;
            const initialRunCount = mockStore.pipeline_runs.length;

            // Second call with same idempotency key
            const secondRes = await app.request("/prescriptions/rx-001/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify(payload),
            });
            expect(secondRes.status).toBe(200);
            const secondData = (await secondRes.json()) as any;

            expect(secondData.success).toBe(true);
            expect(secondData.isDuplicate).toBe(true);
            // No new jobs or pipeline runs created
            expect(mockStore.jobs.length).toBe(initialJobCount);
            expect(mockStore.pipeline_runs.length).toBe(initialRunCount);
        });

        it("rejects approval when doctor is not assigned to the patient", async () => {
            // Patient p-unassigned has no assignment to doctor
            mockStore.prescriptions.push({
                id: "rx-unassigned",
                patient_id: "p-unassigned",
                name: "Atorvastatin",
                status: "pending_review",
                patients: { id: "p-unassigned", workspace_id: doctorWorkspaceId },
            });

            const res = await app.request("/prescriptions/rx-unassigned/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify({ suggestion: { name: "Atorvastatin" } }),
            });

            expect(res.status).toBe(403);
            const data = (await res.json()) as any;
            expect(data.error).toBe("forbidden");
        });
    });

    // ─── 3. Patient Pipeline Status & Logs (Task 2.6) ─────────────────────────
    describe("GET /doctor/patients/:patientId/pipeline", () => {
        beforeEach(() => {
            // Populate a pipeline run and stages for p-001
            mockStore.pipeline_runs.push({
                id: "run-001",
                patient_id: "p-001",
                workspace_id: doctorWorkspaceId,
                trigger_type: "prescription_approval",
                status: "running",
                correlation_id: "corr-run-001",
                created_at: "2026-10-13T12:00:00.000Z",
            });

            mockStore.pipeline_stages.push(
                {
                    id: "stage-1",
                    pipeline_run_id: "run-001",
                    stage_key: "reminder_agent",
                    status: "complete",
                    agent_name: "Reminder Agent",
                    attempt: 1,
                    updated_at: "2026-10-13T12:01:00.000Z",
                },
                {
                    id: "stage-2",
                    pipeline_run_id: "run-001",
                    stage_key: "dose_logging_agent",
                    status: "running",
                    agent_name: "Dose Logging Agent",
                    attempt: 1,
                    updated_at: "2026-10-13T12:02:00.000Z",
                },
                {
                    id: "stage-3",
                    pipeline_run_id: "run-001",
                    stage_key: "pattern_detection_agent",
                    status: "idle",
                    agent_name: "Pattern Detection Agent",
                    attempt: 0,
                    updated_at: "2026-10-13T12:00:00.000Z",
                },
                {
                    id: "stage-4",
                    pipeline_run_id: "run-001",
                    stage_key: "escalation_agent",
                    status: "idle",
                    agent_name: "Escalation Agent",
                    attempt: 0,
                    updated_at: "2026-10-13T12:00:00.000Z",
                },
                {
                    id: "stage-5",
                    pipeline_run_id: "run-001",
                    stage_key: "care_team_interaction_agent",
                    status: "idle",
                    agent_name: "Care Team Interaction Agent",
                    attempt: 0,
                    updated_at: "2026-10-13T12:00:00.000Z",
                },
            );

            mockStore.pipeline_stage_logs.push({
                id: "log-1",
                pipeline_stage_id: "stage-1",
                level: "info",
                message: "Generated 30-day schedule",
                created_at: "2026-10-13T12:01:00.000Z",
            });
        });

        it("returns durable pipeline run and 5 stages with bounded logs for assigned patient", async () => {
            const res = await app.request("/doctor/patients/p-001/pipeline", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(200);
            const data = (await res.json()) as any;

            expect(data.run).toBeDefined();
            expect(data.run.id).toBe("run-001");
            expect(data.stages.length).toBe(5);

            // Canonical ordering check
            const keys = data.stages.map((s: any) => s.stageKey);
            expect(keys).toEqual([
                "reminder_agent",
                "dose_logging_agent",
                "pattern_detection_agent",
                "escalation_agent",
                "care_team_interaction_agent",
            ]);

            // Stage logs check
            expect(data.stages[0].logs.length).toBe(1);
            expect(data.stages[0].logs[0].message).toBe("Generated 30-day schedule");
        });

        it("rejects unassigned patient access with 404 without disclosing patient existence", async () => {
            const res = await app.request("/doctor/patients/p-unassigned/pipeline", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(404);
            const data = (await res.json()) as any;
            expect(data.error).toBe("not_found");
        });

        it("rejects cross-workspace patient access with 404 without disclosing patient existence", async () => {
            const res = await app.request("/doctor/patients/p-cross-workspace/pipeline", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(404);
            const data = (await res.json()) as any;
            expect(data.error).toBe("not_found");
        });
    });

    // ─── 4. Doctor Settings & Preferences (Task 2.7) ──────────────────────────
    describe("GET & PUT /doctor/settings", () => {
        it("returns current doctor profile and notification preferences", async () => {
            const res = await app.request("/doctor/settings", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });

            expect(res.status).toBe(200);
            const data = (await res.json()) as any;
            expect(data.profile.id).toBe(doctorProfileId);
            expect(data.profile.role).toBe("doctor");
            expect(data.preferences.specialty).toBe("Cardiology");
            expect(data.preferences.notification.channels).toEqual(["email", "push"]);
            expect(data.preferences.notification.quietHoursStart).toBe("22:00");
        });

        it("saves valid profile and notification preferences round-trip", async () => {
            const updatePayload = {
                displayName: "Dr. Sarah Chen, MD",
                specialty: "Interventional Cardiology",
                phone: "+1-555-9988",
                notification: {
                    channels: ["email", "sms"],
                    quietHoursStart: "23:00",
                    quietHoursEnd: "06:30",
                },
            };

            const putRes = await app.request("/doctor/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify(updatePayload),
            });

            expect(putRes.status).toBe(200);
            const putData = (await putRes.json()) as any;
            expect(putData.preferences.displayName).toBe("Dr. Sarah Chen, MD");
            expect(putData.preferences.specialty).toBe("Interventional Cardiology");
            expect(putData.preferences.notification.channels).toEqual(["email", "sms"]);
            expect(putData.preferences.notification.quietHoursStart).toBe("23:00");
            expect(putData.preferences.notification.quietHoursEnd).toBe("06:30");

            // Verify GET returns updated values
            const getRes = await app.request("/doctor/settings", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });
            const getData = (await getRes.json()) as any;
            expect(getData.preferences.displayName).toBe("Dr. Sarah Chen, MD");
            expect(getData.preferences.notification.channels).toEqual(["email", "sms"]);
        });

        it("rejects invalid quiet hours format without changing prior values", async () => {
            const invalidPayload = {
                notification: {
                    channels: ["email"],
                    quietHoursStart: "25:99", // Invalid time
                    quietHoursEnd: "07:00",
                },
            };

            const res = await app.request("/doctor/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify(invalidPayload),
            });

            expect(res.status).toBe(400);
            const data = (await res.json()) as any;
            expect(data.error).toBe("bad_request");

            // Verify prior settings preserved
            const getRes = await app.request("/doctor/settings", {
                method: "GET",
                headers: {
                    Authorization: "Bearer demo-token-doctor",
                },
            });
            const getData = (await getRes.json()) as any;
            expect(getData.preferences.specialty).toBe("Cardiology");
        });

        it("rejects unsupported notification channels", async () => {
            const invalidPayload = {
                notification: {
                    channels: ["carrier_pigeon" as any],
                },
            };

            const res = await app.request("/doctor/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor",
                },
                body: JSON.stringify(invalidPayload),
            });

            expect(res.status).toBe(400);
        });
    });
});
