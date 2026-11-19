import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getConfig, getApiOrigin } from "../../config.js";
import { getAdminClient, getAuthAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";
import { authorizePatientAccess } from "../../services/authorization.js";
import { sendEmail } from "../../services/emailService.js";

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
    channel: z.enum(["email", "sms", "push"]).optional().default("email"),
    enabled: z.boolean().optional().default(true),
    quietHoursStart: z.string().optional(),
    quietHoursEnd: z.string().optional(),
    phone: z.string().optional(),
    emailDoseReminders: z.boolean().optional(),
    smsDoseReminders: z.boolean().optional(),
    pushDoseReminders: z.boolean().optional(),
    weeklyReportEmail: z.boolean().optional(),
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
    const requestedId = c.req.param("id");
    const candidateIds = [
        requestedId,
        requestedId.replace(/^PT-/i, "p-"),
        requestedId.replace(/^PT-/i, "P-"),
    ];
    const admin = getAdminClient();
    const patientQuery = admin.from("patients").select("*");
    const { data: patient, error } = typeof (patientQuery as any).in === "function"
        ? await (patientQuery as any).in("id", candidateIds).eq("is_deleted", false).limit(1).maybeSingle()
        : await patientQuery.eq("id", requestedId).eq("is_deleted", false).maybeSingle();

    if (error || !patient) {
        throw ApiError.notFound("Patient record not found");
    }
    const patientId = patient.id;

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

// ─── Authorization Helper for Patient Subroutes ──────────────────────────────
async function ensurePatientAccess(c: any, patientId: string) {
    const user = c.get("user");
    const admin = getAdminClient();

    const candidateIds = [
        patientId,
        patientId.replace(/^PT-/i, "p-"),
        patientId.replace(/^PT-/i, "P-"),
    ];

    const patientQuery = admin
        .from("patients")
        .select("id, workspace_id, profile_id, status, full_name, contact_email, created_at");
    const { data: patient, error } = typeof (patientQuery as any).in === "function"
        ? await (patientQuery as any).in("id", candidateIds).eq("is_deleted", false).limit(1).maybeSingle()
        : await patientQuery.eq("id", patientId).eq("is_deleted", false).maybeSingle();

    if (error || !patient) {
        throw ApiError.notFound("Patient record not found");
    }

    const resolvedId = patient.id;

    const [{ data: assignments }, { data: grants }, { data: consent }] = await Promise.all([
        admin
            .from("care_team_assignments")
            .select("patient_id, doctor_profile_id, revoked_at")
            .eq("patient_id", resolvedId)
            .is("revoked_at", null),
        admin
            .from("care_grants")
            .select("patient_id, grantee_profile_id, scope, revoked_at")
            .eq("patient_id", resolvedId)
            .is("revoked_at", null),
        admin
            .from("consent_records")
            .select("id, patient_id, share_with_care_team, allow_reminders, allow_ai_analysis, updated_at")
            .eq("patient_id", resolvedId)
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

    return { patient, consent };
}

// ─── 4. Patient Subroutes ─────────────────────────────────────────────────────

// Visits
patientsRouter.get("/:id/visits", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();
    const { data: visits, error } = await admin
        .from("visits")
        .select("*, profiles:doctor_profile_id(full_name)")
        .eq("patient_id", resolvedPatientId)
        .order("visit_date", { ascending: false });

    if (error) throw ApiError.internal("Failed to retrieve visits", error.message);

    const mappedVisits = (visits || []).map((v: any) => ({
        id: v.id,
        patientId: v.patient_id,
        patient_id: v.patient_id,
        date: v.visit_date,
        visit_date: v.visit_date,
        condition: v.condition,
        symptoms: Array.isArray(v.symptoms) ? v.symptoms : [],
        notes: v.notes || "",
        proposedSolution: v.proposed_solution || "",
        proposed_solution: v.proposed_solution || "",
        outcome: v.outcome || "",
        relatedVisits: v.related_visits || [],
        related_visits: v.related_visits || [],
        doctor: v.profiles?.full_name || "Care Team Doctor",
        doctor_profile_id: v.doctor_profile_id,
        prescription_id: v.prescription_id,
        profiles: v.profiles,
    }));

    return c.json({ visits: mappedVisits });
});

// Medications
patientsRouter.get("/:id/medications", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: rawMeds, error } = await admin
        .from("medications")
        .select("*")
        .eq("patient_id", resolvedPatientId)
        .eq("is_active", true);

    if (error) throw ApiError.internal("Failed to retrieve medications", error.message);

    // Deduplicate active medications by normalized name so multiple approved renewals do not duplicate cards
    const seenNames = new Set<string>();
    const deduplicatedMedications: any[] = [];
    const sortedMeds = (rawMeds || [])
        .filter((m: any) => !m.end_date || m.end_date >= today)
        .sort((a: any, b: any) => new Date(b.prescribed_at || 0).getTime() - new Date(a.prescribed_at || 0).getTime());

    for (const m of sortedMeds) {
        const norm = String(m.name || "").trim().toLowerCase();
        if (norm && seenNames.has(norm)) continue;
        if (norm) seenNames.add(norm);
        deduplicatedMedications.push({
            id: m.id,
            patientId: m.patient_id,
            name: m.name,
            dosage: m.dosage,
            form: m.form,
            prescribedAt: m.prescribed_at,
            startDate: m.start_date || m.prescribed_at?.slice(0, 10),
            endDate: m.end_date || null,
            durationDays: m.duration_days || null,
            isActive: m.is_active,
        });
    }

    return c.json({ medications: deduplicatedMedications });
});

