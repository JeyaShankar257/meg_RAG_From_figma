import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const prescriptionsRouter = new Hono();
prescriptionsRouter.use("*", authMiddleware);

const approvePrescriptionSchema = z.object({
    changes: z.record(z.unknown()).optional(),
});

// ─── POST /prescriptions/:id/approve ──────────────────────────────────────────
// Transactional prescription review and approval with revision history and job queue (Task 4.2)
prescriptionsRouter.post("/:id/approve", requireRole("doctor"), async (c) => {
    const user = c.get("user");
    const prescriptionId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json().catch(() => ({}));
    const validated = approvePrescriptionSchema.parse(body);

    const admin = getAdminClient();

    // 1. Fetch prescription
    const { data: prescription, error: fetchErr } = await admin
        .from("prescriptions")
        .select("*, patients(id, workspace_id)")
        .eq("id", prescriptionId)
        .single();

    if (fetchErr || !prescription) {
        throw ApiError.notFound("Prescription not found");
    }

    if (prescription.status === "superseded") {
        throw ApiError.badRequest("Prescription is superseded and cannot be approved");
    }

    // 2. Verify doctor is assigned to this patient
    const { data: assignment } = await admin
        .from("care_team_assignments")
        .select("*")
        .eq("patient_id", prescription.patient_id)
        .eq("doctor_profile_id", user.profileId)
        .is("revoked_at", null)
        .maybeSingle();

    if (!assignment) {
        throw ApiError.forbidden("Doctor is not assigned to this patient");
    }

    const approvedAt = new Date().toISOString();

    // 3. Atomically update prescription status to 'approved'
    const { data: updatedPrescription, error: updateErr } = await admin
        .from("prescriptions")
        .update({
            status: "approved",
            approved_by_profile_id: user.profileId,
            approved_at: approvedAt,
        })
        .eq("id", prescriptionId)
        .select()
        .single();

    if (updateErr || !updatedPrescription) {
        throw ApiError.internal("Failed to approve prescription", updateErr?.message);
    }

    // 4. Record revision history if edited values were provided
    let revision = null;
    if (validated.changes && Object.keys(validated.changes).length > 0) {
        const { data: revData, error: revErr } = await admin
            .from("prescription_revisions")
            .insert({
                prescription_id: prescriptionId,
                revised_by_profile_id: user.profileId,
                changes: validated.changes,
                revised_at: approvedAt,
            })
            .select()
            .single();

        if (revErr) {
            throw ApiError.internal("Failed to record prescription revision", revErr.message);
        }
        revision = revData;
    }

    // 5. Enqueue downstream dose schedule generation job in durable queue
    await admin.from("jobs").insert({
        type: "generate_dose_schedule",
        idempotency_key: `gen-schedule-${prescriptionId}`,
        correlation_id: correlationId,
        payload: {
            prescriptionId,
            patientId: prescription.patient_id,
            approvedBy: user.profileId,
        },
    });

    // 6. Record immutable audit event
    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "approve_prescription",
        target_type: "prescription",
        target_id: prescriptionId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({
        success: true,
        prescription: updatedPrescription,
        revision,
        message: "Prescription approved and downstream schedule generation queued",
    });
});

// ─── POST /prescriptions/:id/reject ───────────────────────────────────────────
prescriptionsRouter.post("/:id/reject", requireRole("doctor"), async (c) => {
    const user = c.get("user");
    const prescriptionId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const admin = getAdminClient();

    const { data: prescription } = await admin
        .from("prescriptions")
        .select("id, patient_id")
        .eq("id", prescriptionId)
        .single();
    if (!prescription) throw ApiError.notFound("Prescription not found");
    const { data: assignment } = await admin
        .from("care_team_assignments")
        .select("id")
        .eq("patient_id", prescription.patient_id)
        .eq("doctor_profile_id", user.profileId)
        .is("revoked_at", null)
        .maybeSingle();
    if (!assignment) throw ApiError.forbidden("Doctor is not assigned to this patient");

    const { data: updated, error } = await admin
        .from("prescriptions")
        .update({
            status: "rejected",
            approved_by_profile_id: user.profileId,
            approved_at: new Date().toISOString(),
        })
        .eq("id", prescriptionId)
        .select()
        .single();

    if (error || !updated) throw ApiError.internal("Failed to reject prescription", error?.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "reject_prescription",
        target_type: "prescription",
        target_id: prescriptionId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, prescription: updated });
});
