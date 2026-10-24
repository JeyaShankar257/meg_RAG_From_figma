import { v4 as uuidv4 } from "uuid";
import { getAdminClient } from "../lib/supabase.js";
import { sendEmail } from "./emailService.js";
import {
    CANONICAL_4_STAGES,
    PIPELINE_STAGE_DISPLAY,
    type PipelineStageKey,
    type PipelineStageStatus,
    type PipelineLogLevel,
} from "@mednova/types";

export interface DailyEvaluationOptions {
    force?: boolean;
    correlationId?: string;
    actorProfileId?: string;
    mockConsecutiveSkips?: number;
    mockAdherenceRate?: number;
}

export interface DailyEvaluationResult {
    success: boolean;
    patientId: string;
    patientName: string;
    adherenceScore: number;
    currentStreakDays: number;
    consecutiveSkips: number;
    level1Triggered: boolean;
    level2Triggered: boolean;
    warningSent: boolean;
    warningInCooldown: boolean;
    sosTriggered: boolean;
    guardianNotified: boolean;
    guardianEmail?: string;
    escalationId?: string;
    correlationId: string;
    evaluatedAt: string;
}

export interface EscalationResponseInput {
    action: "telehealth" | "nurse_call" | "adjust_medication" | "acknowledge";
    notes?: string;
    doctorProfileId: string;
    correlationId?: string;
}

/**
 * Derives medication-specific clinical physiological risks.
 */
function getDrugSpecificRisks(medications: Array<{ name: string; dosage?: string }>): string[] {
    const risks: string[] = [];
    const medNames = medications.map((m) => m.name.toLowerCase());

    if (medNames.some((n) => n.includes("metformin") || n.includes("glipizide") || n.includes("insulin"))) {
        risks.push("Glycemic instability: Elevated risk of hyperglycemia spikes, osmotic diuresis, and diabetic complications.");
    }
    if (medNames.some((n) => n.includes("lisinopril") || n.includes("amlodipine") || n.includes("losartan") || n.includes("metoprolol"))) {
        risks.push("Cardiovascular strain: Rebound arterial hypertension, increased left ventricular workload, and elevated stroke risk.");
    }
    if (medNames.some((n) => n.includes("atorvastatin") || n.includes("rosuvastatin") || n.includes("simvastatin"))) {
        risks.push("Vascular risk: Loss of plaque stabilization and rapid rebound of low-density lipoproteins (LDL).");
    }
    if (medNames.some((n) => n.includes("sertraline") || n.includes("fluoxetine") || n.includes("escitalopram"))) {
        risks.push("Neurochemical rebound: SSRI discontinuation symptoms, rapid mood destabilization, and acute rebound anxiety.");
    }

    if (risks.length === 0) {
        risks.push("Reduced therapeutic efficacy and heightened probability of chronic condition recurrence or progression.");
    }

    return risks;
}

/**
 * Ensures a durable pipeline run exists for the patient and contains the 4 canonical stages.
 */
export async function ensureCanonicalPipelineRun(patientId: string, workspaceId: string, correlationId: string) {
    const admin = getAdminClient();

    // 1. Get or create latest pipeline run
    let { data: run } = await admin
        .from("pipeline_runs")
        .select("*")
        .eq("patient_id", patientId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!run) {
        const runId = uuidv4();
        const { data: newRun, error: rErr } = await admin
            .from("pipeline_runs")
            .insert({
                id: runId,
                patient_id: patientId,
                workspace_id: workspaceId,
                trigger_type: "daily_evaluation",
                status: "running",
                correlation_id: correlationId,
            })
            .select()
            .single();

        if (rErr || !newRun) {
            throw new Error(`Failed to initialize pipeline run: ${rErr?.message}`);
        }
        run = newRun;
    }

    // 2. Fetch existing stages for this run
    const { data: existingStages } = await admin
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_run_id", run.id);

    const existingMap = new Map<string, any>((existingStages || []).map((s: any) => [s.stage_key, s]));

    // 3. Ensure all 4 canonical stages are present
    const stagesToInsert = [];
    for (const key of CANONICAL_4_STAGES) {
        if (!existingMap.has(key)) {
            stagesToInsert.push({
                id: uuidv4(),
                pipeline_run_id: run.id,
                stage_key: key,
                status: key === "reminder_agent" ? "complete" : "idle",
                agent_name: PIPELINE_STAGE_DISPLAY[key],
                attempt: 1,
            });
        }
    }

    if (stagesToInsert.length > 0) {
        await admin.from("pipeline_stages").insert(stagesToInsert);
    }

    // Refresh stages list
    const { data: allStages } = await admin
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_run_id", run.id);

    return {
        run,
        stages: allStages || [],
    };
}

