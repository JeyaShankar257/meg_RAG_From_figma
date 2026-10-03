import { ApiError } from "../api/client";
import { DEMO_AI_ANALYSIS } from "../mockData";
import type {
  AIAnalysis,
  RagAnalysisRequest,
  RagAnalysisResponse,
  RagEvidenceStatus,
  RetrievedEvidence,
} from "../types";
import type { RagService } from "./types";

type MockScenario = "success" | "insufficient" | "conflicting" | "error" | "unauthorized";

interface MockRun {
  createdAt: number;
  request: RagAnalysisRequest;
  scenario: MockScenario;
}

const runs = new Map<string, MockRun>();

const MOCK_EVIDENCE: RetrievedEvidence[] = [
  {
    sourceId: "source-ada-2026",
    chunkId: "chunk-ada-sglt2",
    title: "ADA Standards of Medical Care in Diabetes 2026",
    sourceType: "guideline",
    publisher: "American Diabetes Association",
    date: "2026-01",
    excerpt:
      "For adults with type 2 diabetes and established cardiovascular risk, an SGLT2 inhibitor with demonstrated cardiovascular benefit should be considered alongside individualized glycemic goals.",
    relevanceNote:
      "Applies to this patient’s type 2 diabetes, hypertension, and HbA1c above the documented target.",
    similarityScore: 0.94,
  },
  {
    sourceId: "visit-v-001",
    chunkId: "chunk-visit-v-001-plan",
    title: "Type 2 Diabetes Follow-up — August 28, 2026",
    sourceType: "patient_visit",
    date: "2026-08-28",
    excerpt:
      "HbA1c improved to 7.1% from 7.8%. Continue metformin titration and consider Jardiance 10 mg daily if glucose control remains above target.",
    relevanceNote:
      "This prior care plan directly documents the same medication option and the patient’s latest glycemic trend.",
    similarityScore: 0.91,
  },
  {
    sourceId: "report-demo-hba1c",
    chunkId: "chunk-report-demo-hba1c",
    title: "HbA1c Laboratory Report",
    sourceType: "patient_report",
    date: "2026-09-10",
    excerpt:
      "Hemoglobin A1c: 7.1%. Estimated average glucose: 157 mg/dL. Result flagged above the laboratory reference target.",
    relevanceNote:
      "The recent patient report supports the glucose-control context used in this analysis.",
    similarityScore: 0.88,
  },
];

function getScenario(request: RagAnalysisRequest): MockScenario {
  const text = `${request.symptoms} ${request.question ?? ""}`.toLowerCase();
  if (text.includes("unauthorized")) return "unauthorized";
  if (text.includes("insufficient")) return "insufficient";
  if (text.includes("conflicting")) return "conflicting";
  if (text.includes("simulate error")) return "error";
  return "success";
}

function buildAnalysis(
  evidence: RetrievedEvidence[],
  evidenceStatus: RagEvidenceStatus,
): AIAnalysis {
  if (evidenceStatus !== "sufficient") {
    return {
      ...DEMO_AI_ANALYSIS,
      id: `mock-analysis-${Date.now()}`,
      confidence: evidenceStatus === "insufficient" ? 0.34 : 0.52,
      hypothesis:
        evidenceStatus === "insufficient"
          ? "Available evidence is insufficient for a supported medication recommendation."
          : "Retrieved sources contain conflicting signals that require clinician review.",
      explanation:
        evidenceStatus === "insufficient"
          ? "The retrieval threshold was not met. Review the patient record or request additional testing before making a treatment decision."
          : "Patient-specific context and general guidance do not align strongly enough to support a definitive recommendation.",
      safetyFlags: [
        evidenceStatus === "insufficient"
          ? "Insufficient supporting evidence"
          : "Conflicting retrieved evidence",
      ],
      suggestedMedications: [],
      citations: [],
      retrievedEvidence: evidence,
      evidenceStatus,
      ragQueryId: `mock-query-${Date.now()}`,
      promptVersion: "rag-clinical-v1-demo",
    };
  }

  return {
    ...DEMO_AI_ANALYSIS,
    id: `mock-analysis-${Date.now()}`,
    retrievedEvidence: evidence,
    evidenceStatus,
    ragQueryId: `mock-query-${Date.now()}`,
    promptVersion: "rag-clinical-v1-demo",
    citations: DEMO_AI_ANALYSIS.citations.map((citation, index) => ({
      ...citation,
      evidenceId: evidence[index]?.sourceId,
    })),
    suggestedMedications: DEMO_AI_ANALYSIS.suggestedMedications?.map((medication, index) => ({
      ...medication,
      citations: medication.citations.map((citation) => ({
        ...citation,
        evidenceId: evidence[index === 0 ? 0 : 2]?.sourceId,
      })),
    })),
  };
}

function createResponse(id: string, run: MockRun): RagAnalysisResponse {
  const elapsed = Date.now() - run.createdAt;
  const correlationId = `demo-${id}`;

  if (elapsed < 500) {
    return { id, status: "pending", evidence: [], correlationId, retryable: false };
  }
  if (elapsed < 1500) {
    return { id, status: "running", evidence: [], correlationId, retryable: false };
  }
  if (run.scenario === "error") {
    return {
      id,
      status: "error",
      evidence: [],
      error: "The demo retrieval service could not complete this analysis.",
      correlationId,
      retryable: true,
    };
  }

  const evidenceStatus: RagEvidenceStatus =
    run.scenario === "insufficient"
      ? "insufficient"
      : run.scenario === "conflicting"
        ? "conflicting"
        : "sufficient";
  const evidence =
    evidenceStatus === "insufficient"
      ? []
      : evidenceStatus === "conflicting"
        ? MOCK_EVIDENCE.slice(0, 2)
        : MOCK_EVIDENCE;

  return {
    id,
    status: "complete",
    evidence,
    evidenceStatus,
    analysis: buildAnalysis(evidence, evidenceStatus),
    correlationId,
    retryable: false,
    createdAt: new Date(run.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const mockRagService: RagService = {
  async createAnalysis(request) {
    const scenario = getScenario(request);
    if (scenario === "unauthorized") {
      throw new ApiError("You do not have access to this analysis.", 403, "demo-denied");
    }
    const id = `rag-demo-${Date.now()}`;
    const run = { createdAt: Date.now(), request, scenario };
    runs.set(id, run);
    return createResponse(id, run);
  },

  async getAnalysis(analysisId) {
    const run = runs.get(analysisId);
    if (!run) throw new ApiError("Analysis not found.", 404);
    return createResponse(analysisId, run);
  },

  async getEvidence(analysisId) {
    const run = runs.get(analysisId);
    if (!run) throw new ApiError("Analysis not found.", 404);
    return createResponse(analysisId, run);
  },

  async reindexReport() {
    return { status: "indexing" };
  },
};
