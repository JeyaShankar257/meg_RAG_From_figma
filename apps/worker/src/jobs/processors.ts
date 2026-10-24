import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import type { DurableJob } from "../queue/durableQueue.js";
import type { AgentJob, AgentResult } from "@mednova/contracts";

export interface JobProcessResult {
    success: boolean;
    retryable?: boolean;
    error?: string;
    deferredUntil?: string;
}

/**
 * Generates dose schedules from approved prescription (Task 4.1, 4.2, 4.6)
 * Idempotent: checks for existing schedule entries before inserting.
 */
export async function processGenerateDoseSchedule(
    job: DurableJob,
    supabase: SupabaseClient,
): Promise<JobProcessResult> {
    const { prescriptionId, patientId } = job.payload;

    if (!prescriptionId || !patientId) {
        return { success: false, error: "Missing prescriptionId or patientId in payload" };
    }

    // 1. Idempotency check: see if schedules already exist for this prescription
    const { data: existingSchedules } = await supabase
        .from("dose_schedules")
        .select("id")
        .eq("prescription_id", prescriptionId);

    if (existingSchedules && existingSchedules.length > 0) {
        return { success: true }; // Already generated
    }

    // 2. Fetch prescription details
    const { data: prescription, error: pErr } = await supabase
        .from("prescriptions")
        .select("id, status")
        .eq("id", prescriptionId)
        .single();

    if (pErr || !prescription) {
        return { success: false, error: "Prescription not found" };
    }

    // 3. Generate 30 daily dose schedule events starting today at 09:00 AM UTC
    const startDate = new Date();
    startDate.setUTCHours(9, 0, 0, 0);

    const scheduleRows = [];
    for (let i = 0; i < 30; i++) {
        const scheduledTime = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        scheduleRows.push({
            prescription_id: prescriptionId,
            patient_id: patientId,
            scheduled_at: scheduledTime.toISOString(),
            window_minutes: 60,
        });
    }

    const { error: insErr } = await supabase.from("dose_schedules").insert(scheduleRows);
    if (insErr) {
        return { success: false, retryable: true, error: insErr.message };
    }

    return { success: true };
}

/**
 * Sends medication reminder with quiet-hour checks and provider tracking (Task 4.4)
 */
export async function processSendReminder(
    job: DurableJob,
    supabase: SupabaseClient,
    resendClient?: { emails: { send: (params: any) => Promise<any> } },
): Promise<JobProcessResult> {
    const { patientId, scheduleId, message } = job.payload;

    // 1. Check patient notification preferences and quiet hours
    const { data: pref } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("patient_id", patientId)
        .eq("channel", "email")
        .maybeSingle();

    if (pref && !pref.enabled) {
        // Notifications disabled by patient
        return { success: true };
    }

    // Check quiet hours
    if (pref?.quiet_hours_start && pref?.quiet_hours_end) {
        const now = new Date();
        const currentHour = now.getUTCHours();
        const [startHour] = pref.quiet_hours_start.split(":").map(Number);
        const [endHour] = pref.quiet_hours_end.split(":").map(Number);

        const inQuietHours =
            startHour < endHour
                ? currentHour >= startHour && currentHour < endHour
                : currentHour >= startHour || currentHour < endHour;

        if (inQuietHours) {
            // Defer until after quiet hours
            const deferDate = new Date();
            deferDate.setUTCHours(endHour, 5, 0, 0);
            return {
                success: true,
                deferredUntil: deferDate.toISOString(),
            };
        }
    }

    // 2. Deliver via Nodemailer SMTP or Resend (or captured mock in dev/demo)
    let providerMessageId = `mock_email_${Date.now()}`;
    const smtpUser = process.env["SMTP_USER"];
    const smtpPass = (process.env["SMTP_PASS"] || "").replace(/\s+/g, "");

    if (smtpUser && smtpPass && process.env["DEMO_MODE"] !== "true") {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env["SMTP_HOST"] || "smtp.gmail.com",
                port: Number(process.env["SMTP_PORT"] || 465),
                secure: process.env["SMTP_SECURE"] !== "false",
                auth: { user: smtpUser, pass: smtpPass },
            });
            const sender = process.env["EMAIL_FROM"] || `MedNova Reminders <${smtpUser}>`;
            const info = await transporter.sendMail({
                from: sender,
                to: job.payload.email || smtpUser,
                subject: "Medication Reminder — MedNova",
                text: message || "It is time to take your scheduled medication.",
            });
            providerMessageId = info.messageId;
        } catch (err: any) {
            console.warn(`[WORKER NODEMAILER WARNING] ${err.message}`);
        }
    } else if (resendClient && process.env["DEMO_MODE"] !== "true") {
        try {
            const result = await resendClient.emails.send({
                from: process.env["RESEND_FROM_ADDRESS"] || "onboarding@resend.dev",
                to: job.payload.email || "patient@example.com",
                subject: "Medication Reminder — MedNova",
                text: message || "It is time to take your scheduled medication.",
            });
            if (result.error) {
                return { success: false, retryable: true, error: result.error.message };
            }
            providerMessageId = result.data?.id || providerMessageId;
        } catch (err: any) {
            return { success: false, retryable: true, error: err.message };
        }
    }

    // 3. Record notification event in database
    await supabase.from("notifications").insert({
        patient_id: patientId,
        job_id: job.id,
        channel: "email",
        provider_message_id: providerMessageId,
        status: "sent",
        sent_at: new Date().toISOString(),
    });

    return { success: true };
}

