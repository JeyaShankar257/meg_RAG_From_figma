import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { adminRouter } from "./admin/index.js";

// Mock adherencePipelineService
vi.mock("../services/adherencePipelineService.js", () => ({
    evaluateDailyPatternForPatient: vi.fn().mockImplementation(async (patientId: string) => {
        if (patientId === "p-error") {
            throw new Error("Evaluation failed");
        }
        return {
            success: true,
            patientId,
            consecutiveSkips: 2,
            warningSent: true,
        };
    }),
}));

// Mock Supabase admin client
vi.mock("../lib/supabase.js", () => {
    return {
        getAdminClient: () => ({
            from: (table: string) => {
                if (table === "patients") {
                    return {
                        select: () => ({
                            eq: () =>
                                Promise.resolve({
                                    data: [
                                        { id: "p-001", full_name: "Marcus Rivera" },
                                        { id: "p-002", full_name: "Sarah Chen" },
                                    ],
                                    error: null,
                                }),
                        }),
                    };
                }
                return {};
            },
        }),
    };
});

describe("Admin Batch Adherence Evaluation API (Task 1.1 - 1.3, 4.1)", () => {
    let app: Hono;

    beforeEach(() => {
        process.env["ADMIN_SECRET"] = "test-secret-12345";
        app = new Hono();
        app.route("/admin", adminRouter);
    });

    it("rejects requests missing x-admin-secret with 401", async () => {
        const res = await app.request("/admin/patients/evaluate-all", {
            method: "POST",
        });

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toContain("Unauthorized");
    });

    it("rejects requests with incorrect x-admin-secret with 401", async () => {
        const res = await app.request("/admin/patients/evaluate-all", {
            method: "POST",
            headers: {
                "x-admin-secret": "wrong-secret",
            },
        });

        expect(res.status).toBe(401);
    });

    it("evaluates all active patients when provided correct secret", async () => {
        const res = await app.request("/admin/patients/evaluate-all", {
            method: "POST",
            headers: {
                "x-admin-secret": "test-secret-12345",
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.evaluated).toBe(2);
        expect(body.succeeded).toBe(2);
        expect(body.failed).toBe(0);
        expect(body.errors).toHaveLength(0);
    });
});

