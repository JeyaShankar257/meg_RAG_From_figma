import { executeOpenFdaInteractionCheck } from "./openFdaTool.js";
import { executeClinicalGuidelinesLookup } from "./clinicalGuidelinesTool.js";
import type {
    ClinicalGuidelineSearchInput,
    ClinicalGuidelineSearchResult,
    DrugInteractionCheckInput,
    DrugInteractionResult,
    McpToolCall,
    McpToolResult,
} from "./types.js";

/** Default hard timeout for external MCP queries in milliseconds (2.5 seconds per spec) */
export const DEFAULT_MCP_TIMEOUT_MS = 2500;

/**
 * Standard MCP Medical Tool Definitions (Gemini Tool Declarations)
 */
export const MCP_MEDICAL_TOOLS = [
    {
        name: "check_drug_interactions",
        description:
            "Queries the OpenFDA drug safety and adverse event database to evaluate potential drug-drug interactions, contraindications, and black-box warnings between suggested medications and the patient's active regimen.",
        parameters: {
            type: "object",
            properties: {
                suggestedDrug: {
                    type: "string",
                    description: "The name of the medication being considered or suggested (e.g. Losartan Potassium).",
                },
                currentMedications: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of the patient's currently active medications.",
                },
                patientConditions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of the patient's documented diagnoses or conditions.",
                },
            },
            required: ["suggestedDrug", "currentMedications"],
        },
    },
    {
        name: "search_guidelines",
        description:
            "Searches authoritative peer-reviewed medical practice guidelines (ADA, ACC/AHA, KDIGO, NICE) for condition-specific therapy recommendations and clinical trial evidence.",
        parameters: {
            type: "object",
            properties: {
                condition: {
                    type: "string",
                    description: "The clinical diagnosis or syndrome (e.g. Hypertension, Type 2 Diabetes).",
                },
                query: {
                    type: "string",
                    description: "Optional specific clinical question or therapeutic question.",
                },
            },
            required: ["condition"],
        },
    },
];

/**
 * Executes a tool with a bounded timeout guarantee.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`MCP tool '${toolName}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer!);
        return result;
    } catch (err) {
        clearTimeout(timer!);
        throw err;
    }
}

export class McpClientService {
    private timeoutMs: number;

    constructor(timeoutMs = DEFAULT_MCP_TIMEOUT_MS) {
        this.timeoutMs = timeoutMs;
    }

    /**
     * Executes an MCP tool call with strict timeout and graceful fallback protection.
     */
    async executeToolCall(toolCall: McpToolCall): Promise<McpToolResult> {
        const startTime = Date.now();
        const { name, arguments: args } = toolCall;

        try {
            switch (name) {
                case "check_drug_interactions":
                case "openfda_interaction_check": {
                    const data = await withTimeout(
                        executeOpenFdaInteractionCheck(args as unknown as DrugInteractionCheckInput),
                        this.timeoutMs,
                        name,
                    );
                    return {
                        toolName: name,
                        data,
                        durationMs: Date.now() - startTime,
                    };
                }

                case "search_guidelines":
                case "clinical_guidelines_lookup": {
                    const data = await withTimeout(
                        executeClinicalGuidelinesLookup(args as unknown as ClinicalGuidelineSearchInput),
                        this.timeoutMs,
                        name,
                    );
                    return {
                        toolName: name,
                        data,
                        durationMs: Date.now() - startTime,
                    };
                }

                default:
                    throw new Error(`Unknown MCP medical tool: '${name}'`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startTime;

            // Generate graceful fallback payload
            if (name === "check_drug_interactions" || name === "openfda_interaction_check") {
                const fallbackData: DrugInteractionResult = {
                    suggestedDrug: (args as any)?.suggestedDrug || "Unknown",
                    currentMedications: (args as any)?.currentMedications || [],
                    hasContraindication: false,
                    status: "unavailable",
                    source: "OpenFDA Drug Safety & Adverse Event Database (MCP)",
                    summary: "External interaction check unavailable — manual verification required.",
                    interactions: [],
                    checkedAt: new Date().toISOString(),
                };
                return {
                    toolName: name,
                    isError: true,
                    data: fallbackData,
                    errorMessage,
                    durationMs,
                };
            }

            if (name === "search_guidelines" || name === "clinical_guidelines_lookup") {
                const fallbackData: ClinicalGuidelineSearchResult = {
                    query: (args as any)?.query || "",
                    condition: (args as any)?.condition || "",
                    source: "Peer-Reviewed Clinical Guidelines MCP Adapter (ADA / ACC / AHA / NICE)",
                    guidelines: [],
                    searchedAt: new Date().toISOString(),
                };
                return {
                    toolName: name,
                    isError: true,
                    data: fallbackData,
                    errorMessage,
                    durationMs,
                };
            }

            return {
                toolName: name,
                isError: true,
                data: null,
                errorMessage,
                durationMs,
            };
        }
    }
}

let mcpClientSingleton: McpClientService | null = null;

export function getMcpClient(timeoutMs = DEFAULT_MCP_TIMEOUT_MS): McpClientService {
    if (!mcpClientSingleton) {
        mcpClientSingleton = new McpClientService(timeoutMs);
    }
    return mcpClientSingleton;
}
