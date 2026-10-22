# Proposal: Hybrid AI Assistant with MCP External Medical Tools

## Why
Phase 1 of our clinical workspace modernization ([real-data-doctor-patient-tabs](file:///d:/meg_RAG_From_figma/openspec/changes/real-data-doctor-patient-tabs/proposal.md)) connects all six tabs to live server data and introduces strict binary adherence (`taken` vs `missed`). However, the AI Assistant currently retrieves evidence only from local reports and stored knowledge chunks. To provide safe, audit-grade clinical decision support, the AI Assistant must verify proposed medication changes against live external medical sources (such as FDA drug safety databases and clinical practice guidelines) via Model Context Protocol (MCP) before presenting suggestions to the physician.

## What Changes
- **Hybrid RAG Pipeline (Internal + External):**
  - **Tier 1 (Internal Patient Scope):** Fast retrieval of authorized patient conditions, active prescriptions, binary adherence rate (`taken`/`missed`), recent visits, and indexed reports from the database.
  - **Tier 2 (External Clinical Verification via MCP):** On-demand execution of MCP medical tools during analysis generation to query external drug safety and clinical guidelines.
- **MCP Medical Tools Integration:**
  - `openfda_interaction_check`: Programmatically verifies drug-drug interactions, contraindications, and black-box warnings between suggested medications and the patient's existing regimen.
  - `clinical_guidelines_lookup`: Retrieves authoritative guideline excerpts and citations (e.g. ADA 2026, AHA, NICE) for specific disease-medication contexts.
- **UI & Decision Support Enhancements:**
  - **Dual-Tier Evidence Display:** Clearly separates and labels `[Patient Record]` citations from `[External MCP: FDA / Guidelines]` citations in [RetrievedEvidence.tsx](file:///d:/meg_RAG_From_figma/src/components/doctor/rag/RetrievedEvidence.tsx).
  - **Safety Pre-Check Badge:** Renders an explicit verification pill on [PrescriptionSuggestionCard.tsx](file:///d:/meg_RAG_From_figma/src/components/doctor/rag/PrescriptionSuggestionCard.tsx) (e.g. *"✓ 0 Adverse Interactions found via OpenFDA MCP"*).

## Capabilities

### Modified Capabilities
- `rag-ai-assistant`: Extends evidence retrieval and clinical analysis to incorporate external MCP tool execution, drug-drug interaction safety verifications, and external guideline provenance alongside patient records.

## Impact
- **Backend (`apps/api`):** Adds MCP client integration to the RAG orchestration pipeline in `apps/api/src/routes/doctor/index.ts` and creates tool client stubs.
- **Frontend (`src/components/doctor/rag/`):** Updates `RagAssistantPanel.tsx`, `RetrievedEvidence.tsx`, and `PrescriptionSuggestionCard.tsx` to display dual citations and safety badges.
- **Dependencies & Architecture:** Follows Phase 1 (`real-data-doctor-patient-tabs`) as an immediate dependency, building upon its live patient context and binary adherence foundation.
