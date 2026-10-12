import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware } from "../../middleware/auth.js";
import { authorizePatientAccess } from "../../services/authorization.js";

export const dosesRouter = new Hono();
dosesRouter.use("*", authMiddleware);

const logDoseSchema = z.object({
    scheduleId: z.string().uuid("scheduleId must be a valid UUID"),
    patientId: z.string().min(1, "patientId is required"),
    status: z.enum(["pending", "taken", "late", "missed", "skipped"]),
    method: z.enum(["oral", "injection", "patch", "other"]).optional(),
    reason: z.string().optional(),
    idempotencyKey: z.string().min(1, "idempotencyKey is required"),
});

// ─── POST /doses ──────────────────────────────────────────────────────────────
// Idempotent dose logging with server timestamp and duplicate protection (Task 4.1)
dosesRouter.post("/", async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = logDoseSchema.parse(body);

    const admin = getAdminClient();

    const { data: patient } = await admin
        .from("patients")
        .select("id, workspace_id, profile_id")
        .eq("id", validated.patientId)
        .single();
    if (!patient) throw ApiError.notFound("Patient not found");
    const { data: assignments } = await admin.from("care_team_assignments").select("*").eq("patient_id", validated.patientId);
    const access = authorizePatientAccess({
        user,
        patient: { id: patient.id, workspaceId: patient.workspace_id, profileId: patient.profile_id },
        assignments: assignments ?? [],
    });
    if (!access.authorized) throw ApiError.forbidden(access.reason);
    if (user.role !== "patient") throw ApiError.forbidden("Only patients may record dose events");

    const { data: schedule } = await admin
        .from("dose_schedules")
        .select("id, patient_id")
        .eq("id", validated.scheduleId)
        .maybeSingle();
    if (schedule && schedule.patient_id !== validated.patientId) {
        throw ApiError.badRequest("Dose schedule does not belong to this patient");
    }
    if (!schedule && process.env["DEMO_MODE"] !== "true") {
        throw ApiError.badRequest("Dose schedule not found");
    }

    // 2. Check for existing record with same idempotency key
    const { data: existingDose } = await admin
        .from("dose_logs")
        .select("*")
        .eq("idempotency_key", validated.idempotencyKey)
        .maybeSingle();

    if (existingDose) {
        // Idempotent return: resolve to existing result without creating duplicate
        return c.json(
            {
                success: true,
                duplicated: true,
                dose: existingDose,
                message: "Dose event already recorded with this idempotency key",
            },
            200,
        );
    }

    // 3. Authoritative server timestamp insertion
    const serverTimestamp = new Date().toISOString();
    const { data: newDose, error: insertError } = await admin
        .from("dose_logs")
        .insert({
            schedule_id: validated.scheduleId,
            patient_id: validated.patientId,
            status: validated.status,
            method: validated.method || null,
            reason: validated.reason || null,
            idempotency_key: validated.idempotencyKey,
            logged_at: serverTimestamp,
        })
        .select()
        .single();

    if (insertError || !newDose) {
        // If unique constraint race condition hit concurrently
        if (insertError?.code === "23505") {
            const { data: raceDose } = await admin
                .from("dose_logs")
                .select("*")
                .eq("idempotency_key", validated.idempotencyKey)
                .single();
            return c.json(
                {
                    success: true,
                    duplicated: true,
                    dose: raceDose,
                    message: "Dose event already recorded",
                },
                200,
            );
        }
        throw ApiError.internal("Failed to record dose log", insertError?.message);
    }

    // 4. Record audit event
    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "log_dose",
        target_type: "dose_log",
        target_id: newDose.id,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json(
        {
            success: true,
            duplicated: false,
            dose: newDose,
        },
        201,
    );
});
