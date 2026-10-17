import type { Context, Next } from "hono";
import { ApiError } from "../lib/errors.js";
import { getAdminClient, getUserClient } from "../lib/supabase.js";
import type { UserContext } from "../services/authorization.js";

declare module "hono" {
    interface ContextVariableMap {
        user: UserContext;
        accessToken: string;
        correlationId: string;
    }
}

export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw ApiError.unauthorized("Missing or malformed Authorization header");
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
        throw ApiError.unauthorized("Empty bearer token");
    }

    // In demo mode, support demo bearer tokens for fast testing without needing active Supabase cloud auth
    if (process.env["DEMO_MODE"] === "true") {
        if (token.startsWith("demo-token-doctor")) {
            const { data: profile } = await getAdminClient()
                .from("profiles")
                .select("id, workspace_id, role, email, must_change_password")
                .eq("email", "s.chen@mednova.clinic")
                .maybeSingle();
            c.set("user", {
                profileId: profile?.id ?? "d0000000-0000-0000-0000-000000000001",
                workspaceId: profile?.workspace_id ?? "a0000000-0000-0000-0000-000000000001",
                role: "doctor",
                email: "s.chen@mednova.clinic",
            });
            c.set("accessToken", token);
            return next();
        }
        if (token.startsWith("demo-token-patient")) {
            const { data: profile } = await getAdminClient()
                .from("profiles")
                .select("id, workspace_id, role, email")
                .eq("email", "m.rivera@email.com")
                .maybeSingle();
            c.set("user", {
                profileId: profile?.id ?? "b0000000-0000-0000-0000-000000000001",
                workspaceId: profile?.workspace_id ?? "a0000000-0000-0000-0000-000000000001",
                role: "patient",
                email: "m.rivera@email.com",
            });
            c.set("accessToken", token);
            return next();
        }
        if (token.startsWith("demo-token-careteam")) {
            c.set("user", {
                profileId: "c0000000-0000-0000-0000-000000000001",
                workspaceId: "a0000000-0000-0000-0000-000000000001",
                role: "care_team",
                email: "p.nair@mednova.clinic",
            });
            c.set("accessToken", token);
            return next();
        }
        if (token.startsWith("demo-token-admin")) {
            c.set("user", {
                profileId: "e0000000-0000-0000-0000-000000000001",
                workspaceId: "a0000000-0000-0000-0000-000000000001",
                role: "admin",
                email: "admin@mednova.clinic",
            });
            c.set("accessToken", token);
            return next();
        }
    }

    const admin = getAdminClient();
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData.user) {
        throw ApiError.unauthorized("Session expired or invalid token");
    }

    const { data: profile, error: profErr } = await admin
        .from("profiles")
        .select("id, workspace_id, role, email, approval_status, must_change_password")
        .eq("id", authData.user.id)
        .single();

    if (profErr || !profile) {
        throw ApiError.forbidden("User profile not found or inactive");
    }

    // Role-specific approval and verification checks
    if (profile.role === "doctor" && profile.approval_status !== "approved") {
        throw ApiError.forbidden("Your doctor account is awaiting administrator approval");
    }

    let patientId: string | undefined = undefined;
    if (profile.role === "patient") {
        const { data: patient } = await admin
            .from("patients")
            .select("id, status")
            .eq("profile_id", profile.id)
            .eq("is_deleted", false)
            .maybeSingle();

        if (!patient || patient.status !== "active") {
            throw ApiError.forbidden("Patient account has not been activated or is inactive");
        }
        patientId = patient.id;
    }

    const mustChangePassword = Boolean(profile.must_change_password);

    // If forced to change password, deny access to protected clinical resources
    const currentPath = c.req.path;
    const isExemptPath =
        currentPath.endsWith("/auth/change-password") ||
        currentPath.endsWith("/auth/me") ||
        currentPath.endsWith("/auth/logout");

    if (mustChangePassword && !isExemptPath) {
        throw ApiError.forbidden("Temporary password must be changed before accessing clinical resources");
    }

    c.set("user", {
        profileId: profile.id,
        workspaceId: profile.workspace_id,
        role: profile.role,
        email: profile.email,
        mustChangePassword,
        patientId,
    });
    c.set("accessToken", token);

    await next();
}

/**
 * Middleware requiring specific roles.
 */
export function requireRole(...allowedRoles: Array<UserContext["role"]>) {
    return async (c: Context, next: Next) => {
        const user = c.get("user");
        if (!user) {
            throw ApiError.unauthorized();
        }
        if (!allowedRoles.includes(user.role)) {
            throw ApiError.forbidden(`Operation restricted to roles: ${allowedRoles.join(", ")}`);
        }
        await next();
    };
}
