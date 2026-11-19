import { getAdminClient } from "../lib/supabase.js";
import { sendEmail } from "./emailService.js";

export interface PeriodicReportResult {
    reportId: string;
    patientId: string;
    period: "weekly" | "monthly";
    startDate: string;
    endDate: string;
    adherencePercent: number;
    takenCount: number;
    totalDoses: number;
    missedDays: number;
    streakDays: number;
    trend: "improving" | "stable" | "declining";
    insights: string[];
    emailSent: boolean;
    providerMessageId?: string;
    error?: string;
}

/**
 * Generates an HTML report email for patient medication adherence.
 */
function buildReportHtml({
    patientName,
    period,
    startDate,
    endDate,
    adherencePercent,
    takenCount,
    totalDoses,
    missedDays,
    streakDays,
    trend,
    insights,
    activeMeds,
    portalUrl,
}: {
    patientName: string;
    period: "weekly" | "monthly";
    startDate: string;
    endDate: string;
    adherencePercent: number;
    takenCount: number;
    totalDoses: number;
    missedDays: number;
    streakDays: number;
    trend: "improving" | "stable" | "declining";
    insights: string[];
    activeMeds: string[];
    portalUrl: string;
}): string {
    const periodLabel = period === "weekly" ? "Weekly Adherence Summary" : "Monthly Adherence Summary";
    const trendEmoji = trend === "improving" ? "↑ Improving" : trend === "declining" ? "↓ Needs Attention" : "→ Stable";
    const trendColor = trend === "improving" ? "#0d9488" : trend === "declining" ? "#e11d48" : "#0284c7";
    const scoreColor = adherencePercent >= 80 ? "#0d9488" : adherencePercent >= 60 ? "#d97706" : "#e11d48";

    const insightsListHtml = insights
        .map((insight) => `<li style="margin-bottom: 8px; color: #334155; line-height: 1.5;">${insight}</li>`)
        .join("");

    const medsListHtml = activeMeds.length > 0
        ? activeMeds.map((m) => `<span style="display: inline-block; background-color: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 9999px; font-size: 12px; margin-right: 6px; margin-bottom: 6px;">${m}</span>`).join("")
        : `<span style="color: #64748b; font-size: 13px;">No active prescriptions recorded</span>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${periodLabel} — MedNova Health</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f766e 0%, #0e7490 100%); padding: 28px 24px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #99f6e4; margin-bottom: 4px;">MedNova Care Team</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${periodLabel}</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #ccfbf1;">Period: ${startDate} to ${endDate}</p>
    </div>

    <!-- Main Content -->
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">Hello <strong>${patientName}</strong>,</p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.5;">
        Here is your personalized medication adherence report for the past ${period === "weekly" ? "7 days" : "30 days"}. Regular tracking helps you and your doctor maintain optimal health outcomes.
      </p>

      <!-- Score Card -->
      <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <div>
            <span style="font-size: 38px; font-weight: 800; color: ${scoreColor}; line-height: 1;">${adherencePercent}%</span>
            <span style="display: inline-block; margin-left: 10px; font-size: 13px; font-weight: 600; color: ${trendColor}; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${trendEmoji}</span>
          </div>
          <div style="text-align: right; font-size: 13px; color: #475569;">
            <div><strong>${streakDays} day</strong> current streak</div>
            <div style="color: #64748b; font-size: 12px;">${missedDays} missed day${missedDays === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #99f6e4; font-size: 13px;">
          <div style="color: #334155;"><strong>Doses Taken:</strong> ${takenCount} of ${totalDoses}</div>
          <div style="color: #334155;"><strong>Adherence Level:</strong> ${adherencePercent >= 80 ? "Optimal (≥80%)" : "Suboptimal (<80%)"}</div>
        </div>
      </div>

      <!-- Highlights & Insights -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Clinical Highlights</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${insightsListHtml}
        </ul>
      </div>

      <!-- Active Prescriptions -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Tracked Regimen</h3>
        <div>
          ${medsListHtml}
        </div>
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 30px 0 10px;">
        <a href="${portalUrl}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          View Full Report in Patient Portal
        </a>
      </div>

      <!-- Footer Note -->
      <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.4;">
        This automated clinical summary is part of your MedNova proactive care plan.<br>
        If you experience side effects or need to adjust your medication, please message your care team in the portal.
      </p>

    </div>
  </div>
</body>
</html>
    `.trim();
}

/**
 * Generates and saves a periodic adherence report for a single patient,
 * and delivers the report email if preferences allow.
 */