/**
 * Evaluates patient adherence at end-of-day or on-demand, executing the 4-tier closed-loop pipeline.
 */
export async function evaluateDailyPatternForPatient(
    patientId: string,
    options: DailyEvaluationOptions = {},
): Promise<DailyEvaluationResult> {
    const admin = getAdminClient();
    const correlationId = options.correlationId || `corr-eval-${Date.now()}`;
    const evaluatedAt = new Date().toISOString();

    // 1. Fetch patient record
    const { data: patient, error: pErr } = await admin
        .from("patients")
        .select("id, workspace_id, profile_id, full_name, guardian_name, guardian_email, guardian_phone")
        .eq("id", patientId)
        .maybeSingle();

    if (pErr || !patient) {
        throw new Error(`Patient ${patientId} not found`);
    }

    // 2. Fetch active prescriptions
    const { data: prescriptions } = await admin
        .from("prescriptions")
        .select("id, name, dosage, frequency, status")
        .eq("patient_id", patientId)
        .eq("status", "active");

    const activeMeds = (prescriptions || []).map((p: any) => ({
        name: p.name,
        dosage: p.dosage,
    }));

    // 3. Calculate adherence & consecutive skips
    // Query recent dose logs
    const { data: logs } = await admin
        .from("dose_logs")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(30);

    let takenCount = 0;
    let skippedCount = 0;
    let missedCount = 0;
    let streakDays = 0;
    let consecutiveSkips = 0;

    if (options.mockConsecutiveSkips !== undefined) {
        consecutiveSkips = options.mockConsecutiveSkips;
    }

    if (logs && logs.length > 0) {
        for (const log of logs) {
            if (log.status === "taken") takenCount++;
            else if (log.status === "skipped") skippedCount++;
            else if (log.status === "missed") missedCount++;
        }

        // Calculate consecutive skips from latest logs if not explicitly mocked
        if (options.mockConsecutiveSkips === undefined) {
            for (const log of logs) {
                if (log.status === "skipped" || log.status === "missed") {
                    consecutiveSkips++;
                } else if (log.status === "taken") {
                    break;
                }
            }
        }

        // Calculate streak days
        if (consecutiveSkips === 0) {
            for (const log of logs) {
                if (log.status === "taken") {
                    streakDays++;
                } else {
                    break;
                }
            }
        }
    }

    const totalLogged = takenCount + skippedCount + missedCount;
    let adherenceScore = totalLogged > 0 ? (takenCount / totalLogged) * 100 : 92;
    if (options.mockAdherenceRate !== undefined) {
        adherenceScore = options.mockAdherenceRate;
    }

    // 4. Ensure durable pipeline run and 4 canonical stages
    const { run, stages } = await ensureCanonicalPipelineRun(patientId, patient.workspace_id, correlationId);

    const stageMap = new Map<PipelineStageKey, any>(stages.map((s: any) => [s.stage_key, s]));
    const patternStage = stageMap.get("pattern_detection_agent");
    const warningStage = stageMap.get("patient_warning_agent");
    const sosStage = stageMap.get("sos_agent");

    // 5. Update Pattern Detection Agent
    if (patternStage) {
        await admin
            .from("pipeline_stages")
            .update({
                status: "complete",
                completed_at: evaluatedAt,
                updated_at: evaluatedAt,
            })
            .eq("id", patternStage.id);

        await admin.from("pipeline_stage_logs").insert({
            pipeline_stage_id: patternStage.id,
            level: "info" as PipelineLogLevel,
            message: `Daily adherence sweep: score ${Math.round(adherenceScore)}%, streak ${streakDays}d, ${consecutiveSkips} consecutive skipped days.`,
            metadata: {
                adherenceScore: Math.round(adherenceScore),
                currentStreakDays: streakDays,
                consecutiveSkips,
                evaluatedAt,
            },
            correlation_id: correlationId,
        });
    }

    // 6. Tier 1: Patient Health Warning Agent (2 consecutive skips OR adherence < 75%)
    let level1Triggered = consecutiveSkips >= 2 || (adherenceScore < 75 && consecutiveSkips >= 1);
    let warningSent = false;
    let warningInCooldown = false;

    if (level1Triggered && warningStage) {
        // Check 48h cooldown
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const warningQuery = admin
            .from("pipeline_stage_logs")
            .select("id, created_at")
            .eq("pipeline_stage_id", warningStage.id)
            .eq("level", "warn");
        const { data: recentWarnings } = typeof (warningQuery as any).gte === "function"
            ? await (warningQuery as any).gte("created_at", fortyEightHoursAgo).limit(1)
            : await warningQuery.limit(1);

        if (recentWarnings && recentWarnings.length > 0 && !options.force) {
            warningInCooldown = true;
            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: warningStage.id,
                level: "info" as PipelineLogLevel,
                message: `Patient health warning condition met, but suppressed due to active 48-hour cooldown.`,
                metadata: { consecutiveSkips, adherenceScore },
                correlation_id: correlationId,
            });
        } else {
            // Send warning email to patient
            const risks = getDrugSpecificRisks(activeMeds);
            const patientEmail = "patient.rivera@example.com"; // Default for demo patient
            const emailSubject = `Important Notice: Clinical Medication Adherence Alert for ${patient.full_name}`;
            const emailText = `Hello ${patient.full_name},\n\nOur clinical care team noticed that you have missed or skipped your prescribed medication for ${consecutiveSkips} consecutive day(s).\n\nPotential Health Risks:\n${risks.map((r) => `• ${r}`).join("\n")}\n\nPlease take your prescribed dose as soon as possible, or log in to the Patient Portal to report any side effects or speak with your care team.\n\nMedNova Clinical Adherence Team`;

            await sendEmail({
                to: patientEmail,
                subject: emailSubject,
                text: emailText,
                metadata: {
                    type: "patient_health_warning",
                    patientId,
                    consecutiveSkips,
                    adherenceScore,
                },
            });

            await admin
                .from("pipeline_stages")
                .update({
                    status: "complete",
                    completed_at: evaluatedAt,
                    updated_at: evaluatedAt,
                })
                .eq("id", warningStage.id);

            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: warningStage.id,
                level: "warn" as PipelineLogLevel,
                message: `Level 1 Patient Health Warning dispatched: Personalized drug-specific advisory sent for ${activeMeds.map((m) => m.name).join(", ") || "prescriptions"}.`,
                metadata: {
                    type: "patient_health_warning",
                    consecutiveSkips,
                    adherenceScore,
                    risks,
                    dispatchedAt: evaluatedAt,
                },
                correlation_id: correlationId,
            });

            warningSent = true;
        }
    } else if (warningStage && warningStage.status !== "complete") {
        await admin
            .from("pipeline_stages")
            .update({ status: "idle", updated_at: evaluatedAt })
            .eq("id", warningStage.id);
    }

    // 7. Tier 2: Doctor & Guardian SOS Agent (3+ consecutive skips)
    let level2Triggered = consecutiveSkips >= 3;
    let sosTriggered = false;
    let guardianNotified = false;
    let escalationId: string | undefined;

    if (level2Triggered && sosStage) {
        sosTriggered = true;

        // Upsert urgent escalation record
        const { data: existingEscalation } = await admin
            .from("escalations")
            .select("id")
            .eq("patient_id", patientId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const reasoning = `CRITICAL ADHERENCE FAILURE: Patient has missed medication for ${consecutiveSkips} consecutive days. Urgent doctor review and guardian outreach initiated.`;

        if (existingEscalation) {
            escalationId = existingEscalation.id;
            await admin
                .from("escalations")
                .update({
                    severity: "critical",
                    reasoning,
                    confidence: 0.98,
                    model_version: "mednova-pattern-detection-v1",
                })
                .eq("id", existingEscalation.id);
        } else {
            escalationId = uuidv4();
            await admin.from("escalations").insert({
                id: escalationId,
                patient_id: patientId,
                severity: "critical",
                status: "open",
                reasoning,
                confidence: 0.98,
                model_version: "mednova-pattern-detection-v1",
            });
        }

        // Update SOS stage to 'error' (indicates active clinical critical alert in UI)
        await admin
            .from("pipeline_stages")
            .update({
                status: "error",
                last_error: `Active SOS: ${consecutiveSkips} consecutive skips. Urgent intervention required.`,
                updated_at: evaluatedAt,
            })
            .eq("id", sosStage.id);

        await admin.from("pipeline_stage_logs").insert({
            pipeline_stage_id: sosStage.id,
            level: "error" as PipelineLogLevel,
            message: `Level 2 SOS triggered: Critical non-adherence persistence (${consecutiveSkips} consecutive days). Care team alert activated.`,
            metadata: {
                type: "guardian_sos_alert",
                consecutiveSkips,
                severity: "critical",
                escalationId,
            },
            correlation_id: correlationId,
        });

        // Notify Guardian if registered
        if (patient.guardian_email) {
            const guardianSubject = `URGENT CARE ALERT: Immediate Health Follow-Up Required for ${patient.full_name}`;
            const guardianText = `Dear ${patient.guardian_name || "Emergency Caregiver"},\n\nThis is an urgent clinical notice from the MedNova Care Team regarding ${patient.full_name}.\n\nOur continuous monitoring has identified ${consecutiveSkips} consecutive days of unlogged critical medication doses. The patient has not responded to preliminary health notices.\n\nPlease check on ${patient.full_name} immediately to ensure their safety and well-being. The attending physician has also received an urgent escalation alert.\n\nMedNova Clinical Emergency Monitoring`;

            await sendEmail({
                to: patient.guardian_email,
                subject: guardianSubject,
                text: guardianText,
                metadata: {
                    type: "guardian_sos_alert",
                    patientId,
                    guardianName: patient.guardian_name,
                    consecutiveSkips,
                },
            });

            guardianNotified = true;

            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: sosStage.id,
                level: "warn" as PipelineLogLevel,
                message: `Emergency SOS email delivered to registered guardian: ${patient.guardian_name} (${patient.guardian_email}).`,
                metadata: {
                    guardianEmail: patient.guardian_email,
                    guardianName: patient.guardian_name,
                    dispatchedAt: evaluatedAt,
                },
                correlation_id: correlationId,
            });
        } else {
            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: sosStage.id,
                level: "warn" as PipelineLogLevel,
                message: `Warning: No emergency guardian email registered for ${patient.full_name}. Care team prompted to collect emergency contacts.`,
                metadata: { missingGuardian: true },
                correlation_id: correlationId,
            });
        }
    } else if (sosStage && sosStage.status !== "complete") {
        await admin
            .from("pipeline_stages")
            .update({ status: "idle", updated_at: evaluatedAt })
            .eq("id", sosStage.id);
    }

    return {
        success: true,
        patientId,
        patientName: patient.full_name,
        adherenceScore: Math.round(adherenceScore),
        currentStreakDays: streakDays,
        consecutiveSkips,
        level1Triggered,
        level2Triggered,
        warningSent,
        warningInCooldown,
        sosTriggered,
        guardianNotified,
        guardianEmail: patient.guardian_email || undefined,
        escalationId,
        correlationId,
        evaluatedAt,
    };
}

