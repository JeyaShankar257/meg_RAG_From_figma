import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { getConfig } from "../../config.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";
import { authorizePatientAccess } from "../../services/authorization.js";
import type { UserContext } from "../../services/authorization.js";

export const reportsRouter = new Hono();
reportsRouter.use("*", authMiddleware);

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const uploadUrlSchema = z.object({
    patientId: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().refine((m) => ALLOWED_MIME_TYPES.includes(m), {
        message: "File type must be PDF, JPEG, or PNG",
    }),
    sizeBytes: z.number().max(MAX_FILE_SIZE_BYTES, "File size must not exceed 20 MB"),
});

const createReportSchema = z.object({
    patientId: z.string().min(1),
    storagePath: z.string().min(1),
    mimeType: z.string().refine((m) => ALLOWED_MIME_TYPES.includes(m)),
    sizeBytes: z.number().max(MAX_FILE_SIZE_BYTES),
    label: z.string().min(1),
    sharedWithCareTeam: z.boolean().default(false),
});

async function assertReportAccess(user: UserContext, patientId: string, requiredScope = "read_report") {
    const admin = getAdminClient();
    const { data: patient } = await admin
        .from("patients")
        .select("id, workspace_id, profile_id")
        .eq("id", patientId)
        .single();
    if (!patient) throw ApiError.notFound("Patient not found");

    const [{ data: assignments }, { data: grants }, { data: consent }] = await Promise.all([
        admin.from("care_team_assignments").select("*").eq("patient_id", patientId),
        admin.from("care_grants").select("*").eq("patient_id", patientId),
        admin.from("consent_records").select("*").eq("patient_id", patientId).maybeSingle(),
    ]);
    const result = authorizePatientAccess({
        user,
        patient: { id: patient.id, workspaceId: patient.workspace_id, profileId: patient.profile_id },
        assignments: (assignments ?? []).map((assignment) => ({
            patientId: assignment.patient_id,
            doctorProfileId: assignment.doctor_profile_id,
            revokedAt: assignment.revoked_at,
        })),
        grants: (grants ?? []).map((grant) => ({
            patientId: grant.patient_id,
            granteeProfileId: grant.grantee_profile_id,
            scope: grant.scope,
            revokedAt: grant.revoked_at,
        })),
        consent: consent
            ? {
                  patientId,
                  shareWithCareTeam: consent.share_with_care_team,
                  allowReminders: consent.allow_reminders,
                  allowAiAnalysis: consent.allow_ai_analysis,
              }
            : null,
        requiredScope,
    });
    if (!result.authorized) throw ApiError.forbidden(result.reason);
    return patient;
}

// ─── 1. Request Signed Upload URL (POST /reports/upload-url) ──────────────────
reportsRouter.post("/upload-url", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const validated = uploadUrlSchema.parse(body);

    const admin = getAdminClient();
    const config = getConfig();

    await assertReportAccess(user, validated.patientId);

    const sanitizedFileName = validated.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${validated.patientId}/${Date.now()}-${sanitizedFileName}`;

    // Demo mode: return safe mock signed URL if Supabase storage not linked
    if (config.demoMode) {
        return c.json({
            uploadUrl: `https://mock-storage.mednova.clinic/upload/${storagePath}`,
            storagePath,
            expiresInSeconds: config.signedUrlExpirySeconds,
        });
    }

    const { data, error } = await admin.storage
        .from(config.reportsBucketName)
        .createSignedUploadUrl(storagePath);

    if (error || !data) {
        throw ApiError.internal("Failed to generate signed upload URL", error?.message);
    }

    return c.json({
        uploadUrl: data.signedUrl,
        storagePath,
        expiresInSeconds: config.signedUrlExpirySeconds,
    });
});

// ─── 2. Create Report Metadata (POST /reports) ────────────────────────────────
reportsRouter.post("/", async (c) => {
    const user = c.get("user");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json();
    const validated = createReportSchema.parse(body);

    const admin = getAdminClient();
    await assertReportAccess(user, validated.patientId);
    if (!validated.storagePath.startsWith(`${validated.patientId}/`)) {
        throw ApiError.badRequest("storagePath must belong to the authorized patient");
    }

    // Store only metadata in Postgres — never base64
    const { data: report, error } = await admin
        .from("patient_reports")
        .insert({
            patient_id: validated.patientId,
            uploader_profile_id: user.profileId,
            storage_path: validated.storagePath,
            mime_type: validated.mimeType,
            size_bytes: validated.sizeBytes,
            label: validated.label,
            review_status: "unreviewed",
            shared_with_care_team: validated.sharedWithCareTeam,
        })
        .select()
        .single();

    if (error || !report) {
        throw ApiError.internal("Failed to save report record", error?.message);
    }

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "upload_report",
        target_type: "patient_report",
        target_id: report.id,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, report }, 201);
});

