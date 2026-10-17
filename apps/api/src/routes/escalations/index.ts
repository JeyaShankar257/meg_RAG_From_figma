import { Hono } from "hono";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const escalationsRouter = new Hono();
escalationsRouter.use("*", authMiddleware);
escalationsRouter.use("*", requireRole("doctor", "admin"));

async function getAccessiblePatientIds(user: {
    profileId: string;
    workspaceId: string;
    role: string;
}) {
    const admin = getAdminClient();
    let query = admin
        .from("patients")
        .select("id, care_team_assignments!inner(doctor_profile_id, revoked_at)")
        .eq("workspace_id", user.workspaceId)
        .eq("is_deleted", false);

    if (user.role === "doctor") {
        query = query
            .eq("care_team_assignments.doctor_profile_id", user.profileId)
            .is("care_team_assignments.revoked_at", null);
    }

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to retrieve accessible patients", error.message);
    return (data ?? []).map((patient) => patient.id);
}

escalationsRouter.get("/", async (c) => {
    const user = c.get("user");
    const requestedPatientId = c.req.query("patientId");
    const patientIds = await getAccessiblePatientIds(user);

    if (requestedPatientId && !patientIds.includes(requestedPatientId)) {
        throw ApiError.notFound("Escalation record not found");
    }

    const admin = getAdminClient();
    let query = admin
        .from("escalations")
        .select("id, patient_id, analysis_id, severity, status, reasoning, confidence, model_version, acknowledged_by_profile_id, acknowledged_at, created_at")
        .in("patient_id", requestedPatientId ? [requestedPatientId] : patientIds)
        .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to retrieve escalations", error.message);
    return c.json({ escalations: data ?? [] });
});

escalationsRouter.post("/:id/acknowledge", async (c) => {
    const user = c.get("user");
    const patientIds = await getAccessiblePatientIds(user);
    const escalationId = c.req.param("id");
    const admin = getAdminClient();

    const { data: escalation, error: lookupError } = await admin
        .from("escalations")
        .select("id, patient_id, status")
        .eq("id", escalationId)
        .maybeSingle();

    if (lookupError) throw ApiError.internal("Failed to retrieve escalation", lookupError.message);
    if (!escalation || !patientIds.includes(escalation.patient_id)) {
        throw ApiError.notFound("Escalation record not found");
    }

    if (escalation.status === "acknowledged") {
        return c.json({ success: true, escalation });
    }

    const { data: updated, error } = await admin
        .from("escalations")
        .update({
            status: "acknowledged",
            acknowledged_by_profile_id: user.profileId,
            acknowledged_at: new Date().toISOString(),
        })
        .eq("id", escalationId)
        .select()
        .single();

    if (error || !updated) {
        throw ApiError.internal("Failed to acknowledge escalation", error?.message);
    }
    return c.json({ success: true, escalation: updated });
});
