import { apiRagService } from "./apiAdapter";
import { mockRagService } from "./mockAdapter";
import { isBackendConfigured } from "../api/apiClient";

export type RagMode = "api" | "mock";

export function getRagMode(): RagMode {
  if (import.meta.env.VITE_RAG_MODE === "mock") return "mock";
  return "api";
}

export function getRagService() {
  return getRagMode() === "api" ? apiRagService : mockRagService;
}
