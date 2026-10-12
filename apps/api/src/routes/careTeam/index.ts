import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const careTeamRouter = new Hono();
careTeamRouter.use("*", authMiddleware);

const grantSchema = z.object({
    patientId: z.string().min(1),
    granteeProfileId: z.string().uuid(),
    scope: z.string().default("all"),
});

const revokeSchema = z.object({
    grantId: z.string().uuid(),
});

// List care team members in workspace
careTeamRouter.get("/", async (c) => {
    const user = c.get("user");
    const admin = getAdminClient();

    const { data: members, error } = await admin
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("workspace_id", user.workspaceId)
        .in("role", ["doctor", "care_team"]);

    if (error) throw ApiError.internal("Failed to retrieve care team", error.message);

    return c.json({ members: members || [] });
});

// Grant care team member access to patient
careTeamRouter.post("/grant", requireRole("doctor", "admin"), async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = grantSchema.parse(body);

    const admin = getAdminClient();
    const { data: grant, error } = await admin
        .from("care_grants")
        .insert({
            patient_id: validated.patientId,
            grantee_profile_id: validated.granteeProfileId,
            granted_by_id: user.profileId,
            scope: validated.scope,
        })
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to grant care access", error.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "create_care_grant",
        target_type: "care_grant",
        target_id: grant.id,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, grant }, 201);
});

// Revoke care team member access
careTeamRouter.post("/revoke", requireRole("doctor", "admin"), async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = revokeSchema.parse(body);

    const admin = getAdminClient();
    const { data: revoked, error } = await admin
        .from("care_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", validated.grantId)
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to revoke care access", error.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "revoke_care_grant",
        target_type: "care_grant",
        target_id: validated.grantId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, grant: revoked });
});
