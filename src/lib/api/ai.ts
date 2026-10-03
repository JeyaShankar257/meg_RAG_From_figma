import type { RagAnalysisRequest, RagAnalysisResponse } from "../types";
import { requestJson } from "./client";

export function runPatientRagAnalysis(
  request: RagAnalysisRequest,
): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/patients/${encodeURIComponent(request.patientId)}/ai-analyses`,
    {
      method: "POST",
      body: JSON.stringify({
        symptoms: request.symptoms,
        question: request.question,
      }),
    },
  );
}

export function getRagAnalysis(analysisId: string): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/ai-analyses/${encodeURIComponent(analysisId)}`,
  );
}

export function getRagEvidence(analysisId: string): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/ai-analyses/${encodeURIComponent(analysisId)}/evidence`,
  );
}

export function reindexPatientReport(reportId: string): Promise<{ status: string }> {
  return requestJson<{ status: string }>(
    `/reports/${encodeURIComponent(reportId)}/reindex`,
    { method: "POST" },
  );
}
