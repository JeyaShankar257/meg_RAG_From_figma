import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getConfig, getApiOrigin } from "../../config.js";
import { getAdminClient, getAuthAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";
import { authorizePatientAccess } from "../../services/authorization.js";

export const patientsRouter = new Hono();

// All patient endpoints require authenticated session
patientsRouter.use("*", authMiddleware);

const createPatientSchema = z.object({
    fullName: z.string().min(2, "Full name is required"),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
    contactEmail: z.string().email("Valid email required"),
    contactPhone: z.string().optional(),
    conditions: z.array(z.string()).optional(),
    consent: z
        .object({
            shareWithCareTeam: z.boolean().default(false),
            allowReminders: z.boolean().default(true),
            allowAiAnalysis: z.boolean().default(false),
        })
        .optional(),
});

const updateConsentSchema = z.object({
    shareWithCareTeam: z.boolean(),
    allowReminders: z.boolean(),
    allowAiAnalysis: z.boolean(),
});

const updateSettingsSchema = z.object({
    channel: z.enum(["email", "sms", "push"]),
    enabled: z.boolean(),
    quietHoursStart: z.string().optional(),
    quietHoursEnd: z.string().optional(),
});

// ─── 1. List Patients (GET /patients) ─────────────────────────────────────────
patientsRouter.get("/", async (c) => {
    const user = c.get("user");
    const admin = getAdminClient();

    let query = admin
        .from("patients")
        .select(`
            id,
            workspace_id,
            profile_id,
            status,
            full_name,
            date_of_birth,
            contact_email,
            contact_phone,
            created_at,
            updated_at,
            care_team_assignments!inner(doctor_profile_id, revoked_at)
        `)
        .eq("workspace_id", user.workspaceId)
        .eq("is_deleted", false);

    if (user.role === "doctor") {
        query = query
            .eq("care_team_assignments.doctor_profile_id", user.profileId)
            .is("care_team_assignments.revoked_at", null);
    } else if (user.role === "patient") {
        query = admin
            .from("patients")
            .select("*")
            .eq("workspace_id", user.workspaceId)
            .eq("profile_id", user.profileId)
            .eq("is_deleted", false);
    }

    const { data: patients, error } = await query;
    if (error) {
        throw ApiError.internal("Failed to retrieve patients", error.message);
    }

    return c.json({ patients: patients || [] });
});

// ─── 2. Get Patient Details (GET /patients/:id) ──────────────────────────────
patientsRouter.get("/:id", async (c) => {
    const user = c.get("user");
    const patientId = c.req.param("id");
    const admin = getAdminClient();

    const { data: patient, error } = await admin
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .eq("is_deleted", false)
        .single();

    if (error || !patient) {
        throw ApiError.notFound("Patient record not found");
    }

    // Load active assignments, grants, and consent for authorization check
    const [{ data: assignments }, { data: grants }, { data: consent }] = await Promise.all([
        admin
            .from("care_team_assignments")
            .select("patient_id, doctor_profile_id, revoked_at")
            .eq("patient_id", patientId)
            .is("revoked_at", null),
        admin
            .from("care_grants")
            .select("patient_id, grantee_profile_id, scope, revoked_at")
            .eq("patient_id", patientId)
            .is("revoked_at", null),
        admin
            .from("consent_records")
            .select("patient_id, share_with_care_team, allow_reminders, allow_ai_analysis")
            .eq("patient_id", patientId)
            .maybeSingle(),
    ]);

    const authCheck = authorizePatientAccess({
        user,
        patient: {
            id: patient.id,
            workspaceId: patient.workspace_id,
            profileId: patient.profile_id,
        },
        assignments: (assignments || []).map((a) => ({
            patientId: a.patient_id,
            doctorProfileId: a.doctor_profile_id,
            revokedAt: a.revoked_at,
        })),
        grants: (grants || []).map((g) => ({
            patientId: g.patient_id,
            granteeProfileId: g.grantee_profile_id,
            scope: g.scope,
            revokedAt: g.revoked_at,
        })),
        consent: consent
            ? {
                  patientId: consent.patient_id,
                  shareWithCareTeam: consent.share_with_care_team,
                  allowReminders: consent.allow_reminders,
                  allowAiAnalysis: consent.allow_ai_analysis,
              }
            : null,
    });

    if (!authCheck.authorized) {
        throw ApiError.forbidden(authCheck.reason);
    }

    // Load related conditions and visits
    const [{ data: conditions }, { data: visits }] = await Promise.all([
        admin.from("conditions").select("*").eq("patient_id", patientId),
        admin.from("visits").select("*").eq("patient_id", patientId).order("visit_date", { ascending: false }),
    ]);

    return c.json({
        patient: {
            ...patient,
            conditions: conditions || [],
            visits: visits || [],
            consent: consent || null,
        },
    });
});

// ─── 3. Create Patient (POST /patients) ───────────────────────────────────────
// Task 3.3: Server-generated patient ID, pending state, assignment, consent, activation email job
patientsRouter.post("/", requireRole("doctor", "admin"), async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = createPatientSchema.parse(body);

    const admin = getAdminClient();
    const authAdmin = getAuthAdminClient();

    // 1. Generate patient record (ID is auto-generated by database sequence/default)
    const { data: newPatient, error: patError } = await admin
        .from("patients")
        .insert({
            workspace_id: user.workspaceId,
            profile_id: null, // Pending activation until patient signs up
            status: "pending",
            full_name: validated.fullName,
            date_of_birth: validated.dateOfBirth,
            contact_email: validated.contactEmail,
            contact_phone: validated.contactPhone || null,
        })
        .select()
        .single();

    if (patError || !newPatient) {
        throw ApiError.internal("Failed to create patient record", patError?.message);
    }

    const patientId = newPatient.id;

    // 2. Assign creating doctor to patient
    if (user.role === "doctor") {
        await admin.from("care_team_assignments").insert({
            patient_id: patientId,
            doctor_profile_id: user.profileId,
        });
    }

    // 3. Set initial consent
    const consentValues = validated.consent || {
        shareWithCareTeam: false,
        allowReminders: true,
        allowAiAnalysis: false,
    };
    await admin.from("consent_records").insert({
        patient_id: patientId,
        share_with_care_team: consentValues.shareWithCareTeam,
        allow_reminders: consentValues.allowReminders,
        allow_ai_analysis: consentValues.allowAiAnalysis,
        updated_by_profile_id: user.profileId,
    });

    // 4. Insert conditions if provided
    if (validated.conditions && validated.conditions.length > 0) {
        const conditionRows = validated.conditions.map((name) => ({
            patient_id: patientId,
            name,
            diagnosed_at: new Date().toISOString().split("T")[0],
        }));
        await admin.from("conditions").insert(conditionRows);
    }

    // 5. Create an invitation-only Supabase Auth account.
    const config = getConfig();
    const { data: invitation, error: invitationError } =
        await authAdmin.auth.admin.inviteUserByEmail(validated.contactEmail, {
            data: { role: "patient", patient_id: patientId },
            redirectTo: config.patientActivationUrl,
        });

    if (invitationError || !invitation.user) {
        // Rollback patient records created in steps 1-4 so incomplete identities are not orphaned
        try {
            await admin.from("consent_records").delete().eq("patient_id", patientId);
            await admin.from("conditions").delete().eq("patient_id", patientId);
            await admin.from("care_team_assignments").delete().eq("patient_id", patientId);
            await admin.from("patients").delete().eq("id", patientId);
            await admin.from("audit_events").insert({
                workspace_id: user.workspaceId,
                actor_profile_id: user.profileId,
                action: "create_patient",
                target_type: "patient",
                target_id: patientId,
                correlation_id: correlationId,
                outcome: "error",
            });
        } catch {
            // Best-effort rollback
        }

        const invitationMessage = invitationError?.message ?? "Supabase did not return an invited user";
        const normalizedMessage = invitationMessage.toLowerCase();
        if (
            normalizedMessage.includes("rate limit") ||
            normalizedMessage.includes("too many requests")
        ) {
            throw ApiError.tooManyRequests(
                "Supabase invitation email rate limit exceeded. Wait before sending another invitation.",
            );
        }
        if (
            normalizedMessage.includes("already registered") ||
            normalizedMessage.includes("already exists") ||
            normalizedMessage.includes("user already")
        ) {
            throw ApiError.conflict(
                "A Supabase Auth account already exists for this patient email. Use a new email or recover the existing account.",
            );
        }
        if (
            normalizedMessage.includes("user not allowed") ||
            normalizedMessage.includes("not authorized") ||
            normalizedMessage.includes("service_role")
        ) {
            throw ApiError.internal(
                "The API Supabase server key cannot create invitations. Update SUPABASE_SERVICE_ROLE_KEY and restart the API.",
                invitationMessage,
            );
        }
        throw ApiError.internal("Failed to send patient invitation", invitationMessage);
    }

    const { error: profileError } = await admin.rpc("provision_invited_profile", {
        p_id: invitation.user.id,
        p_workspace_id: user.workspaceId,
        p_role: "patient",
        p_full_name: validated.fullName,
        p_email: validated.contactEmail,
        p_approval_status: "approved",
        p_invited_by_profile_id: user.profileId,
    });
    if (profileError) {
        // Quarantine / cleanup incomplete Auth user and clinical record
        try {
            await authAdmin.auth.admin.deleteUser(invitation.user.id);
            await admin.from("consent_records").delete().eq("patient_id", patientId);
            await admin.from("conditions").delete().eq("patient_id", patientId);
            await admin.from("care_team_assignments").delete().eq("patient_id", patientId);
            await admin.from("patients").delete().eq("id", patientId);
            await admin.from("audit_events").insert({
                workspace_id: user.workspaceId,
                actor_profile_id: user.profileId,
                action: "create_patient",
                target_type: "patient",
                target_id: patientId,
                correlation_id: correlationId,
                outcome: "error",
            });
        } catch {
            // Best-effort cleanup
        }

        throw ApiError.internal("Failed to create invited patient profile", profileError.message);
    }

    const { error: linkError } = await admin
        .from("patients")
        .update({ profile_id: invitation.user.id })
        .eq("id", patientId);
    if (linkError) {
        try {
            await authAdmin.auth.admin.deleteUser(invitation.user.id);
            await admin.from("profiles").delete().eq("id", invitation.user.id);
            await admin.from("patients").delete().eq("id", patientId);
            await admin.from("audit_events").insert({
                workspace_id: user.workspaceId,
                actor_profile_id: user.profileId,
                action: "create_patient",
                target_type: "patient",
                target_id: patientId,
                correlation_id: correlationId,
                outcome: "error",
            });
        } catch {
            // Best-effort cleanup
        }

        throw ApiError.internal("Failed to link invited patient account", linkError.message);
    }

    // 6. Record immutable audit event
    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "create_patient",
        target_type: "patient",
        target_id: patientId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json(
        {
            success: true,
            patient: newPatient,
            message: "Patient created and invitation email sent",
        },
        201,
    );
});

