import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { correlationMiddleware } from "../middleware/correlation.js";
import { patientsRouter } from "./patients/index.js";
import { dosesRouter } from "./doses/index.js";
import { handleApiError } from "../lib/errors.js";

const workspaceId = "a0000000-0000-0000-0000-000000000001";
const patientProfileId = "b0000000-0000-0000-0000-000000000001";
const doctorProfileId = "d0000000-0000-0000-0000-000000000001";
const otherPatientProfileId = "b0000000-0000-0000-0000-000000000099";

let mockStore: {
    patients: any[];
    dose_schedules: any[];
    dose_logs: any[];
    consent_records: any[];
    care_team_assignments: any[];
    audit_events: any[];
} = {
    patients: [],
    dose_schedules: [],
    dose_logs: [],
    consent_records: [],
    care_team_assignments: [],
    audit_events: [],
};

function resetStore() {
    mockStore = {
        patients: [
            {
                id: "p-001",
                workspace_id: workspaceId,
                profile_id: patientProfileId,
                status: "active",
                full_name: "Marcus Rivera",
                is_deleted: false,
            },
            {
                id: "p-002",
                workspace_id: workspaceId,
                profile_id: otherPatientProfileId,
                status: "active",
                full_name: "Amara Osei",
                is_deleted: false,
            },
        ],
        dose_schedules: [
            {
                id: "e0a6d51c-4b36-4191-88f5-9304e7cf4a91",
                patient_id: "p-001",
                prescription_id: "rx-001",
                scheduled_at: `${new Date().toISOString().split("T")[0]}T08:00:00.000Z`,
                window_minutes: 60,
                prescriptions: {
                    id: "rx-001",
                    medications: {
                        name: "Metformin",
                        dosage: "1000mg",
                    },
                },
            },
            {
                id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                patient_id: "p-001",
                prescription_id: "rx-002",
                scheduled_at: `${new Date(Date.now() + 86400000).toISOString().split("T")[0]}T19:00:00.000Z`,
                window_minutes: 60,
                prescriptions: {
                    id: "rx-002",
                    medications: {
                        name: "Amlodipine",
                        dosage: "5mg",
                    },
                },
            },
        ],
        dose_logs: [
            {
                id: "log-1",
                schedule_id: "e0a6d51c-4b36-4191-88f5-9304e7cf4a91",
                patient_id: "p-001",
                status: "taken",
                method: "oral",
                reason: null,
                idempotency_key: "idem-key-1",
                logged_at: `${new Date().toISOString().split("T")[0]}T08:05:00.000Z`,
            },
        ],
        consent_records: [
            {
                patient_id: "p-001",
                share_with_care_team: true,
                allow_reminders: true,
                allow_ai_analysis: true,
            },
        ],
        care_team_assignments: [
            {
                patient_id: "p-001",
                doctor_profile_id: doctorProfileId,
                revoked_at: null,
            },
        ],
        audit_events: [],
    };
}