export async function generateAndSendPeriodicReport(
    patientId: string,
    period: "weekly" | "monthly",
    options: { forceSend?: boolean; correlationId?: string } = {}
): Promise<PeriodicReportResult> {
    const admin = getAdminClient();
    const correlationId = options.correlationId || `report-${period}-${Date.now()}`;

    // 1. Fetch patient details
    const { data: patient, error: pErr } = await admin
        .from("patients")
        .select("id, full_name, contact_email, workspace_id, is_deleted")
        .eq("id", patientId)
        .single();

    if (pErr || !patient) {
        throw new Error(`Patient not found: ${patientId}`);
    }

    // 2. Fetch notification preferences
    const { data: prefs } = await admin
        .from("notification_preferences")
        .select("*")
        .eq("patient_id", patient.id);

    const emailPref = prefs?.find((p) => p.channel === "email");
    const weeklyEnabled = emailPref ? (emailPref.weekly_report_email ?? true) : true;
    const emailChannelEnabled = emailPref ? (emailPref.enabled ?? true) : true;

    // 3. Determine Date Windows
    const now = new Date();
    const days = period === "weekly" ? 7 : 30;
    const endDateObj = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday end of cycle
    const startDateObj = new Date(endDateObj.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const startDate = startDateObj.toISOString().split("T")[0];
    const endDate = endDateObj.toISOString().split("T")[0];

    // Previous window for trend comparison
    const prevEndDateObj = new Date(startDateObj.getTime() - 24 * 60 * 60 * 1000);
    const prevStartDateObj = new Date(prevEndDateObj.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const prevStartDate = prevStartDateObj.toISOString().split("T")[0];
    const prevEndDate = prevEndDateObj.toISOString().split("T")[0];

    // 4. Fetch dose logs for current window
    const { data: doseLogs } = await admin
        .from("dose_logs")
        .select("id, status, logged_at")
        .eq("patient_id", patient.id)
        .gte("logged_at", `${startDate}T00:00:00.000Z`)
        .lte("logged_at", `${endDate}T23:59:59.999Z`);

    // Fetch dose logs for previous window (for trend)
    const { data: prevDoseLogs } = await admin
        .from("dose_logs")
        .select("id, status, logged_at")
        .eq("patient_id", patient.id)
        .gte("logged_at", `${prevStartDate}T00:00:00.000Z`)
        .lte("logged_at", `${prevEndDate}T23:59:59.999Z`);

    // 5. Query active prescriptions / medications
    const { data: prescriptions } = await admin
        .from("prescriptions")
        .select("id, status, medications(name, dosage)")
        .eq("patient_id", patient.id)
        .eq("status", "approved");

    const activeMeds = (prescriptions || [])
        .map((p) => {
            const med = p.medications as any;
            return med?.name ? `${med.name} ${med.dosage || ""}`.trim() : null;
        })
        .filter(Boolean) as string[];

    // 6. Calculate Metrics
    const totalDosesLogged = doseLogs?.length || 0;
    const takenDoses = (doseLogs || []).filter((l) => l.status === "taken").length;
    const missedDoses = (doseLogs || []).filter((l) => l.status === "missed" || l.status === "skipped").length;

    // Estimate expected doses: at least 1 dose per day per prescription or based on logs
    const activePrescCount = Math.max(activeMeds.length, 1);
    const expectedDoses = Math.max(totalDosesLogged, days * activePrescCount);
    const totalDoses = expectedDoses;

    const adherencePercent = totalDoses > 0 ? Math.min(100, Math.round((takenDoses / totalDoses) * 100)) : 100;

    // Previous window adherence
    const prevTotal = prevDoseLogs?.length || 0;
    const prevTaken = (prevDoseLogs || []).filter((l) => l.status === "taken").length;
    const prevAdherence = prevTotal > 0 ? Math.round((prevTaken / Math.max(prevTotal, days)) * 100) : adherencePercent;

    let trend: "improving" | "stable" | "declining" = "stable";
    if (adherencePercent >= prevAdherence + 5) trend = "improving";
    else if (adherencePercent <= prevAdherence - 5) trend = "declining";

    // Count missed days
    const missedDates = new Set(
        (doseLogs || [])
            .filter((l) => l.status === "missed" || l.status === "skipped")
            .map((l) => l.logged_at?.split("T")[0])
    );
    const missedDays = missedDates.size;

    // Calculate streak
    let streakDays = 0;
    const takenDates = new Set(
        (doseLogs || [])
            .filter((l) => l.status === "taken")
            .map((l) => l.logged_at?.split("T")[0])
    );
    for (let i = 0; i < days; i++) {
        const d = new Date(endDateObj.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        if (takenDates.has(d)) {
            streakDays++;
        } else {
            break;
        }
    }

    // 7. Formulate Clinical Insights
    const insights: string[] = [];
    insights.push(`You successfully logged ${takenDoses} of ${totalDoses} scheduled doses across this ${period === "weekly" ? "7-day" : "30-day"} period.`);

    if (activeMeds.length > 0) {
        insights.push(`Active prescribed medications evaluated: ${activeMeds.join(", ")}.`);
    }

    if (missedDays === 0 && adherencePercent >= 90) {
        insights.push("Excellent consistency: Zero missed days recorded! You are maintaining outstanding clinical compliance.");
    } else if (missedDays > 0) {
        insights.push(`${missedDays} day(s) had unlogged or missed doses. Continuing your routine dose logging will help prevent therapy gaps.`);
    }

    if (trend === "improving") {
        insights.push("Your adherence score improved compared to the previous evaluation period. Keep building the habit!");
    } else if (trend === "declining") {
        insights.push("Adherence dipped slightly compared to last period. If you are experiencing side effects or scheduling hurdles, consult your care team.");
    } else {
        insights.push("Steady consistency: Your adherence rate remains stable across tracking cycles.");
    }

    // 8. Build HTML Content
    const portalUrl = (process.env["API_ORIGIN"] || "http://localhost:8443") + "/patient/reports";
    const htmlContent = buildReportHtml({
        patientName: patient.full_name,
        period,
        startDate,
        endDate,
        adherencePercent,
        takenCount: takenDoses,
        totalDoses,
        missedDays,
        streakDays,
        trend,
        insights,
        activeMeds,
        portalUrl,
    });

    const plainText = `MedNova Health — ${period === "weekly" ? "Weekly" : "Monthly"} Adherence Report (${startDate} to ${endDate})\n\n`
        + `Hello ${patient.full_name},\n\n`
        + `Adherence Score: ${adherencePercent}% (${trend.toUpperCase()})\n`
        + `Doses Taken: ${takenDoses} of ${totalDoses}\n`
        + `Current Streak: ${streakDays} days\n`
        + `Missed Days: ${missedDays}\n\n`
        + `Highlights:\n${insights.map((i) => `• ${i}`).join("\n")}\n\n`
        + `View your full report online: ${portalUrl}\n\nMedNova Care Team`;

    // 9. Dispatch Email if permitted
    let emailSent = false;
    let providerMessageId: string | undefined;

    const shouldSendEmail = options.forceSend || (patient.contact_email && emailChannelEnabled && (period === "monthly" || weeklyEnabled));

    if (shouldSendEmail && patient.contact_email) {
        const subject = `MedNova Health: Your ${period === "weekly" ? "Weekly" : "Monthly"} Adherence Report (${startDate} — ${endDate})`;
        const sendResult = await sendEmail({
            to: patient.contact_email,
            subject,
            text: plainText,
            html: htmlContent,
            metadata: {
                type: "periodic_adherence_report",
                period,
                patientId: patient.id,
                adherencePercent,
                correlationId,
            },
        });

        emailSent = sendResult.success;
        providerMessageId = sendResult.providerMessageId;
    }

    // 10. Persist Report Record in Database
    const { data: savedReport, error: saveErr } = await admin
        .from("patient_adherence_reports")
        .insert({
            patient_id: patient.id,
            period,
            start_date: startDate,
            end_date: endDate,
            adherence_percent: adherencePercent,
            taken_count: takenDoses,
            total_doses: totalDoses,
            missed_days: missedDays,
            streak_days: streakDays,
            trend,
            insights,
            html_content: htmlContent,
            email_dispatch_id: providerMessageId || null,
            delivered_at: emailSent ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

    if (saveErr) {
        console.warn(`[REPORT SAVE ERROR] Could not persist report for ${patient.id}: ${saveErr.message}`);
    }

    return {
        reportId: savedReport?.id || `rep-${Date.now()}`,
        patientId: patient.id,
        period,
        startDate,
        endDate,
        adherencePercent,
        takenCount: takenDoses,
        totalDoses,
        missedDays,
        streakDays,
        trend,
        insights,
        emailSent,
        providerMessageId,
    };
}

/**
 * Evaluates and dispatches periodic reports to all active patients.
 */
export async function dispatchPeriodicReportsToAllPatients(
    period: "weekly" | "monthly",
    options: { forceSend?: boolean; specificPatientId?: string; correlationId?: string } = {}
) {
    const admin = getAdminClient();
    const correlationId = options.correlationId || `batch-${period}-${Date.now()}`;

    let query = admin
        .from("patients")
        .select("id, full_name, contact_email")
        .eq("is_deleted", false);

    if (options.specificPatientId) {
        query = query.eq("id", options.specificPatientId);
    }

    const { data: patients, error: pErr } = await query;
    if (pErr) throw new Error(`Failed to query active patients: ${pErr.message}`);

    const results: PeriodicReportResult[] = [];
    const errors: string[] = [];

    for (const patient of patients || []) {
        try {
            const reportResult = await generateAndSendPeriodicReport(patient.id, period, {
                forceSend: options.forceSend,
                correlationId: `${correlationId}-${patient.id}`,
            });
            results.push(reportResult);
        } catch (err: any) {
            errors.push(`Error for ${patient.id} (${patient.full_name}): ${err.message || err}`);
        }
    }

    return {
        success: true,
        period,
        totalPatients: (patients || []).length,
        dispatchedCount: results.filter((r) => r.emailSent).length,
        reportsGenerated: results.length,
        results,
        errors,
        correlationId,
    };
}
