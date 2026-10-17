import { Hono } from "hono";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../../lib/errors.js";
import { getConfig } from "../../config.js";
import { getAdminClient, getAuthAdminClient, getUserClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const authRouter = new Hono();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    portal: z.enum(["doctor", "patient"]),
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

const recoverSchema = z.object({
    email: z.string().email(),
});

const verifyEmailSchema = z.object({
    tokenHash: z.string().min(1),
    type: z.enum(["signup", "recovery", "invite", "email_change"]).default("signup"),
});

const preferencesSchema = z.record(z.unknown());

const acceptInvitationSchema = z.object({
    accessToken: z.string().min(1),
    password: z.string().min(8),
});

const doctorInvitationSchema = z.object({
    email: z.string().email(),
    fullName: z.string().min(2),
    workspaceId: z.string().uuid(),
});

const temporaryPasswordSchema = z.object({
    temporaryPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
    password: z.string().min(8),
});

/**
 * Maps Supabase Auth provider errors to documented HTTP status codes and safe messages.
 * Never logs or exposes secret tokens, passwords, or keys.
 */
export function mapAuthError(error: any): never {
    const rawMessage = error?.message || "Authentication provider failure";
    const msg = rawMessage.toLowerCase();

    if (msg.includes("rate limit") || msg.includes("too many requests")) {
        throw ApiError.tooManyRequests(
            "Supabase invitation email rate limit exceeded. Wait before sending another invitation.",
        );
    }
    if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user already")
    ) {
        throw ApiError.conflict("An account already exists for this email");
    }
    if (
        msg.includes("invalid token") ||
        msg.includes("token has expired") ||
        msg.includes("token is expired") ||
        msg.includes("expired")
    ) {
        throw ApiError.unauthorized("This invitation is invalid or expired");
    }
    if (
        msg.includes("user not allowed") ||
        msg.includes("not authorized") ||
        msg.includes("service_role")
    ) {
        throw ApiError.internal(
            "The API Supabase server key cannot create invitations. Update SUPABASE_SERVICE_ROLE_KEY and restart the API.",
        );
    }
    if (
        msg.includes("redirect") ||
        msg.includes("redirect_to") ||
        msg.includes("url")
    ) {
        throw ApiError.badRequest("The activation redirect URL is not authorized by the authentication provider.");
    }

    throw ApiError.internal("Authentication operation failed", rawMessage);
}

/**
 * Records server-side audit events with sensitive field exclusion.
 */