/**
 * Handles doctor's 1-click clinical response to an escalation.
 */
export async function respondToEscalation(
    escalationId: string,
    input: EscalationResponseInput,
) {
    const admin = getAdminClient();
    const correlationId = input.correlationId || `corr-action-${Date.now()}`;
    const respondedAt = new Date().toISOString();

    // 1. Fetch escalation
    const { data: escalation, error: eErr } = await admin
        .from("escalations")
        .select("id, patient_id, severity, status, reasoning")
        .eq("id", escalationId)
        .single();

    if (eErr || !escalation) {
        throw new Error(`Escalation ${escalationId} not found`);
    }

    // 2. Determine new status: adjust_medication or acknowledge resolves or acknowledges
    const newStatus = input.action === "adjust_medication" ? "resolved" : "acknowledged";

    const { data: updatedEscalation, error: uErr } = await admin
        .from("escalations")
        .update({
            status: newStatus,
            acknowledged_by_profile_id: input.doctorProfileId,
            acknowledged_at: respondedAt,
        })
        .eq("id", escalationId)
        .select()
        .single();

    if (uErr) {
        throw new Error(`Failed to update escalation: ${uErr.message}`);
    }

    // 3. Record audit event
    await admin.from("audit_events").insert({
        actor_profile_id: input.doctorProfileId,
        action: "record.update",
        target_type: "escalation",
        target_id: escalationId,
        correlation_id: correlationId,
        outcome: "success",
        occurred_at: respondedAt,
    });

    // 4. Update latest pipeline SOS stage to complete
    const { data: run } = await admin
        .from("pipeline_runs")
        .select("id")
        .eq("patient_id", escalation.patient_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (run) {
        const { data: sosStage } = await admin
            .from("pipeline_stages")
            .select("id")
            .eq("pipeline_run_id", run.id)
            .eq("stage_key", "sos_agent")
            .maybeSingle();

        if (sosStage) {
            await admin
                .from("pipeline_stages")
                .update({
                    status: "complete",
                    last_error: null,
                    completed_at: respondedAt,
                    updated_at: respondedAt,
                })
                .eq("id", sosStage.id);

            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: sosStage.id,
                level: "info" as PipelineLogLevel,
                message: `Doctor responded with action: ${input.action.toUpperCase()}. Clinical notes: ${input.notes || "None provided"}. Escalation marked ${newStatus}.`,
                metadata: {
                    action: input.action,
                    notes: input.notes,
                    respondedAt,
                },
                correlation_id: correlationId,
            });
        }
    }

    return updatedEscalation;
}