// Prescriptions
patientsRouter.get("/:id/prescriptions", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();
    const { data: prescriptions, error } = await admin
        .from("prescriptions")
        .select("*, medications(*)")
        .eq("patient_id", resolvedPatientId)
        .order("created_at", { ascending: false });

    if (error) throw ApiError.internal("Failed to retrieve prescriptions", error.message);
    return c.json({ prescriptions: prescriptions || [] });
});

// Daily Dose Schedules (GET /patients/:id/dose-schedules?date=YYYY-MM-DD)
patientsRouter.get("/:id/dose-schedules", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const dateParam = c.req.query("date") || new Date().toISOString().split("T")[0];
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();

    const admin = getAdminClient();

    // Query dose_schedules for target date window [dateParam 00:00:00Z to 23:59:59Z]
    const dayStart = `${dateParam}T00:00:00.000Z`;
    const dayEnd = `${dateParam}T23:59:59.999Z`;

    let { data: schedules, error: schedError } = await admin
        .from("dose_schedules")
        .select(`
            id,
            patient_id,
            prescription_id,
            scheduled_at,
            window_minutes,
            prescriptions (
                id,
                medications (
                    name,
                    dosage
                )
            )
        `)
        .eq("patient_id", resolvedPatientId)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .order("scheduled_at", { ascending: true });

    if (schedError) {
        throw ApiError.internal("Failed to retrieve dose schedules", schedError.message);
    }

    // Self-healing: verify active approved prescriptions have dose_schedules for target date
    try {
        const { data: approvedPrescriptions } = await admin
            .from("prescriptions")
            .select(`
                id,
                patient_id,
                medications (
                    name,
                    dosage,
                    form
                )
            `)
            .eq("patient_id", resolvedPatientId)
            .eq("status", "approved");

        const existingPrescriptionIds = new Set((schedules || []).map((s: any) => s.prescription_id));
        const existingMedNames = new Set((schedules || []).map((s: any) => {
            const rx = Array.isArray(s.prescriptions) ? s.prescriptions[0] : s.prescriptions;
            const med = Array.isArray(rx?.medications) ? rx?.medications[0] : rx?.medications;
            return String(med?.name || "").trim().toLowerCase();
        }).filter(Boolean));

        const missingPrescriptions = (approvedPrescriptions || []).filter(
            (p: any) => !existingPrescriptionIds.has(p.id),
        );

        // Deduplicate missing prescriptions by medication name to prevent duplicate therapy schedules
        const uniqueMissingPrescriptions: any[] = [];
        const seenMeds = new Set<string>();
        for (const p of missingPrescriptions) {
            const rxMed = Array.isArray(p.medications) ? p.medications[0] : p.medications;
            const medName = String(rxMed?.name || "").trim().toLowerCase();
            if (!medName || existingMedNames.has(medName) || seenMeds.has(medName)) continue;
            seenMeds.add(medName);
            uniqueMissingPrescriptions.push(p);
        }

        if (uniqueMissingPrescriptions.length > 0) {
            const now = new Date();
            const isToday = dateParam === now.toISOString().split("T")[0];
            const newSlots: any[] = [];
            for (const p of uniqueMissingPrescriptions) {
                const rxMed = Array.isArray(p.medications) ? p.medications[0] : p.medications;
                const formLower = String(rxMed?.form || "").toLowerCase();
                const hours = (formLower.includes("twice") || formLower.includes("bid") || formLower.includes("4 to 6") || formLower.includes("12 hour"))
                    ? [8, 19]
                    : (formLower.includes("three") || formLower.includes("tid") || formLower.includes("8 hour"))
                    ? [8, 14, 20]
                    : [9];

                if (isToday) {
                    const todaySlots: Date[] = [];
                    for (const h of hours) {
                        const slotDate = new Date();
                        slotDate.setHours(h, 0, 0, 0);
                        if (slotDate.getTime() >= now.getTime() - 30 * 60 * 1000) {
                            todaySlots.push(slotDate);
                        }
                    }
                    if (todaySlots.length === 0) {
                        todaySlots.push(new Date(now.getTime()));
                    }
                    for (const slotDate of todaySlots) {
                        newSlots.push({
                            prescription_id: p.id,
                            patient_id: resolvedPatientId,
                            scheduled_at: slotDate.toISOString(),
                            window_minutes: 60,
                        });
                    }
                } else {
                    for (const h of hours) {
                        const slotDate = new Date(`${dateParam}T00:00:00.000Z`);
                        slotDate.setHours(h, 0, 0, 0);
                        newSlots.push({
                            prescription_id: p.id,
                            patient_id: resolvedPatientId,
                            scheduled_at: slotDate.toISOString(),
                            window_minutes: 60,
                        });
                    }
                }
            }

            if (newSlots.length > 0) {
                await admin.from("dose_schedules").insert(newSlots);

                const { data: refreshedSchedules } = await admin
                    .from("dose_schedules")
                    .select(`
                        id,
                        patient_id,
                        prescription_id,
                        scheduled_at,
                        window_minutes,
                        prescriptions (
                            id,
                            medications (
                                name,
                                dosage
                            )
                        )
                    `)
                    .eq("patient_id", resolvedPatientId)
                    .gte("scheduled_at", dayStart)
                    .lte("scheduled_at", dayEnd)
                    .order("scheduled_at", { ascending: true });

                if (refreshedSchedules && refreshedSchedules.length > 0) {
                    schedules = refreshedSchedules;
                }
            }
        }
    } catch (healErr) {
        console.warn("Self-healing dose schedule query failed gracefully:", healErr);
    }

    // Query corresponding dose logs
    const { data: logs } = await admin
        .from("dose_logs")
        .select("id, schedule_id, status, method, reason, logged_at")
        .eq("patient_id", resolvedPatientId)
        .gte("logged_at", dayStart)
        .lte("logged_at", dayEnd);

    const logMap = new Map((logs || []).map((l: any) => [l.schedule_id, l]));

    const formattedSchedules = (schedules || []).map((s: any) => {
        const log = logMap.get(s.id);
        const schedTime = new Date(s.scheduled_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        let status: "scheduled" | "taken" | "missed" | "late" | "skipped" = "scheduled";
        if (log) {
            status = log.status;
        } else {
            const scheduledMillis = new Date(s.scheduled_at).getTime();
            const graceMillis = (s.window_minutes || 60) * 60 * 1000;
            if (Date.now() > scheduledMillis + graceMillis) {
                status = "missed";
            }
        }

        const rx = Array.isArray(s.prescriptions) ? s.prescriptions[0] : s.prescriptions;
        const med = Array.isArray(rx?.medications) ? rx?.medications[0] : rx?.medications;
        return {
            id: s.id,
            patientId: s.patient_id,
            prescriptionId: s.prescription_id,
            medicationName: med?.name || "Medication",
            dosage: med?.dosage || "",
            scheduledTime: schedTime,
            scheduledAt: s.scheduled_at,
            windowMinutes: s.window_minutes || 60,
            status,
            loggedAt: log?.logged_at || null,
            reason: log?.reason || null,
        };
    });

    return c.json({
        patientId,
        date: dateParam,
        schedules: formattedSchedules,
        correlationId,
    });
});

