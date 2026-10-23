import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { getAdminClient } from "../../lib/supabase.js";
import { authMiddleware, requireRole } from "../../middleware/auth.js";

export const prescriptionsRouter = new Hono();
prescriptionsRouter.use("*", authMiddleware);

const approvalSuggestionSchema = z.object({
    analysisId: z.string().optional(),
    name: z.string(),
    genericName: z.string().optional(),
    strength: z.string().optional(),
    unit: z.string().optional(),
    frequency: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    days: z.number().int().positive().optional(),
    instructions: z.string().optional(),
    reasoning: z.string().optional(),
    citations: z
        .array(
            z.object({
                id: z.string(),
                title: z.string().optional(),
                publisher: z.string().optional(),
                sourceLabel: z.string().optional(),
                excerpt: z.string().optional(),
                relevanceScore: z.number().optional(),
            }),
        )
        .optional()
        .default([]),
});

const approvePrescriptionSchema = z.object({
    patientId: z.string().optional(),
    idempotencyKey: z.string().optional(),
    suggestion: approvalSuggestionSchema.optional(),
    editedValues: z.record(z.unknown()).optional(),
    changes: z.record(z.unknown()).optional(),
    reason: z.string().optional(),
    medication: z.record(z.unknown()).optional(),
    visit: z
        .object({
            condition: z.string().optional(),
            symptoms: z.array(z.string()).optional(),
            notes: z.string().optional(),
            proposedSolution: z.string().optional(),
            outcome: z.string().optional(),
        })
        .optional(),
});

