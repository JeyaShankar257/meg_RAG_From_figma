export type UserRole = "doctor" | "patient" | "care_team" | "admin";

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  avatar?: string;
}

export interface Patient {
  id: string;
  patientId: string; // PT-00231 format
  name: string;
  email: string;
  dob: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  status: "active" | "invited" | "pending";
  assignedDoctor: string;
  careTeam: string[];
  conditions: string[];
  adherenceScore: number;
  trend: "up" | "down" | "stable";
  hasEscalation: boolean;
  lastVisit: string;
  avatar?: string;
}

export interface Visit {
  id: string;
  patientId: string;
  date: string;
  condition: string;
  symptoms: string[];
  notes: string;
  proposedSolution: string;
  outcome: string;
  relatedVisits?: string[];
  doctor: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  unit: string;
  frequency: string;
  quantity: number;
  duration: string;
  instructions: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "paused";
  prescribedBy: string;
  contraindications?: string[];
  nextDose?: string;
}

export interface DoseLog {
  date: string;
  status: "taken" | "late" | "skipped" | "missed";
  timestamp?: string;
  method?: string;
  reason?: string;
}

export interface AdherenceData {
  score: number;
  trend: number; // percentage change
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  deliveryFailures: number;
  logs: DoseLog[];
  heatmapData: HeatmapCell[];
}

export interface HeatmapCell {
  date: string;
  status: "taken" | "late" | "skipped" | "missed" | "none";
  value: number;
}

export type RagSourceType =
  | "guideline"
  | "research"
  | "patient_visit"
  | "patient_report"
  | "medication_reference";

export interface RetrievedEvidence {
  sourceId: string;
  chunkId?: string;
  title: string;
  sourceType: RagSourceType;
  publisher?: string;
  date?: string;
  excerpt: string;
  relevanceNote?: string;
  similarityScore?: number;
}

export type RagEvidenceStatus = "sufficient" | "limited" | "insufficient" | "conflicting";

export interface RagAnalysisRequest {
  patientId: string;
  symptoms: string;
  question?: string;
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

export interface Citation {
  id: string;
  title: string;
  publisher: string;
  date: string;
  relevanceNote: string;
  type: "guideline" | "research_study" | "other";
  url?: string;
  evidenceId?: string;
}

export interface Prescription {
  id: string;
  medication: Medication;
  status: "draft" | "pending_review" | "approved" | "active" | "superseded";
  suggestedBy: "ai" | "doctor";
  approvedBy?: string;
  approvedAt?: string;
  citations: Citation[];
  revisions: PrescriptionRevision[];
}

export interface PrescriptionRevision {
  id: string;
  changedBy: string;
  changedAt: string;
  changes: Record<string, { from: string | number; to: string | number }>;
  reason: string;
}

export interface Escalation {
  id: string;
  patientId: string;
  patientName: string;
  severity: "mild" | "concerning" | "urgent";
  rootCause: string;
  confidence: number;
  explanation: string;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  status: "open" | "acknowledged" | "resolved";
  aiModelVersion: string;
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: "idle" | "running" | "complete" | "error";
  lastRun?: string;
  agentName: string;
  description: string;
  logs: AgentLog[];
}

export interface AgentLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Report {
  id: string;
  period: "weekly" | "monthly";
  startDate: string;
  endDate: string;
  adherencePercent: number;
  missedDays: number;
  trend: "improving" | "stable" | "declining";
  insights: string[];
  deliveredAt?: string;
}

export interface PatientUploadedReport {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  category: "blood_test" | "imaging" | "prescription" | "discharge_summary" | "other";
  reportDate: string;
  note?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileDataUrl: string;
  uploadedAt: string;
  status: "shared" | "reviewed";
  reviewedAt?: string;
  indexingStatus?: "not_indexed" | "uploaded" | "indexing" | "ready" | "failed";
  indexingError?: string;
  indexedAt?: string;
}

export interface TrustScoreComponent {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface SparklinePoint {
  date: string;
  value: number;
}
