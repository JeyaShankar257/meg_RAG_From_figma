# Spec Delta

## Purpose

Provides evidence-grounded, auditable clinical analysis in the doctor Patient Page by retrieving authorized clinical and patient-specific context before Gemini generates an advisory result.

## ADDED Requirements

### Requirement: Doctor can request evidence-grounded analysis

The system SHALL allow an authorized doctor to submit symptoms or a clinical question for a specific patient through the Patient Page AI Assistant. The system SHALL create a traceable analysis request and SHALL return a pending, running, complete, or error state without exposing private data to unauthorized callers.

#### Scenario: Doctor submits a clinical question

- **WHEN** an authorized doctor submits a patient identifier, symptoms, and optional clinical question
- **THEN** the system creates an analysis request scoped to that patient and returns a traceable analysis identifier and processing status

#### Scenario: Unauthorized user submits an analysis request

- **WHEN** a user without doctor access to the patient submits an analysis request
- **THEN** the system rejects the request without revealing whether the patient exists or which sources are available

#### Scenario: Analysis fails

- **WHEN** retrieval, embedding, or Gemini processing fails after an analysis request is created
- **THEN** the system stores an error state without creating a prescription and returns a recoverable error to the doctor

### Requirement: Retrieval is authorization-aware and source-scoped

The system SHALL retrieve evidence only from approved clinical sources and patient records that the requesting doctor is authorized to access. Patient-specific retrieval SHALL be isolated by patient and workspace scope, and consent rules SHALL be applied before source selection.

#### Scenario: Retrieval combines approved sources

- **WHEN** an authorized doctor requests analysis for a patient
- **THEN** retrieval may combine relevant approved clinical knowledge with permitted visits, medications, adherence data, and patient-uploaded reports for that patient

#### Scenario: Cross-patient evidence is unavailable

- **WHEN** a retrieval request is made for patient A while a potentially similar chunk belongs to patient B
- **THEN** the system excludes patient B's chunk from results and from the Gemini context

#### Scenario: Revoked report access is encountered

- **WHEN** a patient report is no longer shared with the requesting doctor
- **THEN** the system excludes that report and its chunks from retrieval and records the applied access decision

### Requirement: Retrieved evidence is visible and traceable

The system SHALL return evidence records containing source identity, source type, excerpt, relevance metadata, and enough citation information for the doctor to inspect the basis of the analysis. The Patient Page SHALL display the evidence separately from the AI conclusion and SHALL keep the evidence section collapsed by default.

#### Scenario: Analysis has retrieved evidence

- **WHEN** an analysis completes with one or more eligible sources
- **THEN** the Patient Page displays a Retrieved Evidence section with source title, type, excerpt, publication or report metadata, and relevance information

#### Scenario: Analysis has weak or no evidence

- **WHEN** retrieval returns no sufficiently relevant evidence
- **THEN** the system marks the evidence as insufficient and the AI result communicates uncertainty rather than presenting unsupported confidence

#### Scenario: Doctor opens a citation

- **WHEN** the doctor expands an evidence item or citation
- **THEN** the system shows the stored excerpt and source reference without allowing the citation display to alter the underlying clinical record

### Requirement: Uploaded reports can become searchable asynchronously

The system SHALL index authorized patient-uploaded reports asynchronously after upload. Indexing SHALL expose a status and SHALL not prevent the original report from being stored when extraction or embedding fails.

#### Scenario: Report indexing succeeds

- **WHEN** a valid private report is uploaded and its indexing job completes
- **THEN** the report status becomes searchable and its approved text chunks can participate in future patient-scoped retrieval

#### Scenario: Report indexing fails

- **WHEN** text extraction or embedding generation fails
- **THEN** the report remains available to authorized users, the system records an indexing failure, and an authorized retry can be requested

### Requirement: Gemini output preserves advisory safety and provenance

The system SHALL send the authorized patient context and retrieved evidence to Gemini through a server-side integration and SHALL validate the structured response before returning it. AI output SHALL remain advisory, preserve model and prompt versions, and SHALL NOT activate a prescription without explicit doctor approval.

#### Scenario: Gemini returns a valid analysis

- **WHEN** Gemini returns a schema-valid analysis
- **THEN** the system stores the input snapshot, retrieved source identifiers, structured output, confidence, safety flags, citations, model version, prompt version, and review state

#### Scenario: Gemini returns invalid output

- **WHEN** Gemini returns malformed, incomplete, or unsafe structured output
- **THEN** the system marks the analysis as an error or needs-review state and does not expose it as an approved clinical recommendation

#### Scenario: AI suggests medication

- **WHEN** Gemini includes a medication suggestion in the analysis
- **THEN** the Patient Page labels it as AI-suggested and requires the existing doctor review and approval flow before it can become active

### Requirement: Retrieval and analysis are auditable and retry-safe

The system SHALL persist analysis requests, retrieval results, indexing jobs, retries, and review actions with correlation identifiers, status, attempt information, and actor metadata. Repeated requests or webhook/job retries SHALL NOT create duplicate clinical events.

#### Scenario: Analysis job is retried

- **WHEN** an analysis or indexing job fails transiently and is retried
- **THEN** the system reuses its idempotency boundary, records the retry outcome, and does not duplicate evidence or prescriptions

#### Scenario: Auditor reviews an analysis

- **WHEN** an authorized auditor or administrator requests the analysis history
- **THEN** the system returns the original question, patient-context snapshot, retrieved sources, model/prompt versions, output, status changes, and doctor review actions without exposing provider secrets

### Requirement: Retrieved documents are treated as untrusted evidence

The system SHALL isolate retrieved text from executable instructions and SHALL defend the Gemini prompt against instructions embedded in patient notes, uploaded reports, or external documents. The system SHALL preserve uncertainty when sources conflict or are insufficient.

#### Scenario: Retrieved document contains instructions

- **WHEN** a retrieved document includes text attempting to change the AI's system behavior or bypass doctor review
- **THEN** the system treats that text as evidence content only and preserves the doctor-review and prescription-approval controls

#### Scenario: Sources conflict

- **WHEN** retrieved sources disagree or do not support a confident conclusion
- **THEN** the system surfaces the conflict or uncertainty and does not manufacture a definitive clinical recommendation