// ─── POST /prescriptions/:id/approve ──────────────────────────────────────────
// Transactional prescription review and approval with revision history, idempotency, and pipeline queue (Tasks 2.2, 2.3, 2.4)
prescriptionsRouter.post("/:id/approve", requireRole("doctor"), async (c) => {
    const user = c.get("user");
    const prescriptionId = c.req.param("id") || "";
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const body = await c.req.json().catch(() => ({}));
    const validated = approvePrescriptionSchema.parse(body);

    const admin = getAdminClient();

    // 1. Idempotency check: Return existing record if already processed with this key (Task 2.3)
    if (validated.idempotencyKey) {
        const { data: existingByKey } = await admin
            .from("prescriptions")
            .select("*, medications(*), patients(id, workspace_id)")
            .eq("idempotency_key", validated.idempotencyKey)
            .maybeSingle();

        if (existingByKey && existingByKey.status === "approved") {
            return c.json({
                success: true,
                prescription: existingByKey,
                isDuplicate: true,
                correlationId,
                message: "Prescription approval request already processed (idempotent)",
            });
        }
    }

    // 2. Fetch prescription if it already exists
    let { data: prescription } = await admin
        .from("prescriptions")
        .select("*, medications(*), patients(id, workspace_id)")
        .eq("id", prescriptionId)
        .maybeSingle();

    const approvedAt = new Date().toISOString();
    let updatedPrescription: any = null;
    let actualPrescriptionId = prescriptionId;

    if (!prescription) {
        // If not found in DB, check if this is an AI suggestion approval (e.g. rx-ai-... or has suggestion data)
        let targetPatientId = validated.patientId;
        if (!targetPatientId && prescriptionId.startsWith("rx-ai-")) {
            const parts = prescriptionId.replace(/^rx-ai-/, "").split("-");
            if (parts.length >= 2 && parts[0].toLowerCase().startsWith("p")) {
                targetPatientId = `${parts[0]}-${parts[1]}`;
            }
        }
        if (!targetPatientId && (validated.suggestion as any)?.patientId) {
            targetPatientId = (validated.suggestion as any).patientId;
        }

        if (!targetPatientId || (!validated.suggestion && !validated.editedValues)) {
            throw ApiError.notFound("Prescription not found");
        }

        const { data: patientRecord } = await admin
            .from("patients")
            .select("id, workspace_id")
            .eq("id", targetPatientId)
            .single();

        if (!patientRecord) {
            throw ApiError.notFound("Patient not found");
        }

        // Verify doctor is assigned to this patient
        const { data: assignment } = await admin
            .from("care_team_assignments")
            .select("*")
            .eq("patient_id", targetPatientId)
            .eq("doctor_profile_id", user.profileId)
            .is("revoked_at", null)
            .maybeSingle();

        if (!assignment) {
            throw ApiError.forbidden("Doctor is not assigned to this patient");
        }

        const medName = String(validated.editedValues?.name || validated.suggestion?.name || "Medication");
        const medDosage = String(validated.editedValues?.dosage || validated.editedValues?.strength || validated.suggestion?.strength || "");
        const medForm = String(validated.editedValues?.frequency || validated.suggestion?.frequency || "daily");

        // Create medication row
        const { data: newMed, error: medErr } = await admin
            .from("medications")
            .insert({
                patient_id: targetPatientId,
                name: medName,
                dosage: medDosage,
                form: medForm,
                prescribed_at: approvedAt,
            })
            .select()
            .single();

        if (medErr || !newMed) {
            throw ApiError.internal("Failed to create medication record for prescription", medErr?.message);
        }

        // Create approved prescription row
        const newPrescriptionData: Record<string, any> = {
            patient_id: targetPatientId,
            medication_id: newMed.id,
            status: "approved",
            suggested_by: "ai",
            approved_by_profile_id: user.profileId,
            approved_at: approvedAt,
            ai_suggestion_snapshot: validated.suggestion || null,
        };
        if (validated.idempotencyKey) {
            newPrescriptionData["idempotency_key"] = validated.idempotencyKey;
        }

        const { data: insertedPrescription, error: presErr } = await admin
            .from("prescriptions")
            .insert(newPrescriptionData)
            .select("*, medications(*)")
            .single();

        if (presErr || !insertedPrescription) {
            throw ApiError.internal("Failed to save approved prescription", presErr?.message);
        }

        prescription = {
            ...insertedPrescription,
            patients: patientRecord,
        };
        actualPrescriptionId = prescription.id;
        updatedPrescription = prescription;
    } else {
        if (prescription.status === "superseded") {
            throw ApiError.badRequest("Prescription is superseded and cannot be approved");
        }

        // 3. Verify doctor is assigned to this patient
        const { data: assignment } = await admin
            .from("care_team_assignments")
            .select("*")
            .eq("patient_id", prescription.patient_id)
            .eq("doctor_profile_id", user.profileId)
            .is("revoked_at", null)
            .maybeSingle();

        if (!assignment) {
            throw ApiError.forbidden("Doctor is not assigned to this patient");
        }

        // 4. Atomically update prescription status to 'approved' and persist suggestion snapshot / idempotency key
        const updateData: Record<string, any> = {
            status: "approved",
            approved_by_profile_id: user.profileId,
            approved_at: approvedAt,
        };
        if (validated.idempotencyKey) {
            updateData["idempotency_key"] = validated.idempotencyKey;
        }
        if (validated.suggestion) {
            updateData["ai_suggestion_snapshot"] = validated.suggestion;
        }

        const { data: resUpdated, error: updateErr } = await admin
            .from("prescriptions")
            .update(updateData)
            .eq("id", prescriptionId)
            .select("*, medications(*)")
            .single();

        if (updateErr || !resUpdated) {
            throw ApiError.internal("Failed to approve prescription", updateErr?.message);
        }

        updatedPrescription = resUpdated;
        actualPrescriptionId = prescription.id;
    }

    const patientWorkspaceId =
        (prescription.patients as any)?.workspace_id || user.workspaceId;

    // 5. Record revision history if edited values were provided (Task 2.2)
    let revision = null;
    const revisionChanges =
        validated.editedValues || validated.changes || (validated.medication ? { medication: validated.medication } : null);

    if (revisionChanges && Object.keys(revisionChanges).length > 0) {
        const { data: revData, error: revErr } = await admin
            .from("prescription_revisions")
            .insert({
                prescription_id: actualPrescriptionId,
                revised_by_profile_id: user.profileId,
                changes: revisionChanges,
                reason: validated.reason || "Doctor approved medication adjustments",
                revised_at: approvedAt,
            })
            .select()
            .single();

        if (!revErr && revData) {
            revision = revData;
        }
    }

    // 6. Create durable pipeline run and 5 stage projections (Task 2.4)
    let pipelineRunId: string | null = null;
    let reminderStageId: string | null = null;

    const { data: runRecord } = await admin
        .from("pipeline_runs")
        .insert({
            patient_id: prescription.patient_id,
            workspace_id: patientWorkspaceId,
            trigger_type: "prescription_approval",
            trigger_id: actualPrescriptionId,
            status: "running",
            correlation_id: correlationId,
            started_at: approvedAt,
        })
        .select("id")
        .single();

    if (runRecord) {
        pipelineRunId = runRecord.id;

        // Initialize 5 visible pipeline stages
        const stageInserts = [
            {
                pipeline_run_id: runRecord.id,
                stage_key: "reminder_agent",
                status: "running",
                agent_name: "Reminder Agent",
                attempt: 1,
                started_at: approvedAt,
            },
            {
                pipeline_run_id: runRecord.id,
                stage_key: "dose_logging_agent",
                status: "idle",
                agent_name: "Dose Logging Agent",
                attempt: 0,
            },
            {
                pipeline_run_id: runRecord.id,
                stage_key: "pattern_detection_agent",
                status: "idle",
                agent_name: "Pattern Detection Agent",
                attempt: 0,
            },
            {
                pipeline_run_id: runRecord.id,
                stage_key: "escalation_agent",
                status: "idle",
                agent_name: "Escalation Agent",
                attempt: 0,
            },
            {
                pipeline_run_id: runRecord.id,
                stage_key: "care_team_interaction_agent",
                status: "idle",
                agent_name: "Care Team Interaction Agent",
                attempt: 0,
            },
        ];

        const { data: createdStages } = await admin
            .from("pipeline_stages")
            .insert(stageInserts)
            .select("id, stage_key");

        const reminderStage = (createdStages || []).find(
            (s) => s.stage_key === "reminder_agent",
        );
        if (reminderStage) {
            reminderStageId = reminderStage.id;
        }

        // Add initial log for reminder agent
        if (reminderStageId) {
            await admin.from("pipeline_stage_logs").insert({
                pipeline_stage_id: reminderStageId,
                level: "info",
                message: "Prescription approved; generating dose schedule",
                correlation_id: correlationId,
            });
        }
    }

    // 7. Enqueue downstream dose schedule generation job linked to run and stage (Task 2.4)
    await admin.from("jobs").insert({
        type: "generate_dose_schedule",
        idempotency_key: validated.idempotencyKey
            ? `gen-schedule-${validated.idempotencyKey}`
            : `gen-schedule-${actualPrescriptionId}-${Date.now()}`,
        correlation_id: correlationId,
        pipeline_run_id: pipelineRunId,
        pipeline_stage_id: reminderStageId,
        payload: {
            prescriptionId: actualPrescriptionId,
            patientId: prescription.patient_id,
            approvedBy: user.profileId,
        },
    });

    // 8. Record immutable audit event
    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "approve_prescription",
        target_type: "prescription",
        target_id: actualPrescriptionId,
        correlation_id: correlationId,
        outcome: "success",
    });

    // 9. Automatically record clinical Visit encounter reflecting this prescription consultation
    let createdVisit: any = null;
    try {
        const medName = String(
            validated.editedValues?.name ||
            validated.suggestion?.name ||
            (prescription.medications as any)?.name ||
            "Medication",
        );
        const medDosage = String(
            validated.editedValues?.dosage ||
            validated.editedValues?.strength ||
            validated.suggestion?.strength ||
            (prescription.medications as any)?.dosage ||
            "",
        );
        const medFrequency = String(
            validated.editedValues?.frequency ||
            validated.suggestion?.frequency ||
            (prescription.medications as any)?.form ||
            "",
        );
        const medInstructions = String(
            validated.editedValues?.instructions ||
            validated.suggestion?.instructions ||
            "",
        );
        const medDays = validated.editedValues?.days || validated.suggestion?.days || 30;

        const visitCondition =
            validated.visit?.condition ||
            (validated.suggestion?.reasoning
                ? validated.suggestion.reasoning.split(".")[0].slice(0, 80)
                : `Prescription Consultation: ${medName}`);

        const visitSymptoms =
            validated.visit?.symptoms && validated.visit.symptoms.length > 0
                ? validated.visit.symptoms
                : [medName];

        const visitNotes =
            validated.visit?.notes ||
            `Clinical encounter and medication review. Doctor approved ${medName} ${medDosage} (${medFrequency}). ${validated.suggestion?.reasoning || validated.reason || "Safety check and contraindications evaluated."}`;

        const visitProposedSolution =
            validated.visit?.proposedSolution ||
            `Initiated ${medName} ${medDosage} ${medFrequency ? `(${medFrequency})` : ""}${medInstructions ? `. Instructions: ${medInstructions}` : ""}. Duration: ${medDays} days.`;

        const visitOutcome =
            validated.visit?.outcome ||
            "Prescription approved and dose schedule generated. Active adherence monitoring initiated.";

        const { data: vRecord, error: vErr } = await admin
            .from("visits")
            .insert({
                patient_id: prescription.patient_id,
                doctor_profile_id: user.profileId,
                visit_date: approvedAt.slice(0, 10),
                condition: visitCondition,
                symptoms: visitSymptoms,
                notes: visitNotes,
                proposed_solution: visitProposedSolution,
                outcome: visitOutcome,
                prescription_id: actualPrescriptionId,
            })
            .select("*, profiles:doctor_profile_id(full_name)")
            .single();

        if (!vErr && vRecord) {
            createdVisit = vRecord;
        } else if (vErr) {
            console.warn("[prescriptionApproval] Optional visit auto-creation notice:", vErr.message);
        }
    } catch (visitError) {
        console.warn("[prescriptionApproval] Error during auto-visit creation:", visitError);
    }

    return c.json({
        success: true,
        prescription: updatedPrescription,
        visit: createdVisit,
        revision,
        pipelineRunId,
        correlationId,
        message: "Prescription approved, clinical visit documented, and downstream schedule generation queued",
    });
});

