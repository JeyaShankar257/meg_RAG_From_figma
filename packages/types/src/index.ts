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
    | "create_escalation";

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
