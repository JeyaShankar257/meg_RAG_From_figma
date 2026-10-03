import {
  getRagAnalysis,
  getRagEvidence,
  reindexPatientReport,
  runPatientRagAnalysis,
} from "../api/ai";
import type { RagService } from "./types";

export const apiRagService: RagService = {
  createAnalysis: runPatientRagAnalysis,
  getAnalysis: getRagAnalysis,
  getEvidence: getRagEvidence,
  reindexReport: reindexPatientReport,
};