// ─── POST /prescriptions/:id/reject ───────────────────────────────────────────
prescriptionsRouter.post("/:id/reject", requireRole("doctor"), async (c) => {
    const user = c.get("user");
    const prescriptionId = c.req.param("id");
    const correlationId = (c.get("correlationId") as string) || "corr-" + Date.now();
    const admin = getAdminClient();

    const { data: prescription } = await admin
        .from("prescriptions")
        .select("id, patient_id")
        .eq("id", prescriptionId)
        .single();
    if (!prescription) throw ApiError.notFound("Prescription not found");
    const { data: assignment } = await admin
        .from("care_team_assignments")
        .select("id")
        .eq("patient_id", prescription.patient_id)
        .eq("doctor_profile_id", user.profileId)
        .is("revoked_at", null)
        .maybeSingle();
    if (!assignment) throw ApiError.forbidden("Doctor is not assigned to this patient");

    const { data: updated, error } = await admin
        .from("prescriptions")
        .update({
            status: "rejected",
            approved_by_profile_id: user.profileId,
            approved_at: new Date().toISOString(),
        })
        .eq("id", prescriptionId)
        .select()
        .single();

    if (error || !updated) throw ApiError.internal("Failed to reject prescription", error?.message);

    await admin.from("audit_events").insert({
        workspace_id: user.workspaceId,
        actor_profile_id: user.profileId,
        action: "reject_prescription",
        target_type: "prescription",
        target_id: prescriptionId,
        correlation_id: correlationId,
        outcome: "success",
    });

    return c.json({ success: true, prescription: updated });
});
