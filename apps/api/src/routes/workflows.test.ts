import { describe, it, expect, vi, beforeAll } from "vitest";
import { Hono } from "hono";
import { correlationMiddleware } from "../middleware/correlation.js";
import { dosesRouter } from "./doses/index.js";
import { prescriptionsRouter } from "./prescriptions/index.js";
import { reportsRouter } from "./reports/index.js";
import { correctionsRouter } from "./corrections/index.js";
import { auditRouter } from "./audit/index.js";
import { handleApiError } from "../lib/errors.js";

vi.mock("../config.js", () => ({
    getConfig: vi.fn(() => ({
        demoMode: true,
        signedUrlExpirySeconds: 300,
        reportsBucketName: "medical-reports",
    })),
    initConfig: vi.fn(),
}));

// Mock Supabase admin
vi.mock("../lib/supabase.js", () => {
    const mockStore: Record<string, any[]> = {
        dose_logs: [],
        prescriptions: [
            {
                id: "rx-test-1",
                patient_id: "p-001",
                medication_id: "med-1",
                status: "pending_review",
            },
        ],
        care_team_assignments: [
            {
                patient_id: "p-001",
                doctor_profile_id: "d0000000-0000-0000-0000-000000000001",
                revoked_at: null,
            },
        ],
        patient_reports: [
            {
                id: "rep-shared",
                patient_id: "p-001",
                uploader_profile_id: "b0000000-0000-0000-0000-000000000001",
                storage_path: "p-001/blood-work.pdf",
                mime_type: "application/pdf",
                size_bytes: 1024,
                label: "Blood Work",
                review_status: "unreviewed",
                shared_with_care_team: true,
            },
            {
                id: "rep-private",
                patient_id: "p-001",
                uploader_profile_id: "b0000000-0000-0000-0000-000000000001",
                storage_path: "p-001/private-note.pdf",
                mime_type: "application/pdf",
                size_bytes: 1024,
                label: "Private Note",
                review_status: "unreviewed",
                shared_with_care_team: false,
            },
        ],
        patients: [
            {
                id: "p-001",
                workspace_id: "a0000000-0000-0000-0000-000000000001",
                profile_id: "b0000000-0000-0000-0000-000000000001",
            },
        ],
        audit_events: [
            {
                id: "aud-1",
                workspace_id: "a0000000-0000-0000-0000-000000000001",
                actor_profile_id: "d0000000-0000-0000-0000-000000000001",
                action: "approve_prescription",
                target_type: "prescription",
                target_id: "rx-test-1",
                correlation_id: "c-1",
                outcome: "success",
                occurred_at: new Date().toISOString(),
            },
        ],
    };

    const mockFrom = (table: string) => {
        let currentData = mockStore[table] || [];
        const query: any = {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockImplementation((rows: any) => {
                const inserted = Array.isArray(rows) ? rows[0] : rows;
                const withId = { id: inserted.id || "gen-" + Date.now(), ...inserted };
                if (!mockStore[table]) mockStore[table] = [];
                mockStore[table].push(withId);
                return {
                    select: () => ({
                        single: async () => ({ data: withId, error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: withId, error: null }),
                };
            }),
            update: vi.fn().mockImplementation((updates: any) => {
                return {
                    eq: vi.fn().mockImplementation((field: string, val: string) => {
                        const item = currentData.find((x) => x[field] === val);
                        if (item) Object.assign(item, updates);
                        return {
                            select: () => ({
                                single: async () => ({ data: item, error: null }),
                            }),
                            then: (resolve: any) => resolve({ data: item, error: null }),
                        };
                    }),
                };
            }),
            eq: vi.fn().mockImplementation((field: string, val: any) => {
                currentData = currentData.filter((x) => x[field] === val);
                return query;
            }),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(async () => ({
                data: currentData[0] || null,
                error: currentData[0] ? null : { message: "Not found" },
            })),
            maybeSingle: vi.fn().mockImplementation(async () => ({
                data: currentData[0] || null,
                error: null,
            })),
            then: (resolve: any) => resolve({ data: currentData, error: null }),
        };
        return query;
    };

    return {
        getAdminClient: vi.fn(() => ({
            from: mockFrom,
            storage: {
                from: vi.fn(() => ({
                    createSignedUploadUrl: vi.fn().mockResolvedValue({
                        data: { signedUrl: "https://storage.supabase.co/upload/test" },
                        error: null,
                    }),
                    createSignedUrl: vi.fn().mockResolvedValue({
                        data: { signedUrl: "https://storage.supabase.co/view/test" },
                        error: null,
                    }),
                })),
            },
        })),
        getUserClient: vi.fn(),
    };
});

describe("Clinical Mutations & Workflows (Task 5.1 - 5.5)", () => {
    let app: Hono;

    beforeAll(() => {
        process.env["DEMO_MODE"] = "true";
        app = new Hono();
        app.use("*", correlationMiddleware);
        app.route("/doses", dosesRouter);
        app.route("/prescriptions", prescriptionsRouter);
        app.route("/reports", reportsRouter);
        app.route("/corrections", correctionsRouter);
        app.route("/audit", auditRouter);
        app.onError(handleApiError);
    });

    // ─── Task 4.1: Idempotent Dose Logging ────────────────────────────────────
    describe("Dose Logging Idempotency", () => {
        it("records dose event on first submission", async () => {
            const res = await app.request("/doses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    scheduleId: "11111111-1111-1111-1111-111111111111",
                    patientId: "p-001",
                    status: "taken",
                    method: "oral",
                    idempotencyKey: "dose-key-001",
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as any;
            expect(body.duplicated).toBe(false);
            expect(body.dose.status).toBe("taken");
        });

        it("resolves duplicate submission to existing dose without duplicate entry", async () => {
            const res = await app.request("/doses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    scheduleId: "11111111-1111-1111-1111-111111111111",
                    patientId: "p-001",
                    status: "taken",
                    idempotencyKey: "dose-key-001", // duplicate key
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.duplicated).toBe(true);
            expect(body.message).toContain("already recorded");
        });
    });

    // ─── Task 4.2: Prescription Approval ──────────────────────────────────────
    describe("Transactional Prescription Approval", () => {
        it("approves prescription and preserves revision history when called by assigned doctor", async () => {
            const res = await app.request("/prescriptions/rx-test-1/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor-jwt",
                },
                body: JSON.stringify({
                    changes: { dosage: "1000mg", instructions: "Take with food twice daily" },
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.prescription.status).toBe("approved");
            expect(body.revision).toBeDefined();
        });

        it("rejects prescription approval by non-doctor role", async () => {
            const res = await app.request("/prescriptions/rx-test-1/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
            });
            expect(res.status).toBe(403);
        });
    });

    // ─── Task 5.1 & 5.5: Report Upload & Authorization ────────────────────────
    describe("Medical Report Workflow", () => {
        it("rejects invalid file types for report upload", async () => {
            const res = await app.request("/reports/upload-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    patientId: "p-001",
                    fileName: "malware.exe",
                    mimeType: "application/x-msdownload",
                    sizeBytes: 5000,
                }),
            });
            expect(res.status).toBe(400);
        });

        it("generates upload URL for valid PDF report", async () => {
            const res = await app.request("/reports/upload-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    patientId: "p-001",
                    fileName: "blood-panel.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 1024 * 100,
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.uploadUrl).toBeDefined();
            expect(body.storagePath).toContain("p-001/");
        });

        it("allows viewing shared report by care team member", async () => {
            const res = await app.request("/reports/rep-shared/view-url", {
                headers: { Authorization: "Bearer demo-token-careteam-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.signedUrl).toBeDefined();
        });

        it("denies viewing unshared report by care team member", async () => {
            const res = await app.request("/reports/rep-private/view-url", {
                headers: { Authorization: "Bearer demo-token-careteam-jwt" },
            });
            expect(res.status).toBe(403);
        });

        it("allows assigned doctor to mark report reviewed", async () => {
            const res = await app.request("/reports/rep-shared/review", {
                method: "PATCH",
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.report.review_status).toBe("reviewed");
        });
    });

    // ─── Task 5.3: Correction Requests Immutability ───────────────────────────
    describe("Correction Requests", () => {
        it("records open correction request without mutating original events", async () => {
            const res = await app.request("/corrections", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    patientId: "p-001",
                    targetType: "dose_log",
                    targetId: "dose-123",
                    description: "Dose was taken on time but recorded late due to timezone issue",
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as any;
            expect(body.correction.status).toBe("open");
            expect(body.correction.target_type).toBe("dose_log");
        });
    });

    // ─── Task 5.4: Audit Completeness & Scopes ────────────────────────────────
    describe("Audit Queries", () => {
        it("allows administrator to query audit trail", async () => {
            const res = await app.request("/audit", {
                headers: { Authorization: "Bearer demo-token-admin-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.events).toBeInstanceOf(Array);
        });

        it("denies doctor and patient from querying audit logs", async () => {
            const docRes = await app.request("/audit", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(docRes.status).toBe(403);

            const patRes = await app.request("/audit", {
                headers: { Authorization: "Bearer demo-token-patient-jwt" },
            });
            expect(patRes.status).toBe(403);
        });
    });
});
