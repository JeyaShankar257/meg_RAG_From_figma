/**
 * Versioned agent job/result contracts shared between TypeScript and Python.
 * These are the ONLY types that cross the TypeScript↔Python boundary.
 * Version must be bumped on any breaking structural change.
 */

import { z } from "zod";

export const CONTRACT_VERSION = "1.0" as const;

// ─── Agent Job ────────────────────────────────────────────────────────────────

export type AgentJobType =
    | "rag_analysis"
    | "adherence_pattern_detection"
    | "escalation_recommendation";

export interface AgentJob {
    /** Matches the durable job table id */
    jobId: string;
    type: AgentJobType;
    /** Contract schema version — Python must reject versions it cannot handle */
    contractVersion: typeof CONTRACT_VERSION;
    patientId: string;
    workspaceId: string;
    /** Links multiple agent jobs spawned from the same user action */
    correlationId: string;
    attempt: number;
    payload: AgentJobPayload;
    createdAt: string;
}

// ─── Payload variants by type ─────────────────────────────────────────────────

export interface RagAnalysisPayload {
    symptoms: string[];
    clinicalQuestion: string;
    /** Authorized patient context snapshot — redacted to permitted fields */
    patientContextSnapshot: {
        conditions: string[];
        currentMedications: string[];
        recentVisitSummary?: string;
    };
    /** IDs of knowledge chunks authorized for retrieval */
    authorizedChunkIds?: string[];
}

export interface AdherencePatternPayload {
    windowDays: number;
    doseLogIds: string[];
    adherenceRate: number;
}

export interface EscalationRecommendationPayload {
    analysisId: string;
    adherenceRate: number;
    missedDoses: number;
    symptoms?: string[];
}

export type AgentJobPayload =
    | RagAnalysisPayload
    | AdherencePatternPayload
    | EscalationRecommendationPayload;

// ─── Agent Result ─────────────────────────────────────────────────────────────

export type AgentResultStatus =
    | "completed"
    | "needs_review"
    | "failed_retryable"
    | "failed_terminal";

export interface AgentResult {
    jobId: string;
    contractVersion: typeof CONTRACT_VERSION;
    status: AgentResultStatus;
    /** Structured clinical output — shape is per job type */
    structuredOutput?: Record<string, unknown>;
    confidence?: number;
    /** IDs of evidence chunks cited (for RAG jobs) */
    evidenceIds?: string[];
    safetyFlags?: string[];
    reasoning?: string;
    modelVersion: string;
    promptVersion: string;
    requiresDoctorReview: boolean;
    /** Set only on failed_retryable — worker will schedule retry */
    retryAfterSeconds?: number;
    errorMessage?: string;
    completedAt: string;
}

// ─── RAG-specific structured output ──────────────────────────────────────────

export interface RagAnalysisOutput {
    summary: string;
    recommendations: string[];
    citations: Array<{
        chunkId: string;
        sourceLabel: string;
        excerpt: string;
        relevance: number;
    }>;
    differentials?: string[];
    uncertaintyNotes?: string;
}

// ─── Escalation recommendation output ────────────────────────────────────────

export interface EscalationOutput {
    escalate: boolean;
    severity: "low" | "medium" | "high" | "critical";
    reasoning: string;
    recommendedAction?: string;
}

export const agentJobSchema = z.object({
    jobId: z.string().min(1),
    type: z.enum([
        "rag_analysis",
        "adherence_pattern_detection",
        "escalation_recommendation",
    ]),
    contractVersion: z.literal(CONTRACT_VERSION),
    patientId: z.string().min(1),
    workspaceId: z.string().min(1),
    correlationId: z.string().min(1).max(128),
    attempt: z.number().int().min(1),
    payload: z.record(z.unknown()),
    createdAt: z.string().datetime({ offset: true }),
});

export const agentResultSchema = z.object({
    jobId: z.string().min(1),
    contractVersion: z.literal(CONTRACT_VERSION),
    status: z.enum([
        "completed",
        "needs_review",
        "failed_retryable",
        "failed_terminal",
    ]),
    structuredOutput: z.record(z.unknown()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    evidenceIds: z.array(z.string()).optional(),
    safetyFlags: z.array(z.string()).optional(),
    reasoning: z.string().optional(),
    modelVersion: z.string(),
    promptVersion: z.string(),
    requiresDoctorReview: z.boolean(),
    retryAfterSeconds: z.number().int().positive().optional(),
    errorMessage: z.string().optional(),
    completedAt: z.string().datetime({ offset: true }),
});

// ─── Patient Portal Contracts & Schemas ─────────────────────────────────────

export const patientDailyDoseScheduleSchema = z.object({
    id: z.string().uuid(),
    patientId: z.string().min(1),
    prescriptionId: z.string().min(1),
    medicationName: z.string().min(1),
    dosage: z.string(),
    scheduledTime: z.string(),
    scheduledAt: z.string(),
    windowMinutes: z.number().int().nonnegative(),
    status: z.enum(["scheduled", "taken", "missed", "late", "skipped"]),
    loggedAt: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
});

export const patientDoseSchedulesResponseSchema = z.object({
    patientId: z.string().min(1),
    date: z.string(),
    schedules: z.array(patientDailyDoseScheduleSchema),
    correlationId: z.string(),
});

export const doseLogSchema = z.object({
    id: z.string(),
    scheduleId: z.string(),
    patientId: z.string(),
    status: z.enum(["pending", "taken", "late", "missed", "skipped"]),
    method: z.enum(["oral", "injection", "patch", "other"]).optional(),
    reason: z.string().optional(),
    idempotencyKey: z.string(),
    loggedAt: z.string(),
});

export const patientAdherenceSummarySchema = z.object({
    patientId: z.string().min(1),
    score: z.number().min(0).max(100),
    takenPercentage: z.number().min(0).max(100),
    latePercentage: z.number().min(0).max(100),
    missedPercentage: z.number().min(0).max(100),
    skippedPercentage: z.number().min(0).max(100),
    takenCount: z.number().int().nonnegative(),
    lateCount: z.number().int().nonnegative(),
    missedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    currentStreakDays: z.number().int().nonnegative(),
    trend: z.enum(["up", "down", "stable"]),
    calculatedAt: z.string(),
    logs: z.array(doseLogSchema),
});

export const transparencyTrustSignalSchema = z.object({
    category: z.string(),
    label: z.string(),
    status: z.enum(["verified", "active", "monitored"]),
    description: z.string(),
    lastVerifiedAt: z.string(),
});

export const transparencyAuditSummarySchema = z.object({
    id: z.string(),
    action: z.string(),
    actorRole: z.string(),
    description: z.string(),
    occurredAt: z.string(),
});

export const patientTransparencyResponseSchema = z.object({
    patientId: z.string().min(1),
    consent: z
        .object({
            id: z.string(),
            patientId: z.string(),
            shareWithCareTeam: z.boolean(),
            allowReminders: z.boolean(),
            allowAiAnalysis: z.boolean(),
            updatedByProfileId: z.string(),
            updatedAt: z.string(),
        })
        .nullable(),
    trustSignals: z.array(transparencyTrustSignalSchema),
    recentAudits: z.array(transparencyAuditSummarySchema),
    assuranceScore: z.number().min(0).max(100),
    freshnessTimestamp: z.string(),
    correlationId: z.string(),
});

export * from "./pipeline-stages.js";