// ─── 4. Patient Subroutes ─────────────────────────────────────────────────────

// Visits
patientsRouter.get("/:id/visits", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: visits, error } = await admin
        .from("visits")
        .select("*")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

    if (error) throw ApiError.internal("Failed to retrieve visits", error.message);
    return c.json({ visits: visits || [] });
});

// Medications
patientsRouter.get("/:id/medications", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: medications, error } = await admin
        .from("medications")
        .select("*")
        .eq("patient_id", patientId)
        .eq("is_active", true);

    if (error) throw ApiError.internal("Failed to retrieve medications", error.message);
    return c.json({ medications: medications || [] });
});

// Prescriptions
patientsRouter.get("/:id/prescriptions", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: prescriptions, error } = await admin
        .from("prescriptions")
        .select("*, medications(*)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

    if (error) throw ApiError.internal("Failed to retrieve prescriptions", error.message);
    return c.json({ prescriptions: prescriptions || [] });
});

// Adherence & Dose Logs
patientsRouter.get("/:id/adherence", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: logs, error } = await admin
        .from("dose_logs")
        .select("*")
        .eq("patient_id", patientId)
        .order("logged_at", { ascending: false })
        .limit(90);

    if (error) throw ApiError.internal("Failed to retrieve adherence data", error.message);
    return c.json({ logs: logs || [] });
});