async function recordAuthAudit(
    admin: SupabaseClient,
    params: {
        workspaceId?: string;
        actorProfileId?: string;
        action: string;
        targetType?: string;
        targetId?: string;
        correlationId: string;
        outcome: "success" | "denied" | "error";
        metadata?: Record<string, unknown>;
    },
) {
    const sanitizedMetadata: Record<string, unknown> = {};
    if (params.metadata) {
        for (const [k, v] of Object.entries(params.metadata)) {
            const lower = k.toLowerCase();
            if (
                !lower.includes("password") &&
                !lower.includes("token") &&
                !lower.includes("secret") &&
                !lower.includes("key")
            ) {
                sanitizedMetadata[k] = v;
            }
        }
    }

    try {
        await admin.from("audit_events").insert({
            workspace_id: params.workspaceId,
            actor_profile_id: params.actorProfileId,
            action: params.action,
            target_type: params.targetType,
            target_id: params.targetId,
            correlation_id: params.correlationId,
            outcome: params.outcome,
            metadata: sanitizedMetadata,
        });
    } catch {
        // Non-blocking audit failure
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────
authRouter.post("/login", async (c) => {
    const body = await c.req.json();
    const { email, password, portal } = loginSchema.parse(body);
    const correlationId = c.get("correlationId") || "auth-corr";

    const isDemoMode = process.env["DEMO_MODE"] === "true";

    // Demo Mode Fast Fallback (when local testing without live Supabase cloud auth)
    if (isDemoMode) {
        if (portal === "doctor" && (email === "s.chen@mednova.clinic" || email === "doctor@mednova.clinic")) {
            const { data: seededProfile } = await getAdminClient()
                .from("profiles")
                .select("id, workspace_id, role, full_name, email")
                .eq("email", email === "doctor@mednova.clinic" ? "s.chen@mednova.clinic" : email)
                .maybeSingle();
            return c.json({
                token: "demo-token-doctor-jwt",
                refreshToken: "demo-refresh-token-doctor",
                user: {
                    id: seededProfile?.id ?? "d0000000-0000-0000-0000-000000000001",
                    role: "doctor",
                    fullName: "Dr. Jeya Shankar M",
                    email: "s.chen@mednova.clinic",
                    workspaceId: seededProfile?.workspace_id ?? "a0000000-0000-0000-0000-000000000001",
                    approvalStatus: "approved",
                    emailVerified: true,
                    mustChangePassword: false,
                },
            });
        }
        if (portal === "patient" && (email === "m.rivera@email.com" || email === "patient@mednova.clinic")) {
            const { data: seededProfile } = await getAdminClient()
                .from("profiles")
                .select("id, workspace_id, role, full_name, email")
                .eq("email", "m.rivera@email.com")
                .maybeSingle();
            return c.json({
                token: "demo-token-patient-jwt",
                refreshToken: "demo-refresh-token-patient",
                user: {
                    id: seededProfile?.id ?? "b0000000-0000-0000-0000-000000000001",
                    patientId: "p-001",
                    role: "patient",
                    fullName: "Marcus Rivera",
                    email: "m.rivera@email.com",
                    workspaceId: seededProfile?.workspace_id ?? "a0000000-0000-0000-0000-000000000001",
                    approvalStatus: "approved",
                    patientStatus: "active",
                    emailVerified: true,
                    mustChangePassword: false,
                },
            });
        }
        // If wrong portal attempted in demo mode:
        if (portal === "doctor" && email.includes("patient")) {
            throw ApiError.unauthorized("Invalid login credentials for this portal");
        }
        if (portal === "patient" && (email.includes("doctor") || email.includes("clinic"))) {
            throw ApiError.unauthorized("Invalid login credentials for this portal");
        }
    }

    const admin = getAdminClient();
    const { data: authData, error: authError } = await admin.auth.signInWithPassword({
        email,
        password,
    });

    if (authError || !authData.session || !authData.user) {
        // Safe generic message — never enumerate whether email exists
        throw ApiError.unauthorized("Invalid email or password");
    }

    const { data: profile, error: profError } = await admin
        .from("profiles")
        .select("id, workspace_id, role, full_name, email, approval_status, must_change_password")
        .eq("id", authData.user.id)
        .single();

    if (profError || !profile) {
        throw ApiError.unauthorized("Account profile not found");
    }

    if (!authData.user.email_confirmed_at) {
        throw ApiError.unauthorized("Please verify your email before signing in");
    }

    if (profile.role === "doctor" && profile.approval_status !== "approved") {
        throw ApiError.unauthorized("Your doctor account is awaiting administrator approval");
    }

    let patientRecord: { id: string; status: string } | null = null;
    if (profile.role === "patient") {
        const { data: patient } = await admin
            .from("patients")
            .select("id, status")
            .eq("profile_id", profile.id)
            .eq("is_deleted", false)
            .maybeSingle();

        if (!patient) {
            throw ApiError.unauthorized("Account profile not found");
        }
        if (patient.status === "pending") {
            throw ApiError.unauthorized("Your patient account has not been activated. Please check your invitation email.");
        }
        if (patient.status !== "active") {
            throw ApiError.unauthorized("Your patient account is inactive. Please contact your care team.");
        }
        patientRecord = patient;
    }

    // Role-gating check: reject wrong-portal logins without revealing account details
    if (portal === "doctor" && profile.role === "patient") {
        await admin.auth.signOut();
        throw ApiError.unauthorized("Invalid login credentials for this portal");
    }

    if (portal === "patient" && profile.role !== "patient") {
        await admin.auth.signOut();
        throw ApiError.unauthorized("Invalid login credentials for this portal");
    }

    await recordAuthAudit(admin, {
        workspaceId: profile.workspace_id,
        actorProfileId: profile.id,
        action: "login",
        targetType: "profile",
        targetId: profile.id,
        correlationId,
        outcome: "success",
    });

    return c.json({
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        user: {
            id: profile.id,
            ...(patientRecord ? { patientId: patientRecord.id } : {}),
            role: profile.role,
            fullName: profile.full_name,
            email: profile.email,
            workspaceId: profile.workspace_id,
            approvalStatus: profile.approval_status,
            patientStatus: patientRecord?.status,
            emailVerified: Boolean(authData.user.email_confirmed_at),
            mustChangePassword: Boolean(profile.must_change_password),
        },
    });
});

// ─── Doctor Invitations (Admin only) ──────────────────────────────────────────
authRouter.get("/doctor-invitations", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const admin = getAdminClient();
    const { data: doctors, error } = await admin
        .from("profiles")
        .select("id, full_name, email, approval_status, must_change_password, created_at, approved_at, invited_by_profile_id")
        .eq("workspace_id", user.workspaceId)
        .eq("role", "doctor")
        .order("created_at", { ascending: false });

    if (error) {
        throw ApiError.internal("Failed to retrieve doctor invitations", error.message);
    }

    return c.json({
        doctors: (doctors || []).map((d) => ({
            id: d.id,
            fullName: d.full_name,
            email: d.email,
            approvalStatus: d.approval_status,
            mustChangePassword: Boolean(d.must_change_password),
            createdAt: d.created_at,
            approvedAt: d.approved_at,
            invitedBy: d.invited_by_profile_id,
        })),
    });
});

authRouter.post("/doctor-invitations", authMiddleware, async (c) => {
    const user = c.get("user");
    const correlationId = c.get("correlationId") || "auth-corr";
    const admin = getAdminClient();

    if (user.role !== "admin") {
        await recordAuthAudit(admin, {
            workspaceId: user.workspaceId,
            actorProfileId: user.profileId,
            action: "denied_doctor_provisioning",
            correlationId,
            outcome: "denied",
        });
        throw ApiError.forbidden("Operation restricted to roles: admin");
    }

    const body = doctorInvitationSchema.parse(await c.req.json());
    if (body.workspaceId !== user.workspaceId) {
        await recordAuthAudit(admin, {
            workspaceId: user.workspaceId,
            actorProfileId: user.profileId,
            action: "denied_doctor_provisioning",
            correlationId,
            outcome: "denied",
        });
        throw ApiError.forbidden("Doctors may only be invited into your workspace");
    }

    const authAdmin = getAuthAdminClient();
    const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", body.email)
        .maybeSingle();
    if (existingProfile) {
        throw ApiError.conflict("An account already exists for this email");
    }

    const config = getConfig();
    const { data: invitation, error: invitationError } =
        await authAdmin.auth.admin.inviteUserByEmail(body.email, {
            data: { role: "doctor", approval_status: "pending" },
            redirectTo: config.doctorActivationUrl,
        });

    if (invitationError || !invitation.user) {
        await recordAuthAudit(admin, {
            workspaceId: user.workspaceId,
            actorProfileId: user.profileId,
            action: "invite_doctor",
            correlationId,
            outcome: "error",
        });
        mapAuthError(invitationError);
    }

    const { error: profileError } = await admin.rpc("provision_invited_profile", {
        p_id: invitation.user.id,
        p_workspace_id: body.workspaceId,
        p_role: "doctor",
        p_full_name: body.fullName,
        p_email: body.email,
        p_approval_status: "pending",
        p_invited_by_profile_id: user.profileId,
    });

    if (profileError) {
        await authAdmin.auth.admin.deleteUser(invitation.user.id);
        await recordAuthAudit(admin, {
            workspaceId: user.workspaceId,
            actorProfileId: user.profileId,
            action: "invite_doctor",
            correlationId,
            outcome: "error",
        });
        throw ApiError.internal("Failed to create invited doctor profile", profileError.message);
    }

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "invite_doctor",
        targetType: "doctor",
        targetId: invitation.user.id,
        correlationId,
        outcome: "success",
        metadata: {
            fullName: body.fullName,
            email: body.email,
        },
    });

    return c.json({
        success: true,
        message: "Doctor invitation sent. An administrator must approve the account before login.",
    }, 201);
});