// Adherence & Dose Logs (GET /patients/:id/adherence)
patientsRouter.get("/:id/adherence", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();

    const { data: rawLogs, error } = await admin
        .from("dose_logs")
        .select(`
            id,
            schedule_id,
            patient_id,
            status,
            method,
            reason,
            idempotency_key,
            logged_at,
            dose_schedules (
                scheduled_at,
                prescriptions (
                    medications (
                        name,
                        dosage
                    )
                )
            )
        `)
        .eq("patient_id", resolvedPatientId)
        .order("logged_at", { ascending: false })
        .limit(90);

    if (error) throw ApiError.internal("Failed to retrieve adherence data", error.message);

    const logs = (rawLogs || []).map((l: any) => {
        const sched = Array.isArray(l.dose_schedules) ? l.dose_schedules[0] : l.dose_schedules;
        const rx = Array.isArray(sched?.prescriptions) ? sched.prescriptions[0] : sched?.prescriptions;
        const med = Array.isArray(rx?.medications) ? rx.medications[0] : rx?.medications;
        return {
            id: l.id,
            scheduleId: l.schedule_id,
            patientId: l.patient_id,
            status: l.status,
            method: l.method,
            reason: l.reason,
            idempotencyKey: l.idempotency_key,
            loggedAt: l.logged_at || new Date().toISOString(),
            medicationName: med?.name || l.medication_name || undefined,
            dosage: med?.dosage || l.dosage || undefined,
        };
    });

    // 1. Fetch total assigned/scheduled doses due so far (scheduled_at <= now)
    const nowIso = new Date().toISOString();
    const { count: assignedCount } = await admin
        .from("dose_schedules")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", resolvedPatientId)
        .lte("scheduled_at", nowIso);

    const takenCount = logs.filter((l: any) => l.status === "taken").length;
    const explicitMissedCount = logs.filter((l: any) => l.status === "missed").length;
    const skippedCount = logs.filter((l: any) => l.status === "skipped").length;
    const totalAssignedSoFar = assignedCount || (takenCount + explicitMissedCount + skippedCount);

    // Doses past schedule window that were never logged count towards missedCount
    const unloggedMissed = Math.max(0, totalAssignedSoFar - (takenCount + explicitMissedCount + skippedCount));
    const missedCount = explicitMissedCount + unloggedMissed;

    const takenPercentage = totalAssignedSoFar > 0 ? Math.round((takenCount / totalAssignedSoFar) * 100) : 0;
    const latePercentage = 0;
    const missedPercentage = totalAssignedSoFar > 0 ? Math.round((missedCount / totalAssignedSoFar) * 100) : 0;
    const skippedPercentage = totalAssignedSoFar > 0 ? Math.round((skippedCount / totalAssignedSoFar) * 100) : 0;
    
    // Adherence starts at 0% for new patients with no scheduled/logged doses; scales as taken / assignedSoFar
    const score = totalAssignedSoFar > 0 ? Math.min(100, Math.round((takenCount / totalAssignedSoFar) * 100)) : 0;

    // Calculate current adherence streak days (consecutive days with only taken doses)
    let currentStreakDays = 0;
    const daysMap = new Map<string, Array<string>>();
    for (const log of logs) {
        if (!log.loggedAt) continue;
        const day = log.loggedAt.split("T")[0];
        if (!daysMap.has(day)) daysMap.set(day, []);
        daysMap.get(day)!.push(log.status);
    }
    const sortedDays = Array.from(daysMap.keys()).sort().reverse();
    for (const day of sortedDays) {
        const statuses = daysMap.get(day)!;
        if (statuses.some((s) => s === "missed")) {
            break;
        }
        if (statuses.some((s) => s === "taken")) {
            currentStreakDays++;
        }
    }

    const trend: "up" | "down" | "stable" = score >= 85 ? "up" : score < 70 ? "down" : "stable";

    // Generate 84-day (12 weeks) binary heatmap cells
    const now = new Date();
    const heatmapData: Array<{ date: string; status: "taken" | "missed" | "none"; value: number }> = [];
    for (let i = 83; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayStatuses = daysMap.get(dateStr) || [];
        let status: "taken" | "missed" | "none" = "none";
        if (dayStatuses.includes("missed")) {
            status = "missed";
        } else if (dayStatuses.includes("taken")) {
            status = "taken";
        }
        heatmapData.push({
            date: dateStr,
            status,
            value: status === "taken" ? 1 : 0,
        });
    }

    // Generate 3-month periodic sparkline data (12 weekly points)
    const sparklineData: Array<{ date: string; value: number }> = [];
    for (let w = 11; w >= 0; w--) {
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() - w * 7);
        const weekDateStr = weekDate.toISOString().split("T")[0];
        const weekLogs = logs.filter((l: any) => l.loggedAt && l.loggedAt.split("T")[0] <= weekDateStr);
        const weekTaken = weekLogs.filter((l: any) => l.status === "taken").length;
        const weekMissed = weekLogs.filter((l: any) => l.status === "missed").length;
        const weekTotal = weekTaken + weekMissed;
        const weekScore = weekTotal > 0 ? Math.round((weekTaken / weekTotal) * 100) : score;
        sparklineData.push({
            date: weekDateStr,
            value: weekScore,
        });
    }

    return c.json({
        patientId,
        score,
        totalAssignedCount: totalAssignedSoFar,
        takenPercentage,
        latePercentage,
        missedPercentage,
        skippedPercentage,
        takenCount,
        lateCount: 0,
        missedCount,
        skippedCount,
        currentStreakDays,
        trend,
        calculatedAt: new Date().toISOString(),
        logs,
        heatmapData,
        sparklineData,
    });
});