// Consent Records
patientsRouter.get("/:id/consent", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: consentRows, error } = await admin
        .from("consent_records")
        .select("*")
        .eq("patient_id", patientId)
        .order("updated_at", { ascending: false })
        .limit(1);

    if (error) throw ApiError.internal("Failed to retrieve consent", error.message);
    return c.json({ consent: consentRows?.[0] || null });
});

// Update Consent Records
patientsRouter.put("/:id/consent", async (c) => {
    const user = c.get("user");
    const patientId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = updateConsentSchema.parse(body);

    const admin = getAdminClient();
    const { data: updated, error } = await admin
        .from("consent_records")
        .upsert({
            patient_id: patientId,
            share_with_care_team: validated.shareWithCareTeam,
            allow_reminders: validated.allowReminders,
            allow_ai_analysis: validated.allowAiAnalysis,
            updated_by_profile_id: user.profileId,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to update consent", error.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "update_consent",
        target_type: "consent",
        target_id: patientId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, consent: updated });
});

// Notification Settings
patientsRouter.get("/:id/settings", async (c) => {
    const patientId = c.req.param("id");
    const admin = getAdminClient();
    const { data: settings, error } = await admin
        .from("notification_preferences")
        .select("*")
        .eq("patient_id", patientId);

    if (error) throw ApiError.internal("Failed to retrieve settings", error.message);
    return c.json({ settings: settings || [] });
});

// Update Notification Settings
patientsRouter.put("/:id/settings", async (c) => {
    const patientId = c.req.param("id");
    const body = await c.req.json();
    const validated = updateSettingsSchema.parse(body);

    const admin = getAdminClient();
    const { data: updated, error } = await admin
        .from("notification_preferences")
        .upsert({
            patient_id: patientId,
            channel: validated.channel,
            enabled: validated.enabled,
            quiet_hours_start: validated.quietHoursStart || null,
            quiet_hours_end: validated.quietHoursEnd || null,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to update notification settings", error.message);
    return c.json({ success: true, setting: updated });
});