authRouter.post("/doctor-invitations/:profileId/approve", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const profileId = c.req.param("profileId");
    const correlationId = c.get("correlationId") || "auth-corr";
    const admin = getAdminClient();

    const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("id, workspace_id, role, approval_status")
        .eq("id", profileId)
        .eq("workspace_id", user.workspaceId)
        .maybeSingle();

    if (lookupError) {
        throw ApiError.internal("Failed to retrieve doctor invitation", lookupError.message);
    }
    if (!profile || profile.role !== "doctor") {
        throw ApiError.notFound("Doctor invitation not found");
    }
    if (profile.approval_status === "approved") {
        return c.json({ success: true, message: "Doctor account is already approved", alreadyApproved: true });
    }

    const { error } = await admin
        .from("profiles")
        .update({
            approval_status: "approved",
            approved_by_profile_id: user.profileId,
            approved_at: new Date().toISOString(),
        })
        .eq("id", profileId);
    if (error) throw ApiError.internal("Failed to approve doctor account", error.message);

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "approve_doctor",
        targetType: "doctor",
        targetId: profileId,
        correlationId,
        outcome: "success",
    });

    return c.json({ success: true, message: "Doctor account approved" });
});

authRouter.post("/doctor-invitations/:profileId/reject", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const profileId = c.req.param("profileId");
    const correlationId = c.get("correlationId") || "auth-corr";
    const admin = getAdminClient();

    const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("id, workspace_id, role, approval_status")
        .eq("id", profileId)
        .eq("workspace_id", user.workspaceId)
        .maybeSingle();

    if (lookupError) {
        throw ApiError.internal("Failed to retrieve doctor invitation", lookupError.message);
    }
    if (!profile || profile.role !== "doctor") {
        throw ApiError.notFound("Doctor invitation not found");
    }
    if (profile.approval_status === "rejected") {
        return c.json({ success: true, message: "Doctor account is already rejected", alreadyRejected: true });
    }

    const { error } = await admin
        .from("profiles")
        .update({
            approval_status: "rejected",
        })
        .eq("id", profileId);
    if (error) throw ApiError.internal("Failed to reject doctor account", error.message);

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "reject_doctor",
        targetType: "doctor",
        targetId: profileId,
        correlationId,
        outcome: "success",
    });

    return c.json({ success: true, message: "Doctor account rejected" });
});

