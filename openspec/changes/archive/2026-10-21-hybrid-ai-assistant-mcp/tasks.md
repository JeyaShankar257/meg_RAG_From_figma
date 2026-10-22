# Tasks: Hybrid AI Assistant with MCP External Medical Tools

## 1. MCP Medical Tools Integration in Backend (`apps/api`)

- [x] 1.1 Create the MCP client service layer and medical tool definitions (`check_drug_interactions`, `search_guidelines`) in `apps/api/src/services/mcp/`. Verify with service-level unit tests.
- [x] 1.2 Implement the `openfda_interaction_check` tool to query FDA drug databases for contraindications and adverse reactions against active patient medications. Verify output with test fixtures.
- [x] 1.3 Implement the `clinical_guidelines_lookup` tool to retrieve peer-reviewed medical guidance and external citation URLs. Verify parsing and provenance formatting.

## 2. Hybrid RAG Orchestration Engine

- [x] 2.1 Update the analysis handler in `apps/api/src/routes/doctor/index.ts` to orchestrate hybrid RAG: fetching internal patient context (with binary adherence) and executing external MCP tools via Gemini function calling. Verify in `doctorRagWorkflows.test.ts`.
- [x] 2.2 Extend `ai_citations` and response schemas to include `sourceTier` (`"patient_record"` | `"external_mcp"`), external URLs, and drug interaction safety check results. Verify API response serialization.

## 3. Frontend AI Assistant UI Enhancements

- [x] 3.1 Update `RetrievedEvidence.tsx` in `src/components/doctor/rag/` to visually differentiate `[Patient Record]` documents from `[External Literature (MCP)]` with clickable provenance links. Verify in browser.
- [x] 3.2 Update `PrescriptionSuggestionCard.tsx` in `src/components/doctor/rag/` to display the live FDA interaction safety verification badge and high-visibility contraindication warnings. Verify alert states.

## 4. End-to-End Verification & Safety Validation

- [x] 4.1 Run full TypeScript typecheck (`pnpm run typecheck`) to verify zero type mismatches across backend MCP services and frontend RAG components.
- [x] 4.2 Run automated RAG test suites (`npm run test:api`) verifying end-to-end hybrid synthesis, graceful fallback on MCP timeouts, and audit trail persistence.
