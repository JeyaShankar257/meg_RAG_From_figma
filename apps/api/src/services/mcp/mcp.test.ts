import { describe, it, expect, vi } from "vitest";
import { getMcpClient, McpClientService } from "./mcpClient.js";
import { executeOpenFdaInteractionCheck } from "./openFdaTool.js";
import { executeClinicalGuidelinesLookup } from "./clinicalGuidelinesTool.js";

describe("MCP Medical Tools & Client Service (Tasks 1.1 - 1.3)", () => {
    describe("OpenFDA Drug Interaction Check (Task 1.2)", () => {
        it("returns verified status with 0 interactions for safe medications", async () => {
            const result = await executeOpenFdaInteractionCheck({
                suggestedDrug: "Acetaminophen 500mg",
                currentMedications: ["Lisinopril 10mg", "Metformin 500mg"],
                patientConditions: ["Hypertension", "Type 2 Diabetes"],
            });

            expect(result.status).toBe("verified");
            expect(result.hasContraindication).toBe(false);
            expect(result.interactions.length).toBe(0);
            expect(result.summary).toContain("0 Adverse Interactions");
        });

        it("flags substitution warning when ARB (Losartan) is suggested alongside ACE inhibitor (Lisinopril)", async () => {
            const result = await executeOpenFdaInteractionCheck({
                suggestedDrug: "Losartan Potassium 50mg",
                currentMedications: ["Lisinopril 20mg daily"],
                patientConditions: ["Hypertension"],
            });

            expect(result.status).toBe("warning");
            expect(result.hasContraindication).toBe(true);
            expect(result.interactions.length).toBeGreaterThan(0);
            expect(result.interactions[0].source).toContain("Dual RAAS Blockade");
            expect(result.interactions[0].description).toContain("Angiotensin II Receptor Blocker");
        });

        it("detects black-box pregnancy contraindication for renin-angiotensin agents", async () => {
            const result = await executeOpenFdaInteractionCheck({
                suggestedDrug: "Losartan Potassium 50mg",
                currentMedications: ["Prenatal Vitamins"],
                patientConditions: ["Hypertension", "Pregnancy third trimester"],
            });

            expect(result.hasContraindication).toBe(true);
            const pregnancyWarning = result.interactions.find((i) => i.description.includes("fetus"));
            expect(pregnancyWarning).toBeDefined();
            expect(pregnancyWarning?.severity).toBe("severe");
        });
    });

    describe("Clinical Guidelines Lookup (Task 1.3)", () => {
        it("retrieves ADA and AHA guidelines with provenance URLs for hypertension in diabetes", async () => {
            const result = await executeClinicalGuidelinesLookup({
                condition: "Hypertension",
                query: "Diabetes cough Lisinopril alternative",
            });

            expect(result.guidelines.length).toBeGreaterThan(0);
            const ada = result.guidelines.find((g) => g.organization.includes("ADA"));
            expect(ada).toBeDefined();
            expect(ada?.recommendation).toContain("ARB");
            expect(ada?.url).toMatch(/^https:\/\//);
            expect(ada?.evidenceLevel).toBe("Class I (A)");
        });
    });

    describe("MCP Client Execution & Bounded Timeout (Task 1.1)", () => {
        it("executes registered tool call successfully via McpClientService", async () => {
            const client = getMcpClient();
            const res = await client.executeToolCall({
                name: "check_drug_interactions",
                arguments: {
                    suggestedDrug: "Metformin 500mg",
                    currentMedications: ["Atorvastatin 20mg"],
                },
            });

            expect(res.isError).toBeFalsy();
            expect(res.toolName).toBe("check_drug_interactions");
            expect((res.data as any).status).toBe("verified");
        });

        it("gracefully falls back with unavailable status when tool times out", async () => {
            const timeoutClient = new McpClientService(20);
            const openFda = await import("./openFdaTool.js");
            const spy = vi.spyOn(openFda, "executeOpenFdaInteractionCheck").mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100)) as any,
            );

            const res = await timeoutClient.executeToolCall({
                name: "check_drug_interactions",
                arguments: {
                    suggestedDrug: "Losartan Potassium",
                    currentMedications: ["Lisinopril 20mg"],
                },
            });

            spy.mockRestore();

            expect(res.isError).toBe(true);
            expect((res.data as any).status).toBe("unavailable");
            expect((res.data as any).summary).toContain("unavailable");
        });
    });
});
