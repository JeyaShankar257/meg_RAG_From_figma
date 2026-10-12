import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const correctionsRouter = new Hono();
correctionsRouter.use("*", authMiddleware);

const createCorrectionSchema = z.object({
    patientId: z.string().min(1),
    targetType: z.enum(["dose_log", "adherence", "patient_report", "ai_analysis"]),
    targetId: z.string().min(1),
    description: z.string().min(5, "Please provide description of correction request"),
});

const updateStatusSchema = z.object({
    status: z.enum(["under_review", "resolved", "rejected"]),
});

// ─── 1. Submit Correction Request (POST /corrections) ─────────────────────────
// Append-only: creates reviewable correction request without mutating historical records (Task 5.3)
correctionsRouter.post("/", async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = createCorrectionSchema.parse(body);

    const admin = getAdminClient();

    // Verify patient self or assigned doctor
    if (user.role === "patient") {
        const { data: patient } = await admin
            .from("patients")
            .select("id, profile_id")
            .eq("id", validated.patientId)
            .single();

        if (!patient || patient.profile_id !== user.profileId) {
            throw ApiError.forbidden("Patients may only request corrections for their own records");
        }
    }

    const { data: correction, error } = await admin
        .from("correction_requests")
        .insert({
            patient_id: validated.patientId,
            requested_by_profile_id: user.profileId,
            target_type: validated.targetType,
            target_id: validated.targetId,
            description: validated.description,
            status: "open",
        })
        .select()
        .single();

    if (error || !correction) {
        throw ApiError.internal("Failed to submit correction request", error?.message);
    }

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "submit_correction_request",
        target_type: "correction_request",
        target_id: correction.id,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, correction }, 201);
});

// ─── 2. List Corrections for Patient (GET /corrections?patientId=...) ─────────
correctionsRouter.get("/", async (c) => {
    const user = c.get("user");
    const patientId = c.req.query("patientId");
    if (!patientId) throw ApiError.badRequest("patientId query param is required");

    const admin = getAdminClient();

    let query = admin
        .from("correction_requests")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

    if (user.role === "patient") {
        query = query.eq("requested_by_profile_id", user.profileId);
    }

    const { data: corrections, error } = await query;
    if (error) throw ApiError.internal("Failed to retrieve correction requests", error.message);

    return c.json({ corrections: corrections || [] });
});

// ─── 3. Review Correction Request (PATCH /corrections/:id/status) ─────────────
correctionsRouter.patch("/:id/status", requireRole("doctor", "admin"), async (c) => {
    const user = c.get("user");
    const correctionId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const { status } = updateStatusSchema.parse(body);

    const admin = getAdminClient();

    const { data: updated, error } = await admin
        .from("correction_requests")
        .update({ status })
        .eq("id", correctionId)
        .select()
        .single();

    if (error || !updated) throw ApiError.internal("Failed to update correction status", error?.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "update_correction_status",
        target_type: "correction_request",
        target_id: correctionId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, correction: updated });
});