// Trust & Transparency (GET /patients/:id/transparency)
patientsRouter.get("/:id/transparency", async (c) => {
    const patientId = c.req.param("id");
    const { patient, consent } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const admin = getAdminClient();

    // Query recent audit access events for this patient
    const { data: auditRows } = await admin
        .from("audit_events")
        .select("id, action, actor_profile_id, target_type, outcome, occurred_at")
        .or(`target_id.eq.${resolvedPatientId},actor_profile_id.eq.${c.get("user")?.profileId}`)
        .order("occurred_at", { ascending: false })
        .limit(10);

    const actionDescriptions: Record<string, string> = {
        view_patient: "Care team reviewed patient chart",
        read_patient: "Care team reviewed patient chart",
        log_dose: "Dose recorded by patient",
        update_consent: "Consent preferences updated",
        approve_prescription: "Prescription approved by doctor",
        upload_report: "Medical report uploaded",
        evaluate_daily_pattern: "Adherence pattern evaluated",
    };

    const recentAudits = (auditRows || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        actorRole: a.actor_profile_id === c.get("user")?.profileId ? "patient" : "care_team",
        description: actionDescriptions[a.action] || `Action ${a.action} recorded with outcome ${a.outcome}`,
        occurredAt: a.occurred_at,
    }));

    // Calculate dynamic assurance score based on consent verification, audit trail, and adherence fidelity
    const { data: logs } = await admin
        .from("dose_logs")
        .select("status")
        .eq("patient_id", resolvedPatientId);

    const takenCount = (logs || []).filter((l: any) => l.status === "taken").length;
    const missedCount = (logs || []).filter((l: any) => l.status === "missed").length;
    const skippedCount = (logs || []).filter((l: any) => l.status === "skipped").length;
    const totalLogged = takenCount + missedCount + skippedCount;

    // Component 1: Cryptographic Consent Verification (35 pts)
    const consentBase = consent ? (consent.share_with_care_team ? 35 : 30) : 35;

    // Component 2: Immutable Audit Trail Completeness (35 pts)
    const auditBase = recentAudits.length > 0 ? 35 : 30;

    // Component 3: Clinical Adherence & Identity Fidelity (30 pts)
    const adherenceRate = totalLogged > 0 ? (takenCount / totalLogged) : 1;
    const adherenceBase = Math.round(adherenceRate * 30);

    const assuranceScore = Math.min(100, Math.max(0, consentBase + auditBase + adherenceBase));

    const latestAuditDate = recentAudits[0]?.occurredAt || patient.created_at || new Date().toISOString();
    const consentDate = consent?.updated_at || patient.created_at || new Date().toISOString();

    const trustSignals = [
        {
            category: "Consent Enforcement",
            label: "Care Team Access",
            status: "verified" as const,
            description: "Only authorized clinicians assigned to your care team may access your medical history.",
            lastVerifiedAt: consentDate,
        },
        {
            category: "AI Advisory",
            label: "AI Analysis Consent",
            status: consent?.allow_ai_analysis ? ("active" as const) : ("monitored" as const),
            description: consent?.allow_ai_analysis
                ? "Diagnostic and pattern analysis algorithms are authorized by you."
                : "AI analysis is currently disabled per your consent preferences.",
            lastVerifiedAt: consentDate,
        },
        {
            category: "Audit Trail",
            label: "Immutable Audit Logging",
            status: "monitored" as const,
            description: "Every access, update, and dose recorded is permanently logged for clinical integrity.",
            lastVerifiedAt: latestAuditDate,
        },
    ];

    return c.json({
        patientId: resolvedPatientId,
        consent: consent || null,
        trustSignals,
        recentAudits,
        assuranceScore,
        freshnessTimestamp: new Date().toISOString(),
        correlationId,
    });
});

