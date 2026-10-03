import type { RagAnalysisRequest, RagAnalysisResponse } from "../types";
import { requestJson } from "./client";

export function runPatientRagAnalysis(
  request: RagAnalysisRequest,
  signal?: AbortSignal,
): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/patients/${encodeURIComponent(request.patientId)}/ai-analyses`,
    {
      method: "POST",
      body: JSON.stringify({
        symptoms: request.symptoms,
        question: request.question,
      }),
      signal,
    },
  );
}

export function getRagAnalysis(analysisId: string, signal?: AbortSignal): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/ai-analyses/${encodeURIComponent(analysisId)}`,
    { signal },
  );
}

export function getRagEvidence(analysisId: string, signal?: AbortSignal): Promise<RagAnalysisResponse> {
  return requestJson<RagAnalysisResponse>(
    `/doctor/ai-analyses/${encodeURIComponent(analysisId)}/evidence`,
    { signal },
  );
}

export function reindexPatientReport(reportId: string, signal?: AbortSignal): Promise<{ status: string }> {
  return requestJson<{ status: string }>(
    `/reports/${encodeURIComponent(reportId)}/reindex`,
    { method: "POST", signal },
  );
}
