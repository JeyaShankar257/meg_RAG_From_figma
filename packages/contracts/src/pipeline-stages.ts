/**
 * Event-driven job type to visible pipeline stage mapping.
 *
 * Workers process independent domain events. Each job type maps to exactly one
 * of the five doctor-facing pipeline stages. This mapping is the source of truth
 * for translating worker outcomes into the patient pipeline projection.
 *
 * Stage keys match the `pipeline_stage_key` enum in the database migration
 * (0006_doctor_portal_pipeline.sql) and the `PipelineStageKey` type in
 * @mednova/types.
 */

import type { PipelineStageKey } from "@mednova/types";

// ─── Event-driven job types that map to pipeline stages ──────────────────────

export type PipelineJobType =
    | "generate_dose_schedule"
    | "send_reminder"
    | "dose_validation"
    | "dose_logging"
    | "adherence_analysis"
    | "adherence_pattern_detection"
    | "dispatch_ai_analysis"
    | "escalation_creation"
    | "escalation_update"
    | "care_team_acknowledgement"
    | "care_team_outreach"
    | "generate_report";

// ─── Job type → visible stage mapping ────────────────────────────────────────

export const JOB_TYPE_TO_STAGE: Record<PipelineJobType, PipelineStageKey> = {
    // Reminder Agent ← schedule generation and reminder jobs
    generate_dose_schedule: "reminder_agent",
    send_reminder: "reminder_agent",

    // Dose Logging Agent ← dose validation/logging events
    dose_validation: "dose_logging_agent",
    dose_logging: "dose_logging_agent",

    // Pattern Detection Agent ← adherence analysis and AI result jobs
    adherence_analysis: "pattern_detection_agent",
    adherence_pattern_detection: "pattern_detection_agent",
    dispatch_ai_analysis: "pattern_detection_agent",

    // Escalation Agent ← escalation creation/update events
    escalation_creation: "escalation_agent",
    escalation_update: "escalation_agent",

    // Care Team Interaction ← acknowledgement, outreach, and report jobs
    care_team_acknowledgement: "care_team_interaction_agent",
    care_team_outreach: "care_team_interaction_agent",
    generate_report: "care_team_interaction_agent",
};

// ─── Stage display names (canonical) ─────────────────────────────────────────

export const STAGE_AGENT_NAMES: Record<PipelineStageKey, string> = {
    reminder_agent: "Dose Reminder Agent",
    pattern_detection_agent: "Pattern Detection Agent",
    patient_warning_agent: "Patient Health Warning Agent",
    sos_agent: "Doctor & Guardian SOS Agent",
    dose_logging_agent: "Dose Logging Agent",
    escalation_agent: "Escalation Agent",
    care_team_interaction_agent: "Care Team Interaction Agent",
};

/** All canonical four stage keys in closed-loop display order */
export const PIPELINE_4_STAGE_ORDER: PipelineStageKey[] = [
    "reminder_agent",
    "pattern_detection_agent",
    "patient_warning_agent",
    "sos_agent",
];

/** All stage keys in display order (including legacy) */
export const PIPELINE_STAGE_ORDER: PipelineStageKey[] = [
    "reminder_agent",
    "pattern_detection_agent",
    "patient_warning_agent",
    "sos_agent",
    "dose_logging_agent",
    "escalation_agent",
    "care_team_interaction_agent",
];

/**
 * Resolves a job type string to its mapped pipeline stage key.
 * Returns undefined for job types not associated with a pipeline stage.
 */
export function resolveStageKey(jobType: string): PipelineStageKey | undefined {
    return JOB_TYPE_TO_STAGE[jobType as PipelineJobType];
}

/**
 * Returns true if the given job type is one that maps to a pipeline stage.
 */
export function isPipelineJobType(jobType: string): jobType is PipelineJobType {
    return jobType in JOB_TYPE_TO_STAGE;
}
