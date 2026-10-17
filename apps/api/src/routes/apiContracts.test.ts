import { describe, it, expect, vi, beforeAll } from "vitest";
import { Hono } from "hono";
import { correlationMiddleware } from "../middleware/correlation.js";
import { authRouter } from "./auth/index.js";
import { patientsRouter } from "./patients/index.js";
import { careTeamRouter } from "./careTeam/index.js";
import { healthRouter } from "./health/index.js";
import { handleApiError } from "../lib/errors.js";

// Mock Supabase admin client for tests
vi.mock("../lib/supabase.js", () => {
    const mockFrom = (table: string) => {
        const query: any = {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(async () => {
                if (table === "patients") {
                    return {
                        data: {
                            id: "p-001",
                            workspace_id: "a0000000-0000-0000-0000-000000000001",
                            profile_id: "b0000000-0000-0000-0000-000000000001",
                            status: "active",
                            full_name: "Marcus Rivera",
                            date_of_birth: "1978-04-12",
                            contact_email: "m.rivera@email.com",
                            is_deleted: false,
                        },
                        error: null,
                    };
                }
                if (table === "consent_records") {
                    return {
                        data: {
                            patient_id: "p-001",
                            share_with_care_team: true,
                            allow_reminders: true,
                            allow_ai_analysis: true,
                        },
                        error: null,
                    };
                }
                return { data: {}, error: null };
            }),
            maybeSingle: vi.fn().mockImplementation(async () => {
                if (table === "consent_records") {
                    return {
                        data: {
                            patient_id: "p-001",
                            share_with_care_team: true,
                            allow_reminders: true,
                            allow_ai_analysis: true,
                        },
                        error: null,
                    };
                }
                return { data: null, error: null };
            }),
        };

        // For insert(...).select().single()
        query.select.mockImplementation(() => query);
        query.insert.mockImplementation((rows: any) => {
            const row = Array.isArray(rows) ? rows[0] : rows;
            return {
                ...query,
                select: () => ({
                    single: async () => ({
                        data: { id: "p-999999", ...row, status: "pending" },
                        error: null,
                    }),
                }),
                then: (resolve: any) => resolve({ data: row, error: null }),
            };
        });
        query.upsert.mockImplementation((data: any) => {
            return {
                ...query,
                select: () => ({
                    single: async () => ({
                        data,
                        error: null,
                    }),
                }),
                then: (resolve: any) => resolve({ data, error: null }),
            };
        });

        // Promise resolve for list queries
        query.then = (resolve: any) => {
            if (table === "patients") {
                return resolve({
                    data: [
                        { id: "p-001", full_name: "Marcus Rivera", status: "active" },
                        { id: "p-002", full_name: "Amara Osei", status: "active" },
                    ],
                    error: null,
                });
            }
            if (table === "care_team_assignments") {
                return resolve({
                    data: [
                        {
                            patient_id: "p-001",
                            doctor_profile_id: "d0000000-0000-0000-0000-000000000001",
                            revoked_at: null,
                        },
                    ],
                    error: null,
                });
            }
            if (table === "care_grants") {
                return resolve({
                    data: [
                        {
                            patient_id: "p-001",
                            grantee_profile_id: "c0000000-0000-0000-0000-000000000001",
                            scope: "all",
                            revoked_at: null,
                        },
                    ],
                    error: null,
                });
            }
            if (table === "visits") {
                return resolve({
                    data: [{ id: "v-001", patient_id: "p-001", visit_date: "2026-08-28" }],
                    error: null,
                });
            }
            if (table === "medications") {
                return resolve({
                    data: [{ id: "m-001", patient_id: "p-001", name: "Metformin" }],
                    error: null,
                });
            }
            if (table === "dose_logs") {
                return resolve({
                    data: [{ id: "d-001", patient_id: "p-001", status: "taken" }],
                    error: null,
                });
            }
            if (table === "profiles") {
                return resolve({
                    data: [
                        { id: "d0000000-0000-0000-0000-000000000001", full_name: "Dr. Jeya Shankar M", role: "doctor" },
                    ],
                    error: null,
                });
            }
            if (table === "notification_preferences") {
                return resolve({
                    data: [{ patient_id: "p-001", channel: "email", enabled: true }],
                    error: null,
                });
            }
            return resolve({ data: [], error: null });
        };

        return query;
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
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
                refreshSession: vi.fn(),
                resetPasswordForEmail: vi.fn().mockResolvedValue({}),
                getUser: vi.fn(),
            },
        });

    return {
        getAdminClient: vi.fn(createClient),
        getAuthAdminClient: vi.fn(createClient),
        getUserClient: vi.fn(),
    };
});

