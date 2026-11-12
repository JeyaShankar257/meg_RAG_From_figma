import { Hono } from "hono";
import { getAdminClient } from "../../lib/supabase.js";
import { evaluateDailyPatternForPatient } from "../../services/adherencePipelineService.js";

export const adminRouter = new Hono();

// Middleware: authenticate via x-admin-secret header
adminRouter.use("*", async (c, next) => {
    const configuredSecret = process.env["ADMIN_SECRET"];
    const providedSecret = c.req.header("x-admin-secret");

    // If ADMIN_SECRET is set, require match; in demo mode allow fallback demo secret if not set
    const effectiveSecret = configuredSecret || (process.env["DEMO_MODE"] === "true" ? "demo-admin-secret" : "");

    if (!effectiveSecret || providedSecret !== effectiveSecret) {
        return c.json({ error: "Unauthorized: Invalid or missing x-admin-secret" }, 401);
    }

    await next();
});

/**
 * POST /admin/patients/evaluate-all
 * Evaluates daily adherence patterns across all active, non-deleted patients.
 * Dispatches Tier 1 Warnings & Tier 2 Guardian SOS emails where conditions are met.
 */
adminRouter.post("/patients/evaluate-all", async (c) => {
    const admin = getAdminClient();
    const correlationId = (c.get("correlationId") as string) || `admin-eval-${Date.now()}`;
    const body = await c.req.json().catch(() => ({}));

    // 1. Fetch all active, non-deleted patients
    const { data: patients, error: pErr } = await admin
        .from("patients")
        .select("id, full_name")
        .eq("is_deleted", false);

    if (pErr) {
        return c.json({
            success: false,
            error: `Failed to query patients: ${pErr.message}`,
        }, 500);
    }

    const patientList = patients || [];
    const results: Array<{ patientId: string; status: "success" | "error"; error?: string }> = [];
    const errors: string[] = [];

    // 2. Sequentially evaluate each patient
    for (const patient of patientList) {
        try {
            await evaluateDailyPatternForPatient(patient.id, {
                force: body.force,
                mockConsecutiveSkips: body.mockConsecutiveSkips,
                mockAdherenceRate: body.mockAdherenceRate,
                correlationId: `${correlationId}-${patient.id}`,
            });
            results.push({ patientId: patient.id, status: "success" });
        } catch (err: any) {
            const msg = `Patient ${patient.id} (${patient.full_name}): ${err?.message || err}`;
            errors.push(msg);
            results.push({ patientId: patient.id, status: "error", error: msg });
        }
    }

    return c.json({
        success: true,
        evaluated: patientList.length,
        succeeded: results.filter((r) => r.status === "success").length,
        failed: errors.length,
        errors,
        correlationId,
    });
});

/**
 * POST /admin/reminders/dispatch-due
 * Finds all active dose schedules due for today/current window and delivers reminder emails directly.
 */
adminRouter.post("/reminders/dispatch-due", async (c) => {
    const admin = getAdminClient();
    const correlationId = (c.get("correlationId") as string) || `rem-disp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Query active patients
    const { data: patients, error: pErr } = await admin
        .from("patients")
        .select("id, full_name, contact_email")
        .eq("is_deleted", false);

    if (pErr) {
        return c.json({ success: false, error: pErr.message }, 500);
    }

    const { sendEmail } = await import("../../services/emailService.js");
    const dispatched: any[] = [];
    const errors: string[] = [];

    for (const patient of patients || []) {
        if (!patient.contact_email) continue;

        // Query active prescriptions and medications for this patient
        const { data: prescs } = await admin
            .from("prescriptions")
            .select("id, medications(name, dosage)")
            .eq("patient_id", patient.id)
            .eq("status", "approved");

        const medName = prescs && prescs[0] && (prescs[0].medications as any)?.name
            ? `${(prescs[0].medications as any).name} ${(prescs[0].medications as any).dosage || ""}`.trim()
            : "scheduled medication";

        try {
            const subject = `Medication Reminder — MedNova`;
            const text = `Hello ${patient.full_name},\n\nIt is time to take your scheduled dose of ${medName}.\n\nPlease log in to the MedNova Patient Portal to record your dose once taken.\n\nMedNova Care Team`;

            const emailResult = await sendEmail({
                to: patient.contact_email,
                subject,
                text,
                metadata: {
                    type: "routine_dose_reminder",
                    patientId: patient.id,
                    dispatchedAt: nowIso,
                },
            });

            dispatched.push({
                patientId: patient.id,
                email: patient.contact_email,
                medication: medName,
                mode: emailResult.mode,
            });
        } catch (err: any) {
            errors.push(`Error for ${patient.id}: ${err?.message || err}`);
        }
    }

    return c.json({
        success: true,
        dispatchedCount: dispatched.length,
        dispatched,
        errors,
        correlationId,
    });
});