authRouter.post("/doctor-invitations/:profileId/password", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const profileId = c.req.param("profileId");
    const correlationId = c.get("correlationId") || "auth-corr";
    if (!profileId) {
        throw ApiError.badRequest("Doctor profile ID is required");
    }
    const { temporaryPassword } = temporaryPasswordSchema.parse(await c.req.json());
    const admin = getAdminClient();
    const authAdmin = getAuthAdminClient();

    const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("id, workspace_id, role, approval_status")
        .eq("id", profileId)
        .eq("workspace_id", user.workspaceId)
        .maybeSingle();

    if (lookupError) {
        throw ApiError.internal("Failed to retrieve doctor account", lookupError.message);
    }
    if (!profile || profile.role !== "doctor") {
        throw ApiError.notFound("Doctor account not found");
    }
    if (profile.approval_status !== "approved") {
        throw ApiError.badRequest("Approve the doctor before setting a temporary password");
    }

    const { error: passwordError } = await authAdmin.auth.admin.updateUserById(profileId, {
        password: temporaryPassword,
    });
    if (passwordError) {
        mapAuthError(passwordError);
    }

    const { error: profileError } = await admin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", profileId);
    if (profileError) {
        throw ApiError.internal("Failed to mark temporary password", profileError.message);
    }

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "set_temporary_password",
        targetType: "doctor",
        targetId: profileId,
        correlationId,
        outcome: "success",
    });

    return c.json({
        success: true,
        message: "Temporary password set. The doctor must change it after signing in.",
    });
});