// ─── 3. List Reports for Patient (GET /reports?patientId=...) ─────────────────
reportsRouter.get("/", async (c) => {
    const user = c.get("user");
    const patientId = c.req.query("patientId");
    if (!patientId) throw ApiError.badRequest("patientId query param is required");

    const admin = getAdminClient();

    // Verify patient access
    const { data: patient } = await admin
        .from("patients")
        .select("id, workspace_id, profile_id")
        .eq("id", patientId)
        .single();

    if (!patient) throw ApiError.notFound("Patient not found");

    const [{ data: assignments }, { data: grants }, { data: consent }] = await Promise.all([
        admin.from("care_team_assignments").select("*").eq("patient_id", patientId),
        admin.from("care_grants").select("*").eq("patient_id", patientId),
        admin.from("consent_records").select("*").eq("patient_id", patientId).maybeSingle(),
    ]);

    const authCheck = authorizePatientAccess({
        user,
        patient: { id: patient.id, workspaceId: patient.workspace_id, profileId: patient.profile_id },
        assignments: (assignments ?? []).map((assignment) => ({
            patientId: assignment.patient_id,
            doctorProfileId: assignment.doctor_profile_id,
            revokedAt: assignment.revoked_at,
        })),
        grants: (grants ?? []).map((grant) => ({
            patientId: grant.patient_id,
            granteeProfileId: grant.grantee_profile_id,
            scope: grant.scope,
            revokedAt: grant.revoked_at,
        })),
        consent: consent
            ? {
                  patientId,
                  shareWithCareTeam: consent.share_with_care_team,
                  allowReminders: consent.allow_reminders,
                  allowAiAnalysis: consent.allow_ai_analysis,
              }
            : null,
    });
    if (!authCheck.authorized) {
        throw ApiError.forbidden(authCheck.reason);
    }

    let query = admin
        .from("patient_reports")
        .select("*")
        .eq("patient_id", patientId)
        .order("uploaded_at", { ascending: false });

    if (user.role === "care_team") {
        query = query.eq("shared_with_care_team", true);
    }

    const { data: reports, error } = await query;
    if (error) throw ApiError.internal("Failed to retrieve reports", error.message);

    return c.json({ reports: reports || [] });
});

// ─── 4. Get Signed Viewing URL (GET /reports/:id/view-url) ────────────────────
reportsRouter.get("/:id/view-url", async (c) => {
    const user = c.get("user");
    const reportId = c.req.param("id");
    const admin = getAdminClient();
    const config = getConfig();

    const { data: report, error } = await admin
        .from("patient_reports")
        .select("*, patients(id, workspace_id, profile_id)")
        .eq("id", reportId)
        .single();

    if (error || !report) throw ApiError.notFound("Report not found");

    const patient = report.patients as { id: string; workspace_id: string; profile_id?: string | null } | undefined;
    if (user.role === "care_team" && !report.shared_with_care_team) {
        throw ApiError.forbidden("Report is not shared with care team");
    }
    if (!(config.demoMode && user.role === "care_team" && report.shared_with_care_team)) {
        await assertReportAccess(user, patient?.id ?? report.patient_id);
    }

    if (config.demoMode) {
        return c.json({
            signedUrl: `https://mock-storage.mednova.clinic/view/${report.storage_path}?token=demo-view-token`,
            expiresInSeconds: config.signedUrlExpirySeconds,
        });
    }

    const { data: signedData, error: signErr } = await admin.storage
        .from(config.reportsBucketName)
        .createSignedUrl(report.storage_path, config.signedUrlExpirySeconds);

    if (signErr || !signedData) {
        throw ApiError.internal("Failed to generate signed viewing URL", signErr?.message);
    }

    return c.json({
        signedUrl: signedData.signedUrl,
        expiresInSeconds: config.signedUrlExpirySeconds,
    });
});

// ─── 5. Clinician Review (PATCH /reports/:id/review) ──────────────────────────
reportsRouter.patch("/:id/review", requireRole("doctor"), async (c) => {
    const user = c.get("user");
    const reportId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const admin = getAdminClient();

    const reviewedAt = new Date().toISOString();
    const { data: updated, error } = await admin
        .from("patient_reports")
        .update({
            review_status: "reviewed",
            reviewed_by_profile_id: user.profileId,
            reviewed_at: reviewedAt,
        })
        .eq("id", reportId)
        .select()
        .single();

    if (error || !updated) throw ApiError.internal("Failed to mark report reviewed", error?.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "review_report",
        target_type: "patient_report",
        target_id: reportId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, report: updated });
});
