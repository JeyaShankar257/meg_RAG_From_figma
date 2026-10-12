import { Hono } from "hono";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";
import { authorizeAuditRead } from "../../services/authorization.js";

export const auditRouter = new Hono();
auditRouter.use("*", authMiddleware);

// ─── GET /audit ───────────────────────────────────────────────────────────────
// Authorized audit queries — admin only, no secrets exposed (Task 5.4)
auditRouter.get("/", requireRole("admin"), async (c) => {
    const user = c.get("user");
    const admin = getAdminClient();

    const authCheck = authorizeAuditRead(user, user.workspaceId);
    if (!authCheck.authorized) {
        throw ApiError.forbidden(authCheck.reason);
    }

    const action = c.req.query("action");
    const targetType = c.req.query("targetType");
    const targetId = c.req.query("targetId");
    const limit = Math.min(Number(c.req.query("limit") || 50), 200);

    let query = admin
        .from("audit_events")
        .select(`
            id,
            workspace_id,
            actor_profile_id,
            action,
            target_type,
            target_id,
            correlation_id,
            outcome,
            occurred_at
        `)
        .eq("workspace_id", user.workspaceId)
        .order("occurred_at", { ascending: false })
        .limit(limit);

    if (action) query = query.eq("action", action);
    if (targetType) query = query.eq("target_type", targetType);
    if (targetId) query = query.eq("target_id", targetId);

    const { data: events, error } = await query;
    if (error) throw ApiError.internal("Failed to retrieve audit events", error.message);

    return c.json({
        events: (events || []).map((e) => ({
            id: e.id,
            actorId: e.actor_profile_id,
            action: e.action,
            targetType: e.target_type,
            targetId: e.target_id,
            correlationId: e.correlation_id,
            outcome: e.outcome,
            occurredAt: e.occurred_at,
        })),
    });
});