authRouter.post("/doctor-invitations/:profileId/resend", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const profileId = c.req.param("profileId");
    const correlationId = c.get("correlationId") || "auth-corr";
    const admin = getAdminClient();
    const authAdmin = getAuthAdminClient();

    const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("id, workspace_id, role, email, approval_status")
        .eq("id", profileId)
        .eq("workspace_id", user.workspaceId)
        .maybeSingle();

    if (lookupError) {
        throw ApiError.internal("Failed to retrieve doctor invitation", lookupError.message);
    }
    if (!profile || profile.role !== "doctor") {
        throw ApiError.notFound("Doctor invitation not found");
    }

    const config = getConfig();
    const { error: inviteError } = await authAdmin.auth.admin.inviteUserByEmail(profile.email, {
        data: { role: "doctor", approval_status: profile.approval_status },
        redirectTo: config.doctorActivationUrl,
    });

    if (inviteError) {
        mapAuthError(inviteError);
    }

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "resend_doctor_invitation",
        targetType: "doctor",
        targetId: profileId,
        correlationId,
        outcome: "success",
    });

    return c.json({ success: true, message: "Doctor invitation resent successfully" });
});

// ─── Accept Invitation ────────────────────────────────────────────────────────
authRouter.post("/accept-invitation", async (c) => {
    const { accessToken, password } = acceptInvitationSchema.parse(await c.req.json());
    const correlationId = c.get("correlationId") || "auth-corr";
    const userClient = getUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
        throw ApiError.unauthorized("This invitation is invalid or expired");
    }

    const { error: updateError } = await userClient.auth.updateUser({ password });
    if (updateError) {
        mapAuthError(updateError);
    }

    const admin = getAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("id, role, workspace_id")
        .eq("id", userData.user.id)
        .maybeSingle();

    if (profile?.role === "patient") {
        // Transition patient record from pending to active
        try {
            const { error: rpcErr } = await admin.rpc("activate_patient_account", {
                p_profile_id: userData.user.id,
            });
            if (rpcErr) throw rpcErr;
        } catch {
            await admin
                .from("patients")
                .update({ status: "active", activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("profile_id", userData.user.id)
                .eq("status", "pending");
        }
    }

    await recordAuthAudit(admin, {
        workspaceId: profile?.workspace_id,
        actorProfileId: userData.user.id,
        action: "activate_account",
        targetType: profile?.role ?? "user",
        targetId: userData.user.id,
        correlationId,
        outcome: "success",
    });

    return c.json({
        success: true,
        message: "Invitation accepted. You can now sign in.",
        email: userData.user.email,
    });
});

// ─── Change Password ──────────────────────────────────────────────────────────
authRouter.post("/change-password", authMiddleware, async (c) => {
    const user = c.get("user");
    const accessToken = c.get("accessToken");
    const correlationId = c.get("correlationId") || "auth-corr";
    if (!accessToken) {
        throw ApiError.unauthorized("Missing session token");
    }
    const { password } = changePasswordSchema.parse(await c.req.json());
    const userClient = getUserClient(accessToken);
    const { error: passwordError } = await userClient.auth.updateUser({ password });
    if (passwordError) {
        mapAuthError(passwordError);
    }

    const { error: profileError } = await getAdminClient()
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.profileId);
    if (profileError) {
        throw ApiError.internal("Password changed, but account status could not be updated", profileError.message);
    }

    await recordAuthAudit(getAdminClient(), {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "change_password",
        targetType: "profile",
        targetId: user.profileId,
        correlationId,
        outcome: "success",
    });

    return c.json({ success: true, message: "Password changed successfully" });
});

// ─── Sign Out ─────────────────────────────────────────────────────────────────
authRouter.post("/logout", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const authAdmin = getAuthAdminClient();
        await authAdmin.auth.admin.signOut(token).catch(() => {});
    }
    return c.json({ success: true, message: "Signed out successfully" });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
