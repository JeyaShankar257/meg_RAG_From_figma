# Spec Delta

## ADDED Requirements

### Requirement: Hybrid RAG pipeline connects to external MCP medical tools for live clinical verification
The system SHALL support external clinical data retrieval via Model Context Protocol (MCP) during AI analysis execution. When an advisory query requires drug safety checks or clinical guideline confirmation, the backend RAG engine SHALL invoke authorized MCP medical tools, capture structured responses, and incorporate external findings into the advisory synthesis alongside local patient evidence.

#### Scenario: Doctor runs analysis requiring external medical guideline verification
- **WHEN** an authorized doctor submits a clinical inquiry in the AI Assistant tab
- **THEN** the system executes local patient context retrieval and invokes the guideline MCP tool, incorporating external guideline recommendations and citations into the response

#### Scenario: MCP external tool is unreachable or times out
- **WHEN** an external MCP service fails or exceeds timeout thresholds
- **THEN** the system completes the analysis using available local patient evidence, flags external verification as unavailable, and alerts the doctor without failing the entire request

### Requirement: Programmatic drug-drug interaction safety checks prior to advisory prescription drafting
The system SHALL evaluate proposed medication suggestions against the patient's active prescriptions using an external drug safety MCP tool (such as OpenFDA interaction checks). The outcome of this safety check MUST be recorded in the analysis metadata and displayed to the doctor.

#### Scenario: Suggested medication passes drug interaction pre-check
- **WHEN** the AI Assistant drafts a medication suggestion that has no known severe interactions with the patient's active regimen
- **THEN** the system attaches a verified safety check badge displaying the source and zero identified contraindications

#### Scenario: Suggested medication has a known contraindication or adverse interaction
- **WHEN** the external safety check detects a known drug-drug interaction or condition contraindication
- **THEN** the system surfaces a high-visibility warning banner in the suggestion card, citing the specific interaction source and advising doctor scrutiny

### Requirement: Dual-tier evidence presentation distinguishing internal patient records from external MCP literature
The AI Assistant tab SHALL present retrieved evidence in two distinct categories: internal patient records (uploaded lab reports, visit notes) and external medical literature/tools (FDA safety guides, clinical guidelines).

#### Scenario: Doctor inspects retrieved citations in AI Assistant
- **WHEN** the doctor expands the evidence section in the AI Assistant panel
- **THEN** the UI renders distinct badges and provenance links separating patient-specific medical documents from external guideline and pharmacology citations