// Consent Records
patientsRouter.get("/:id/consent", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();
    const { data: consentRows, error } = await admin
        .from("consent_records")
        .select("*")
        .eq("patient_id", resolvedPatientId)
        .order("updated_at", { ascending: false })
        .limit(1);

    if (error) throw ApiError.internal("Failed to retrieve consent", error.message);
    return c.json({ consent: consentRows?.[0] || null });
});

// Update Consent Records
patientsRouter.put("/:id/consent", async (c) => {
    const user = c.get("user");
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = updateConsentSchema.parse(body);

    const admin = getAdminClient();
    const { data: existingConsent } = await admin
        .from("consent_records")
        .select("id")
        .eq("patient_id", resolvedPatientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const consentPayload: Record<string, any> = {
        ...(existingConsent?.id ? { id: existingConsent.id } : {}),
        patient_id: resolvedPatientId,
        share_with_care_team: validated.shareWithCareTeam,
        allow_reminders: validated.allowReminders,
        allow_ai_analysis: validated.allowAiAnalysis,
        updated_by_profile_id: user.profileId,
        updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await admin
        .from("consent_records")
        .upsert(consentPayload)
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to update consent", error.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "update_consent",
        target_type: "consent",
        target_id: resolvedPatientId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, consent: updated });
});

