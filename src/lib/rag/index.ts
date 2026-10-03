import { apiRagService } from "./apiAdapter";
import { mockRagService } from "./mockAdapter";

export type RagMode = "api" | "mock";

export function getRagMode(): RagMode {
  return import.meta.env.VITE_RAG_MODE === "api" ? "api" : "mock";
}

export function getRagService() {
  return getRagMode() === "api" ? apiRagService : mockRagService;
}