describe("Protected API Contracts (Task 3.1 - 3.4)", () => {
    let app: Hono;

    beforeAll(() => {
        process.env["DEMO_MODE"] = "true";
        app = new Hono();
        app.use("*", correlationMiddleware);
        app.route("/health", healthRouter);
        app.route("/auth", authRouter);
        app.route("/patients", patientsRouter);
        app.route("/care-team", careTeamRouter);
        app.onError(handleApiError);
    });

    describe("Health Endpoint", () => {
        it("returns 200 with service status and contract version", async () => {
            const res = await app.request("/health");
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.status).toBe("healthy");
            expect(body.service).toBe("mednova-api");
            expect(body.contractVersion).toBe("1.0");
        });
    });

    describe("Authentication & Role Gating (Task 3.1)", () => {
        it("logs in doctor through doctor portal", async () => {
            const res = await app.request("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "s.chen@mednova.clinic",
                    password: "password123",
                    portal: "doctor",
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.token).toBeDefined();
            expect(body.user.role).toBe("doctor");
        });

        it("logs in patient through patient portal", async () => {
            const res = await app.request("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "m.rivera@email.com",
                    password: "password123",
                    portal: "patient",
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.token).toBeDefined();
            expect(body.user.role).toBe("patient");
        });

        it("rejects wrong-portal login without account enumeration", async () => {
            const res = await app.request("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "patient@mednova.clinic",
                    password: "password123",
                    portal: "doctor",
                }),
            });
            expect(res.status).toBe(401);
            const body = (await res.json()) as any;
            expect(body.error).toBe("unauthorized");
            expect(body.message).toContain("Invalid login credentials for this portal");
        });

        it("protects /auth/me from unauthenticated access", async () => {
            const res = await app.request("/auth/me");
            expect(res.status).toBe(401);
            const body = (await res.json()) as any;
            expect(body.error).toBe("unauthorized");
        });

        it("returns user context on /auth/me with valid bearer token", async () => {
            const res = await app.request("/auth/me", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.user.role).toBe("doctor");
            expect(body.user.email).toBe("s.chen@mednova.clinic");
        });

        it("safe password recovery without email enumeration", async () => {
            const res = await app.request("/auth/recover-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "random-nonexistent@email.com" }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
            expect(body.message).toContain("If the account exists");
        });
    });

    describe("Patient Creation with Server Identifier (Task 3.3)", () => {
        it("allows authorized doctor to create patient and assigns server-generated ID", async () => {
            const res = await app.request("/patients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor-jwt",
                },
                body: JSON.stringify({
                    fullName: "Elena Rostova",
                    dateOfBirth: "1985-06-20",
                    contactEmail: "elena@example.com",
                    conditions: ["Hypertension"],
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
            expect(body.patient.id).toBeDefined();
            expect(body.patient.status).toBe("pending");
        });

        it("denies non-doctor role from creating patients", async () => {
            const res = await app.request("/patients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    fullName: "Unauthorized Patient",
                    dateOfBirth: "1990-01-01",
                    contactEmail: "unauth@example.com",
                }),
            });
            expect(res.status).toBe(403);
            const body = (await res.json()) as any;
            expect(body.error).toBe("forbidden");
        });

        it("validates request body and rejects malformed inputs", async () => {
            const res = await app.request("/patients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-doctor-jwt",
                },
                body: JSON.stringify({
                    fullName: "E", // too short
                    dateOfBirth: "invalid-date",
                    contactEmail: "not-an-email",
                }),
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as any;
            expect(body.error).toBe("validation_error");
        });
    });

    describe("Protected Clinical Reads (Task 3.4)", () => {
        it("lists patients for authenticated doctor", async () => {
            const res = await app.request("/patients", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.patients).toBeInstanceOf(Array);
        });

        it("reads patient details for assigned doctor", async () => {
            const res = await app.request("/patients/p-001", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.patient.id).toBe("p-001");
            expect(body.patient.full_name).toBe("Marcus Rivera");
        });

        it("reads patient visits", async () => {
            const res = await app.request("/patients/p-001/visits", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.visits).toBeInstanceOf(Array);
        });

        it("reads patient medications", async () => {
            const res = await app.request("/patients/p-001/medications", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.medications).toBeInstanceOf(Array);
        });

        it("reads patient adherence", async () => {
            const res = await app.request("/patients/p-001/adherence", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.logs).toBeInstanceOf(Array);
        });

        it("reads and updates consent records", async () => {
            const getRes = await app.request("/patients/p-001/consent", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(getRes.status).toBe(200);

            const putRes = await app.request("/patients/p-001/consent", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer demo-token-patient-jwt",
                },
                body: JSON.stringify({
                    shareWithCareTeam: true,
                    allowReminders: true,
                    allowAiAnalysis: false,
                }),
            });
            expect(putRes.status).toBe(200);
        });

        it("reads care team members", async () => {
            const res = await app.request("/care-team", {
                headers: { Authorization: "Bearer demo-token-doctor-jwt" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.members).toBeInstanceOf(Array);
        });
    });
});