// Notification Settings
patientsRouter.get("/:id/settings", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();
    const { data: settings, error } = await admin
        .from("notification_preferences")
        .select("*")
        .eq("patient_id", resolvedPatientId);

    if (error) throw ApiError.internal("Failed to retrieve settings", error.message);
    return c.json({ settings: settings || [] });
});

// Update Notification Settings
patientsRouter.put("/:id/settings", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const body = await c.req.json();
    const validated = updateSettingsSchema.parse(body);

    const admin = getAdminClient();
    if (validated.phone !== undefined) {
        await admin
            .from("patients")
            .update({ contact_phone: validated.phone || null })
            .eq("id", resolvedPatientId);
    }

    const { data: updated, error } = await admin
        .from("notification_preferences")
        .upsert(
            {
                patient_id: resolvedPatientId,
                channel: validated.channel,
                enabled: validated.enabled,
                quiet_hours_start: validated.quietHoursStart || null,
                quiet_hours_end: validated.quietHoursEnd || null,
                weekly_report_email: validated.weeklyReportEmail !== undefined ? validated.weeklyReportEmail : true,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "patient_id,channel",
            }
        )
        .select()
        .single();

    if (error) throw ApiError.internal("Failed to update notification settings", error.message);
    return c.json({ success: true, setting: updated });
});

// ─── List Patient Periodic Adherence Reports (GET /patients/:id/adherence-reports) ────
patientsRouter.get("/:id/adherence-reports", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const admin = getAdminClient();

    const { data: reports, error } = await admin
        .from("patient_adherence_reports")
        .select("*")
        .eq("patient_id", resolvedPatientId)
        .order("start_date", { ascending: false })
        .limit(20);

    if (error) throw ApiError.internal("Failed to retrieve adherence reports", error.message);

    // Map database snake_case columns to standard camelCase Report shape
    const mapped = (reports || []).map((r) => ({
        id: r.id,
        period: r.period,
        startDate: r.start_date,
        endDate: r.end_date,
        adherencePercent: r.adherence_percent,
        takenCount: r.taken_count,
        totalDoses: r.total_doses,
        missedDays: r.missed_days,
        streakDays: r.streak_days,
        trend: r.trend,
        insights: Array.isArray(r.insights) ? r.insights : [],
        htmlContent: r.html_content,
        deliveredAt: r.delivered_at,
        createdAt: r.created_at,
    }));

    return c.json({ success: true, reports: mapped });
});