vi.mock("../lib/supabase.js", () => {
    const mockFrom = (table: string) => {
        let filters: Array<(r: any) => boolean> = [];
        let limitVal: number | null = null;
        let orderCol: string | null = null;

        const chain: any = {
            select: vi.fn().mockImplementation(() => chain),
            eq: vi.fn().mockImplementation((col: string, val: any) => {
                filters.push((r: any) => r[col] === val);
                return chain;
            }),
            gte: vi.fn().mockImplementation((col: string, val: any) => {
                filters.push((r: any) => r[col] >= val);
                return chain;
            }),
            lte: vi.fn().mockImplementation((col: string, val: any) => {
                filters.push((r: any) => r[col] <= val);
                return chain;
            }),
            is: vi.fn().mockImplementation((col: string, val: any) => {
                filters.push((r: any) => r[col] === val);
                return chain;
            }),
            or: vi.fn().mockImplementation(() => chain),
            order: vi.fn().mockImplementation((col: string) => {
                orderCol = col;
                return chain;
            }),
            limit: vi.fn().mockImplementation((n: number) => {
                limitVal = n;
                return chain;
            }),
            single: vi.fn().mockImplementation(async () => {
                const store = (mockStore as any)[table] || [];
                const matched = store.filter((r: any) => filters.every((f) => f(r)));
                if (matched.length === 0) return { data: null, error: { message: "Not found" } };
                return { data: matched[0], error: null };
            }),
            maybeSingle: vi.fn().mockImplementation(async () => {
                const store = (mockStore as any)[table] || [];
                const matched = store.filter((r: any) => filters.every((f) => f(r)));
                return { data: matched.length > 0 ? matched[0] : null, error: null };
            }),
            insert: vi.fn().mockImplementation((rows: any) => {
                const list = Array.isArray(rows) ? rows : [rows];
                const store = (mockStore as any)[table] || [];
                for (const row of list) {
                    const created = { id: row.id || `auto-${Date.now()}-${Math.random()}`, ...row };
                    store.push(created);
                }
                return {
                    ...chain,
                    select: () => ({
                        single: async () => ({ data: list[0], error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: list, error: null }),
                };
            }),
            upsert: vi.fn().mockImplementation((row: any) => {
                const store = (mockStore as any)[table] || [];
                const existingIndex = store.findIndex((r: any) => r.patient_id === row.patient_id);
                if (existingIndex >= 0) {
                    store[existingIndex] = { ...store[existingIndex], ...row };
                } else {
                    store.push(row);
                }
                return {
                    ...chain,
                    select: () => ({
                        single: async () => ({ data: row, error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: row, error: null }),
                };
            }),
            then: (resolve: any) => {
                const store = (mockStore as any)[table] || [];
                let matched = store.filter((r: any) => filters.every((f) => f(r)));
                if (limitVal) matched = matched.slice(0, limitVal);
                return resolve({ data: matched, error: null });
            },
        };

        return chain;
    };

    const createClient = () => ({
        from: mockFrom,
        rpc: vi.fn().mockResolvedValue({ data: "patient-auth-001", error: null }),
        auth: {
            admin: {
                inviteUserByEmail: vi.fn().mockResolvedValue({
                    data: { user: { id: "patient-auth-001" } },
                    error: null,
                }),
                deleteUser: vi.fn().mockResolvedValue({ error: null }),
            },
        },
    });

    return {
        getAdminClient: vi.fn(createClient),
        getAuthAdminClient: vi.fn(createClient),
        getUserClient: vi.fn(),
    };
});

describe("Patient Portal Workflows (Task 2.1 - 2.6)", () => {
    let app: Hono;

    beforeAll(() => {
        process.env["DEMO_MODE"] = "true";
        app = new Hono();
        app.use("*", correlationMiddleware);
        app.route("/patients", patientsRouter);
        app.route("/doses", dosesRouter);
        app.onError(handleApiError);
    });

    beforeEach(() => {
        resetStore();
    });

    describe("Patient Isolation & Boundary Guard (Task 2.1)", () => {
        it("allows patient to access their own records (p-001)", async () => {
            const res = await app.request("/patients/p-001/adherence", {
                headers: { Authorization: "Bearer demo-token-patient" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.patientId).toBe("p-001");
            expect(body.score).toBeGreaterThanOrEqual(0);
        });

        it("denies patient from accessing another patient record (p-002)", async () => {
            const res = await app.request("/patients/p-002/adherence", {
                headers: { Authorization: "Bearer demo-token-patient" },
            });
            expect(res.status).toBe(403);
            const body = (await res.json()) as any;
            expect(body.error).toBe("forbidden");
        });
    });

    describe("Daily Dose Schedules (Task 2.2)", () => {
        it("returns authoritative scheduled doses with status taken / scheduled", async () => {
            const today = new Date().toISOString().split("T")[0];
            const res = await app.request(`/patients/p-001/dose-schedules?date=${today}`, {
                headers: { Authorization: "Bearer demo-token-patient" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.schedules).toBeInstanceOf(Array);
            expect(body.schedules.length).toBeGreaterThanOrEqual(1);
            expect(body.schedules[0].medicationName).toBe("Metformin");
            expect(body.schedules[0].status).toBe("taken");
        });
    });

    describe("Server-Calculated Adherence & Streaks (Task 2.3)", () => {
        it("returns calculated percentages, counts, and streak days", async () => {
            const res = await app.request("/patients/p-001/adherence", {
                headers: { Authorization: "Bearer demo-token-patient" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.takenCount).toBe(1);
            expect(body.score).toBe(100);
            expect(body.currentStreakDays).toBe(1);
            expect(body.trend).toBe("up");
        });
    });

    describe("Trust & Transparency Endpoint (Task 2.4)", () => {
        it("returns verified trust signals, consent record, and assurance score", async () => {
            const res = await app.request("/patients/p-001/transparency", {
                headers: { Authorization: "Bearer demo-token-patient" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.assuranceScore).toBe(98);
            expect(body.trustSignals).toBeInstanceOf(Array);
            expect(body.consent).toBeDefined();
            expect(body.consent.share_with_care_team).toBe(true);
        });
    });

    describe("Idempotent Dose Logging with UUID (Task 2.5)", () => {
        it("records a dose event on first submission and updates audit log", async () => {
            const scheduleId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
            const res = await app.request("/doses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient",
                },
                body: JSON.stringify({
                    scheduleId,
                    patientId: "p-001",
                    status: "taken",
                    method: "oral",
                    idempotencyKey: "unique-key-patient-test-1",
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
            expect(body.duplicated).toBe(false);
            expect(body.dose.status).toBe("taken");

            // Check duplicate submission with same idempotencyKey returns 200 cached response
            const retryRes = await app.request("/doses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient",
                },
                body: JSON.stringify({
                    scheduleId,
                    patientId: "p-001",
                    status: "taken",
                    method: "oral",
                    idempotencyKey: "unique-key-patient-test-1",
                }),
            });
            expect(retryRes.status).toBe(200);
            const retryBody = (await retryRes.json()) as any;
            expect(retryBody.duplicated).toBe(true);
        });
    });
});