authRouter.post("/refresh", async (c) => {
    const body = await c.req.json();
    const { refreshToken } = refreshSchema.parse(body);

    if (process.env["DEMO_MODE"] === "true" && refreshToken.startsWith("demo-refresh-token-patient")) {
        return c.json({
            token: "demo-token-patient-refreshed",
            refreshToken: "demo-refresh-token-patient-refreshed",
        });
    }

    if (process.env["DEMO_MODE"] === "true" && refreshToken.startsWith("demo-refresh")) {
        return c.json({
            token: "demo-token-doctor-refreshed",
            refreshToken: "demo-refresh-token-refreshed",
        });
    }

    const admin = getAdminClient();
    const { data, error } = await admin.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
        throw ApiError.unauthorized("Failed to refresh session");
    }

    return c.json({
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
    });
});

// ─── Password Recovery ────────────────────────────────────────────────────────
authRouter.post("/recover-password", async (c) => {
    const body = await c.req.json();
    const { email } = recoverSchema.parse(body);

    const admin = getAdminClient();
    await admin.auth.resetPasswordForEmail(email).catch(() => {});

    // Always return success to prevent user enumeration
    return c.json({
        success: true,
        message: "If the account exists, password recovery instructions have been sent.",
    });
});

// ─── Email Verification ───────────────────────────────────────────────────────
authRouter.post("/verify-email", async (c) => {
    const body = await c.req.json();
    const { tokenHash, type } = verifyEmailSchema.parse(body);

    const admin = getAdminClient();
    const { error } = await admin.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
    });

    if (error) {
        throw ApiError.badRequest("Email verification failed or token expired");
    }

    return c.json({ success: true, message: "Email successfully verified" });
});

// ─── Orphan Reconciliation (Admin only) ───────────────────────────────────────
authRouter.post("/reconciliation/orphans", authMiddleware, requireRole("admin"), async (c) => {
    const user = c.get("user");
    const correlationId = c.get("correlationId") || "auth-corr";
    const admin = getAdminClient();

    const { data, error } = await admin.rpc("reconcile_workspace_orphans", {
        p_workspace_id: user.workspaceId,
    });

    if (error) {
        throw ApiError.internal("Failed to execute orphan reconciliation", error.message);
    }

    await recordAuthAudit(admin, {
        workspaceId: user.workspaceId,
        actorProfileId: user.profileId,
        action: "reconcile_orphans",
        targetType: "workspace",
        targetId: user.workspaceId,
        correlationId,
        outcome: "success",
        metadata: {
            totalOrphans: data?.total_orphans ?? 0,
        },
    });

    return c.json({ success: true, report: data });
});

// ─── Current User Profile (/me) ───────────────────────────────────────────────
authRouter.get("/me", authMiddleware, async (c) => {
    const user = c.get("user");
    const admin = getAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("id, role, email, workspace_id, approval_status, must_change_password")
        .eq("id", user.profileId)
        .maybeSingle();

    return c.json({
        user: {
            id: user.profileId,
            ...(user.patientId ? { patientId: user.patientId } : {}),
            role: user.role,
            email: user.email,
            workspaceId: user.workspaceId,
            approvalStatus: profile?.approval_status ?? "approved",
            mustChangePassword: Boolean(profile?.must_change_password ?? user.mustChangePassword),
        },
    });
});

// ─── Settings (/me/settings) ──────────────────────────────────────────────────
authRouter.get("/me/settings", authMiddleware, async (c) => {
    const user = c.get("user");
    const { data, error } = await getAdminClient()
        .from("profiles")
        .select("preferences")
        .eq("id", user.profileId)
        .single();
    if (error) throw ApiError.internal("Failed to retrieve settings", error.message);
    return c.json({ settings: data?.preferences ?? {} });
});

authRouter.put("/me/settings", authMiddleware, async (c) => {
    const user = c.get("user");
    const preferences = preferencesSchema.parse(await c.req.json());
    const { data, error } = await getAdminClient()
        .from("profiles")
        .update({ preferences })
        .eq("id", user.profileId)
        .select("preferences")
        .single();
    if (error) throw ApiError.internal("Failed to save settings", error.message);
    return c.json({ success: true, settings: data.preferences });
});
