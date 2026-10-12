import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware } from "../../middleware/auth.js";

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

// ─── Login ────────────────────────────────────────────────────────────────────
authRouter.post("/login", async (c) => {
    const body = await c.req.json();
    const { email, password, portal } = loginSchema.parse(body);

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
        .select("id, workspace_id, role, full_name, email")
        .eq("id", authData.user.id)
        .single();

    if (profError || !profile) {
        throw ApiError.unauthorized("Account profile not found");
    }

    const { data: patient } = profile.role === "patient"
        ? await admin.from("patients").select("id").eq("profile_id", profile.id).maybeSingle()
        : { data: null };

    // Role-gating check: reject wrong-portal logins without revealing account details
    if (portal === "doctor" && profile.role === "patient") {
        await admin.auth.signOut();
        throw ApiError.unauthorized("Invalid login credentials for this portal");
    }

    if (portal === "patient" && profile.role !== "patient") {
        await admin.auth.signOut();
        throw ApiError.unauthorized("Invalid login credentials for this portal");
    }

    return c.json({
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        user: {
            id: profile.id,
            ...(patient ? { patientId: patient.id } : {}),
            role: profile.role,
            fullName: profile.full_name,
            email: profile.email,
            workspaceId: profile.workspace_id,
        },
    });
});

// ─── Sign Out ─────────────────────────────────────────────────────────────────
authRouter.post("/logout", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const admin = getAdminClient();
        await admin.auth.admin.signOut(token).catch(() => {});
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

// ─── Current User Profile (/me) ───────────────────────────────────────────────
authRouter.get("/me", authMiddleware, async (c) => {
    const user = c.get("user");
    return c.json({
        user: {
            id: user.profileId,
            role: user.role,
            email: user.email,
            workspaceId: user.workspaceId,
        },
    });

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
});
