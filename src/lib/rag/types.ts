import type { RagAnalysisRequest, RagAnalysisResponse } from "../types";

export interface RagService {
  createAnalysis(
    request: RagAnalysisRequest,
    signal?: AbortSignal,
  ): Promise<RagAnalysisResponse>;
  getAnalysis(analysisId: string, signal?: AbortSignal): Promise<RagAnalysisResponse>;
  getEvidence(analysisId: string, signal?: AbortSignal): Promise<RagAnalysisResponse>;
  reindexReport(reportId: string, signal?: AbortSignal): Promise<{ status: string }>;
}

export interface RagUiError {
  message: string;
  requestId?: string;
  retryable: boolean;
  unauthorized: boolean;
}
