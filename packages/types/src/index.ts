// ─── Workspace / User Identity ────────────────────────────────────────────────

export type UserRole = "doctor" | "patient" | "care_team" | "admin";

export interface Workspace {
    id: string;
    name: string;
    createdAt: string;
}

export interface UserProfile {
    id: string;          // Supabase auth UID
    workspaceId: string;
    role: UserRole;
    fullName: string;
    email: string;
    createdAt: string;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export type PatientStatus = "pending" | "active" | "inactive";

export interface Patient {
    id: string;                // system-generated MRN-style ID
    workspaceId: string;
    profileId: string;         // links to UserProfile when activated
    status: PatientStatus;
    fullName: string;
    dateOfBirth: string;
    contactEmail: string;
    contactPhone?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CareTeamAssignment {
    id: string;
    patientId: string;
    doctorProfileId: string;
    assignedAt: string;
    revokedAt?: string;
}

// ─── Clinical Records ─────────────────────────────────────────────────────────

export interface Visit {
    id: string;
    patientId: string;
    doctorProfileId: string;
    visitDate: string;
    notes?: string;
    createdAt: string;
}

export interface Condition {
    id: string;
    patientId: string;
    name: string;
    diagnosedAt?: string;
}

export interface Medication {
    id: string;
    patientId: string;
    name: string;
    dosage: string;
    form: string;
    prescribedAt: string;
}

export type PrescriptionStatus = "pending_review" | "approved" | "rejected" | "superseded";

export interface Prescription {
    id: string;
    patientId: string;
    medicationId: string;
    status: PrescriptionStatus;
    suggestedBy?: string;       // "ai" | doctor profile ID
    approvedByProfileId?: string;
    approvedAt?: string;
    createdAt: string;
}

export interface PrescriptionRevision {
    id: string;
    prescriptionId: string;
    revisedByProfileId: string;
    changes: Record<string, unknown>;
    revisedAt: string;
}

export interface DoseSchedule {
    id: string;
    prescriptionId: string;
    patientId: string;
    scheduledAt: string; // ISO datetime
    windowMinutes: number;
}

export type DoseStatus = "pending" | "taken" | "missed" | "skipped";
export type DoseMethod = "oral" | "injection" | "patch" | "other";

export interface DoseLog {
    id: string;
    scheduleId: string;
    patientId: string;
    status: DoseStatus;
    method?: DoseMethod;
    reason?: string;
    idempotencyKey: string;
    loggedAt: string;           // authoritative server timestamp
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportReviewStatus = "unreviewed" | "reviewed";

export interface PatientReport {
    id: string;
    patientId: string;
    uploaderProfileId: string;
    storagePath: string;        // private bucket object path
    mimeType: string;
    sizeBytes: number;
    label: string;
    reviewStatus: ReportReviewStatus;
    reviewedByProfileId?: string;
    reviewedAt?: string;
    sharedWithCareTeam: boolean;
    uploadedAt: string;
}

// ─── Consent & Preferences ───────────────────────────────────────────────────

export interface ConsentRecord {
    id: string;
    patientId: string;
    shareWithCareTeam: boolean;
    allowReminders: boolean;
    allowAiAnalysis: boolean;
    updatedByProfileId: string;
    updatedAt: string;
}

export interface NotificationPreference {
    id: string;
    patientId: string;
    channel: "email" | "sms" | "push";
    enabled: boolean;
    quietHoursStart?: string;  // "HH:MM"
    quietHoursEnd?: string;
    updatedAt: string;
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export type AnalysisStatus = "pending" | "running" | "completed" | "error" | "needs_review";

export interface AiAnalysis {
    id: string;
    patientId: string;
    requestedByProfileId: string;
    status: AnalysisStatus;
    inputSnapshot: Record<string, unknown>;
    structuredOutput?: Record<string, unknown>;
    confidence?: number;
    safetyFlags?: string[];
    modelVersion?: string;
    promptVersion?: string;
    requiresDoctorReview: boolean;
    reviewedByProfileId?: string;
    reviewedAt?: string;
    createdAt: string;
    completedAt?: string;
}

export interface AiCitation {
    id: string;
    analysisId: string;
    sourceLabel: string;
    excerpt: string;
    relevanceScore: number;
}

// ─── Escalations ─────────────────────────────────────────────────────────────

export type EscalationSeverity = "low" | "medium" | "high" | "critical";
export type EscalationStatus = "open" | "acknowledged" | "resolved";

export interface Escalation {
    id: string;
    patientId: string;
    analysisId?: string;
    severity: EscalationSeverity;
    status: EscalationStatus;
    reasoning: string;
    confidence: number;
    modelVersion: string;
    acknowledgedByProfileId?: string;
    acknowledgedAt?: string;
    createdAt: string;
}

// ─── Jobs (Durable Work Queue) ────────────────────────────────────────────────

export type JobType =
    | "send_activation_email"
    | "send_reminder"
    | "process_delivery_webhook"
    | "aggregate_adherence"
    | "dispatch_ai_analysis"
    | "generate_report"
    | "create_escalation"
    | "generate_dose_schedule"
    | "pipeline_stage_update"
    | "adherence_pattern_detection";

export type JobStatus = "pending" | "claimed" | "completed" | "failed" | "dead_letter";

export interface Job {
    id: string;
    type: JobType;
    payload: Record<string, unknown>;
    status: JobStatus;
    idempotencyKey: string;
    correlationId: string;
    attempts: number;
    maxAttempts: number;
    nextRunAt: string;
    claimedAt?: string;
    completedAt?: string;
    lastError?: string;
    createdAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationStatus = "queued" | "sent" | "delivered" | "bounced" | "failed";

export interface Notification {
    id: string;
    patientId: string;
    jobId: string;
    channel: "email" | "sms" | "push";
    providerMessageId?: string;
    status: NotificationStatus;
    sentAt?: string;
    deliveredAt?: string;
    createdAt: string;
}

// ─── Corrections ──────────────────────────────────────────────────────────────

export type CorrectionTargetType = "dose_log" | "adherence" | "patient_report" | "ai_analysis";
export type CorrectionStatus = "open" | "under_review" | "resolved" | "rejected";

export interface CorrectionRequest {
    id: string;
    patientId: string;
    requestedByProfileId: string;
    targetType: CorrectionTargetType;
    targetId: string;
    description: string;
    status: CorrectionStatus;
    createdAt: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditAction =
    | "auth.login"
    | "auth.logout"
    | "auth.token_refresh"
    | "record.read"
    | "record.create"
    | "record.update"
    | "prescription.approve"
    | "dose.log"
    | "ai.request"
    | "ai.complete"
    | "report.upload"
    | "report.view"
    | "consent.change"
    | "correction.request"
    | "audit.query";

export interface AuditEvent {
    id: string;
    workspaceId?: string;
    actorProfileId?: string;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    correlationId: string;
    outcome: "success" | "denied" | "error";
    occurredAt: string;
}

// ─── Pipeline Types (Doctor Portal Backend) ──────────────────────────────────

export type PipelineRunStatus = "pending" | "running" | "completed" | "failed";

export type PipelineStageKey =
    | "reminder_agent"
    | "dose_logging_agent"
    | "pattern_detection_agent"
    | "escalation_agent"
    | "care_team_interaction_agent";

export type PipelineStageStatus = "idle" | "running" | "complete" | "error" | "retrying";

export type PipelineLogLevel = "info" | "warn" | "error";

export interface PipelineRun {
    id: string;
    patientId: string;
    workspaceId: string;
    triggerType: string;
    triggerId?: string;
    status: PipelineRunStatus;
    correlationId: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    lastError?: string;
}

export interface PipelineStage {
    id: string;
    pipelineRunId: string;
    stageKey: PipelineStageKey;
    status: PipelineStageStatus;
    agentName: string;
    attempt: number;
    lastJobId?: string;
    startedAt?: string;
    completedAt?: string;
    lastError?: string;
    updatedAt: string;
}

export interface PipelineStageLog {
    id: string;
    pipelineStageId: string;
    jobId?: string;
    level: PipelineLogLevel;
    message: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    createdAt: string;
}

/** Visible stage name mapping for doctor-facing five-stage display */
export const PIPELINE_STAGE_DISPLAY: Record<PipelineStageKey, string> = {
    reminder_agent: "Reminder Agent",
    dose_logging_agent: "Dose Logging Agent",
    pattern_detection_agent: "Pattern Detection Agent",
    escalation_agent: "Escalation Agent",
    care_team_interaction_agent: "Care Team Interaction",
};

// ─── Doctor Dashboard Aggregates ──────────────────────────────────────────────

export type MetricAvailability = "available" | "unavailable" | "error";

export interface DashboardMetric<T> {
    value: T;
    availability: MetricAvailability;
    errorMessage?: string;
}

export interface DashboardActivity {
    id: string;
    type: string;
    description: string;
    patientId?: string;
    patientName?: string;
    timestamp: string;
    correlationId?: string;
}

export interface DoctorDashboardResponse {
    patientCount: DashboardMetric<number>;
    averageAdherence: DashboardMetric<number>;
    openEscalations: DashboardMetric<number>;
    remindersDelivered: DashboardMetric<number>;
    recentActivity: DashboardActivity[];
    freshnessTimestamp: string;
    correlationId: string;
}

// ─── Pipeline Status & Logs Response ──────────────────────────────────────────

export interface PipelineStageWithLogs extends PipelineStage {
    logs: PipelineStageLog[];
}

export interface PatientPipelineResponse {
    run: PipelineRun | null;
    stages: PipelineStageWithLogs[];
    correlationId: string;
}

// ─── Approval Payloads ────────────────────────────────────────────────────────

export interface ApprovalSuggestionData {
    analysisId?: string;
    name: string;
    genericName: string;
    strength: string;
    unit: string;
    frequency: string;
    quantity: number;
    days: number;
    instructions: string;
    reasoning: string;
    citations: Array<{ id: string; title: string; publisher: string }>;
}

export interface ApprovalRequest {
    idempotencyKey: string;
    suggestion: ApprovalSuggestionData;
    editedValues?: Record<string, unknown>;
}

export interface ApprovalResponse {
    success: boolean;
    prescription: Prescription;
    revision?: PrescriptionRevision;
    pipelineRunId?: string;
    correlationId: string;
    isDuplicate?: boolean;
}

// ─── Doctor Preferences ───────────────────────────────────────────────────────

export interface DoctorNotificationPreferences {
    channels: Array<"email" | "sms" | "push">;
    quietHoursStart?: string;  // "HH:MM"
    quietHoursEnd?: string;    // "HH:MM"
}

export interface DoctorProfilePreferences {
    displayName?: string;
    specialty?: string;
    phone?: string;
    notification: DoctorNotificationPreferences;
}

export interface DoctorSettingsResponse {
    profile: {
        id: string;
        fullName: string;
        email: string;
        role: UserRole;
    };
    preferences: DoctorProfilePreferences;
    correlationId: string;
}

// ─── Typed Recoverable API Errors ─────────────────────────────────────────────

export type RecoverableErrorCode =
    | "validation_error"
    | "authorization_error"
    | "not_found"
    | "conflict"
    | "service_unavailable"
    | "internal_error";

export interface RecoverableApiError {
    error: RecoverableErrorCode;
    message: string;
    correlationId: string;
    retryable: boolean;
    details?: Array<{ path: string; message: string }>;
}

// ─── RAG Knowledge & Vector Search ───────────────────────────────────────────

export type RagSourceType =
    | "guideline"
    | "research"
    | "patient_visit"
    | "patient_report"
    | "medication_reference";

export type KnowledgeSourceStatus = "draft" | "reviewed" | "archived";

export interface KnowledgeSource {
    id: string;
    sourceType: RagSourceType;
    title: string;
    publisher?: string;
    publicationDate?: string;
    url?: string;
    workspaceId: string;
    patientId?: string | null;
    reportId?: string | null;
    version: string;
    status: KnowledgeSourceStatus;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface KnowledgeChunk {
    id: string;
    sourceId: string;
    workspaceId: string;
    patientId?: string | null;
    chunkIndex: number;
    chunkText: string;
    embedding: number[];
    embeddingModel: string;
    embeddingVersion: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}

export type RagQueryStatus = "pending" | "running" | "completed" | "error";

export interface RagQuery {
    id: string;
    workspaceId: string;
    patientId: string;
    requestedByProfileId: string;
    analysisId?: string | null;
    symptoms: string;
    question?: string;
    queryText: string;
    queryEmbedding?: number[];
    embeddingModel: string;
    embeddingVersion: string;
    topK: number;
    similarityThreshold: number;
    status: RagQueryStatus;
    correlationId: string;
    createdAt: string;
    completedAt?: string;
    lastError?: string;
}

export interface RagResult {
    id: string;
    queryId: string;
    chunkId: string;
    sourceId: string;
    rank: number;
    similarityScore: number;
    excerpt: string;
    createdAt: string;
}

export type DocumentIndexingStatus = "uploaded" | "indexing" | "searchable" | "failed";

export interface DocumentIndexingJob {
    id: string;
    workspaceId: string;
    patientId: string;
    reportId: string;
    sourceId?: string | null;
    status: DocumentIndexingStatus;
    attempts: number;
    maxAttempts: number;
    idempotencyKey: string;
    correlationId: string;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export type RagEvidenceStatus = "sufficient" | "limited" | "insufficient" | "conflicting";

export interface RetrievedEvidence {
    sourceId: string;
    chunkId?: string;
    title: string;
    sourceType: RagSourceType;
    sourceTier?: "patient_record" | "external_mcp";
    publisher?: string;
    date?: string;
    url?: string;
    excerpt: string;
    relevanceNote?: string;
    similarityScore?: number;
}

export interface RagAnalysisRequest {
    patientId: string;
    symptoms: string;
    question?: string;
}

export interface Citation {
    id: string;
    analysisId?: string;
    sourceLabel: string;
    excerpt: string;
    relevanceScore: number;
    url?: string;
    publicationDate?: string;
    sourceTier?: "patient_record" | "external_mcp";
}

export interface AIPrescriptionSuggestion {
    name: string;
    genericName: string;
    strength: string;
    unit: string;
    frequency: string;
    quantity: number;
    days: number;
    instructions: string;
    reasoning: string;
    citations: Citation[];
    safetyCheck?: {
        status: "verified" | "warning" | "unavailable";
        source: string;
        details: string;
        interactions?: string[];
    };
}

export interface AIAnalysis {
    id: string;
    type: "diagnostic" | "pattern";
    status: "pending" | "running" | "complete" | "error";
    confidence: number;
    severity?: "none" | "mild" | "concerning" | "urgent";
    rootCause?: string;
    hypothesis: string;
    explanation: string;
    safetyFlags: string[];
    citations: Citation[];
    relatedVisits: string[];
    modelVersion: string;
    createdAt: string;
    reviewed?: boolean;
    suggestedMedications?: AIPrescriptionSuggestion[];
    retrievedEvidence?: RetrievedEvidence[];
    ragQueryId?: string;
    promptVersion?: string;
    evidenceStatus?: RagEvidenceStatus;
}

export interface RagAnalysisResponse {
    id: string;
    status: "pending" | "running" | "complete" | "error";
    evidence: RetrievedEvidence[];
    analysis?: AIAnalysis;
    error?: string;
    evidenceStatus?: RagEvidenceStatus;
    correlationId?: string;
    retryable?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// ─── Patient Portal Types ───────────────────────────────────────────────────

export type PatientDoseStatus = "scheduled" | "taken" | "missed" | "late" | "skipped";

export interface PatientDailyDoseSchedule {
    id: string; // UUID schedule ID
    patientId: string;
    prescriptionId: string;
    medicationName: string;
    dosage: string;
    scheduledTime: string; // e.g. "08:00 AM" or ISO string
    scheduledAt: string; // ISO datetime
    windowMinutes: number;
    status: PatientDoseStatus;
    loggedAt?: string | null;
    reason?: string | null;
}

export interface PatientAdherenceSummary {
    patientId: string;
    score: number; // overall percentage (0-100)
    takenPercentage: number;
    latePercentage: number;
    missedPercentage: number;
    skippedPercentage: number;
    takenCount: number;
    lateCount: number;
    missedCount: number;
    skippedCount: number;
    currentStreakDays: number;
    trend: "up" | "down" | "stable";
    calculatedAt: string;
    logs: DoseLog[];
}

export interface TransparencyTrustSignal {
    category: string;
    label: string;
    status: "verified" | "active" | "monitored";
    description: string;
    lastVerifiedAt: string;
}

export interface TransparencyAuditSummary {
    id: string;
    action: string;
    actorRole: string;
    description: string;
    occurredAt: string;
}

export interface PatientTransparencyResponse {
    patientId: string;
    consent: ConsentRecord | null;
    trustSignals: TransparencyTrustSignal[];
    recentAudits: TransparencyAuditSummary[];
    assuranceScore: number;
    freshnessTimestamp: string;
    correlationId: string;
}

