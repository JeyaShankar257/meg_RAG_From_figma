export type SourceTier = "patient_record" | "external_mcp";

export interface McpToolCall<T = Record<string, unknown>> {
    name: string;
    arguments: T;
}

export interface McpToolResult<T = unknown> {
    toolName: string;
    isError?: boolean;
    data: T;
    errorMessage?: string;
    durationMs: number;
}

export interface DrugInteraction {
    drugA: string;
    drugB: string;
    severity: "mild" | "moderate" | "severe";
    description: string;
    source: string;
    evidenceUrl?: string;
}

export interface DrugInteractionCheckInput {
    suggestedDrug: string;
    currentMedications: string[];
    patientConditions?: string[];
}

export interface DrugInteractionResult {
    suggestedDrug: string;
    currentMedications: string[];
    hasContraindication: boolean;
    status: "verified" | "warning" | "unavailable";
    source: string;
    summary: string;
    interactions: DrugInteraction[];
    checkedAt: string;
}

export interface ClinicalGuidelineItem {
    id: string;
    title: string;
    organization: string;
    publicationYear: number;
    condition: string;
    recommendation: string;
    evidenceLevel: "Class I (A)" | "Class I (B)" | "Class IIa" | "Class IIb" | "Expert Consensus";
    url: string;
}

export interface ClinicalGuidelineSearchInput {
    condition: string;
    query?: string;
}

export interface ClinicalGuidelineSearchResult {
    query: string;
    condition: string;
    source: string;
    guidelines: ClinicalGuidelineItem[];
    searchedAt: string;
}