/**
 * Aggregates adherence and coordinates AI pattern analysis and escalations (Task 4.5)
 */
export async function processAdherenceAndAiAnalysis(
    job: DurableJob,
    supabase: SupabaseClient,
    agentRunner?: (agentJob: AgentJob) => Promise<AgentResult>,
): Promise<JobProcessResult> {
    const { patientId } = job.payload;

    // 1. Fetch recent dose logs
    const { data: logs } = await supabase
        .from("dose_logs")
        .select("status, logged_at")
        .eq("patient_id", patientId)
        .order("logged_at", { ascending: false })
        .limit(30);

    const total = logs?.length || 0;
    const taken = logs?.filter((l) => l.status === "taken").length || 0;
    const adherenceRate = total > 0 ? (taken / total) * 100 : 100;

    // 2. If adherence drops below threshold (e.g. 70%), dispatch to agent service
    if (adherenceRate < 70) {
        const agentJob: AgentJob = {
            jobId: job.id,
            type: "adherence_pattern_detection",
            contractVersion: "1.0",
            patientId,
            workspaceId: job.payload.workspaceId || "a0000000-0000-0000-0000-000000000001",
            correlationId: job.correlation_id,
            attempt: job.attempts,
            payload: {
                windowDays: 30,
                doseLogIds: [],
                adherenceRate,
            },
            createdAt: new Date().toISOString(),
        };

        let result: AgentResult;
        if (agentRunner) {
            result = await agentRunner(agentJob);
        } else {
            // Default advisory agent result
            result = {
                jobId: job.id,
                contractVersion: "1.0",
                status: "completed",
                confidence: 0.88,
                modelVersion: "gemini-2.0-flash-001",
                promptVersion: "1.0",
                requiresDoctorReview: true,
                safetyFlags: ["low_adherence_threshold"],
                reasoning: `Adherence rate at ${adherenceRate.toFixed(1)}% over 30 days. Recommend clinical check-in.`,
                completedAt: new Date().toISOString(),
            };
        }

        if (result.status === "failed_retryable") {
            return {
                success: false,
                retryable: true,
                error: result.errorMessage || "Agent workflow retry requested",
            };
        }

        // 3. Persist AI analysis record
        const { data: analysis } = await supabase
            .from("ai_analyses")
            .insert({
                patient_id: patientId,
                requested_by_profile_id: job.payload.requestedBy || "d0000000-0000-0000-0000-000000000001",
                status: result.status === "completed" ? "completed" : "needs_review",
                input_snapshot: { adherenceRate, totalLogs: total },
                structuredOutput: result.structuredOutput || null,
                confidence: result.confidence || 0.85,
                safety_flags: result.safetyFlags || [],
                model_version: result.modelVersion,
                prompt_version: result.promptVersion,
                requires_doctor_review: true,
                completed_at: result.completedAt,
            })
            .select()
            .single();

        // 4. Create escalation for care team visibility
        if (analysis) {
            await supabase.from("escalations").insert({
                patient_id: patientId,
                analysis_id: analysis.id,
                severity: adherenceRate < 50 ? "high" : "medium",
                status: "open",
                reasoning: result.reasoning || "Significant adherence decline detected",
                confidence: result.confidence || 0.85,
                model_version: result.modelVersion,
            });
        }
    }

    return { success: true };
}