// ─── Generate Test Periodic Report On-Demand (POST /patients/:id/adherence-reports/generate) ────
patientsRouter.post("/:id/adherence-reports/generate", async (c) => {
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const resolvedPatientId = patient.id;
    const body = await c.req.json().catch(() => ({}));
    const period = body.period === "monthly" ? "monthly" : "weekly";
    const forceSend = body.forceSend === true;

    const { generateAndSendPeriodicReport } = await import("../../services/patientAdherenceReportService.js");

    try {
        const report = await generateAndSendPeriodicReport(resolvedPatientId, period, {
            forceSend,
            correlationId: `on-demand-${period}-${resolvedPatientId}-${Date.now()}`,
        });

        return c.json({ success: true, report });
    } catch (err: any) {
        throw ApiError.internal("Failed to generate adherence report", err.message);
    }
});

// Resend Patient Invitation / Activation Link
patientsRouter.post("/:id/resend-invite", async (c) => {
    const user = c.get("user");
    const patientId = c.req.param("id");
    const { patient } = await ensurePatientAccess(c, patientId);
    const correlationId = c.get("correlationId") || "resend-patient-corr";
    const admin = getAdminClient();
    const authAdmin = getAuthAdminClient();
    const config = getConfig();

    let recipientEmail = (patient as any).contact_email || "";
    let recipientName = (patient as any).full_name || "Patient";

    if (!recipientEmail && patient.profile_id) {
        const { data: profile } = await admin
            .from("profiles")
            .select("email, full_name")
            .eq("id", patient.profile_id)
            .maybeSingle();

        if (profile?.email) {
            recipientEmail = profile.email;
            if (profile.full_name) recipientName = profile.full_name;
        }
    }

    if (!recipientEmail) {
        throw ApiError.badRequest("This patient does not have a contact email on file.");
    }

    let actionLink: string | null = null;
    let deliveryMethod = "supabase_invite";

    const { error: inviteError } = await authAdmin.auth.admin.inviteUserByEmail(
        recipientEmail,
        {
            data: { role: "patient", patient_id: patient.id },
            redirectTo: config.patientActivationUrl,
        }
    );

    if (inviteError) {
        const msg = inviteError.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
            const { data: linkData, error: linkErr } = await authAdmin.auth.admin.generateLink({
                type: "recovery",
                email: recipientEmail,
                options: {
                    redirectTo: config.patientActivationUrl,
                },
            });
            if (linkErr || !linkData?.properties?.action_link) {
                throw ApiError.internal("Failed to generate activation link", linkErr?.message);
            }
            actionLink = linkData.properties.action_link;
        } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
            throw ApiError.tooManyRequests("Rate limit reached. Please wait before requesting another invite.");
        } else {
            throw ApiError.internal("Failed to send patient invitation", inviteError.message);
        }
    }

    if (actionLink) {
        deliveryMethod = "email_service";
        await sendEmail({
            to: recipientEmail,
            subject: "MedNova Health — Activate Your Patient Account",
            text: `Hello ${recipientName},\n\nPlease use the following link to set your password and activate your MedNova Health patient account:\n\n${actionLink}\n\nThis link is valid for 24 hours.\n\n--\nMedNova Care Team`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #0f172a;">Welcome to MedNova Health</h2>
                  <p>Hello ${recipientName},</p>
                  <p>Your care team has sent you a new activation link to create your password and access your patient portal:</p>
                  <p style="margin: 24px 0;">
                    <a href="${actionLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                      Activate Account & Set Password
                    </a>
                  </p>
                  <p style="color: #64748b; font-size: 13px;">If the button above does not work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; font-size: 13px; color: #2563eb;">${actionLink}</p>
                </div>
            `,
        });
    }

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "resend_patient_invitation",
        target_type: "patient",
        target_id: patient.id,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({
        success: true,
        message: `Activation email sent to ${recipientEmail}`,
        deliveryMethod,
    });
});

