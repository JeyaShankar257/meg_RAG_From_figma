# RAG Implementation Plan

## Objective

Add Retrieval-Augmented Generation (RAG) to the doctor-facing AI Assistant. The doctor enters symptoms or a clinical question, the server retrieves authorized clinical evidence and patient-specific context, Gemini produces a structured advisory analysis, and the UI shows the evidence and citations before any prescription decision.

RAG is an evidence-grounding layer. It must not diagnose autonomously or activate prescriptions without doctor approval.

## Primary Location

The feature belongs in the existing doctor patient workflow:

- Route: `/doctor/patients/:patientId`
- Frontend: `src/pages/doctor/PatientPage.tsx`
- Tab: `AI Assistant`
- Trigger: `Run Analysis`
- API: `apps/api`
- Worker: `apps/worker`
- Database migrations: `supabase/migrations/`

The user flow becomes:

```text
Doctor enters symptoms
        |
        v
Frontend sends patientId and question
        |
        v
API verifies doctor access
        |
        v
RAG retrieves authorized evidence
        |
        v
Gemini analyzes the evidence and patient context
        |
        v
AI result and citations are stored
        |
        v
Doctor reviews the result
        |
        v
Doctor separately approves or rejects any prescription
```

## Phase 1: Frontend Changes

### 1. Extend shared types

Modify `src/lib/types.ts` with RAG-specific types:

```ts
type RagSourceType =
  | "guideline"
  | "research"
  | "patient_visit"
  | "patient_report"
  | "medication_reference";

interface RetrievedEvidence {
  sourceId: string;
  chunkId?: string;
  title: string;
  sourceType: RagSourceType;
  publisher?: string;
  date?: string;
  excerpt: string;
  relevanceNote?: string;
  similarityScore?: number;
}

interface RagAnalysisRequest {
  patientId: string;
  symptoms: string;
  question?: string;
}

interface RagAnalysisResponse {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  evidence: RetrievedEvidence[];
  analysis?: AIAnalysis;
  error?: string;
}
```

Extend `AIAnalysis` with:

```ts
retrievedEvidence?: RetrievedEvidence[];
ragQueryId?: string;
```

### 2. Add the frontend API client

Create:

```text
src/lib/api/client.ts
src/lib/api/ai.ts
```

Add functions such as:

```ts
runPatientRagAnalysis(request: RagAnalysisRequest)
getRagAnalysis(analysisId: string)
```

The client must handle authentication, request validation, loading states, API errors, polling, and correlation IDs.

### 3. Replace the simulated AI flow

Modify `src/pages/doctor/PatientPage.tsx`.

Replace the current local timeout and `DEMO_AI_ANALYSIS` response with:

1. Validate the symptom or question input.
2. Send `patientId`, symptoms, and question to the backend.
3. Show a running state.
4. Display retrieved evidence when available.
5. Display the completed Gemini analysis.
6. Show a retryable error if retrieval or analysis fails.

The existing prescription approval flow remains separate from RAG.

### 4. Add Retrieved Evidence UI

Place a collapsible section in the AI Assistant tab between the loading state and the final AI result:

```text
Patient Context
Clinical Question
[Run Analysis]

Retrieved Evidence
- ADA guideline
- Prior diabetes visit
- Patient-uploaded report

AI Analysis Complete
Confidence
Reasoning
Safety Flags

AI Prescription Suggestion
Doctor approval required
```

Each evidence item should show:

- Source title
- Source type
- Publisher and date
- Relevant excerpt
- Relevance explanation
- Optional similarity score

Keep the section collapsed by default.

### 5. Update citation display

Reuse and extend the existing citation UI in `PatientPage.tsx` so it can display:

- Source identifiers
- Evidence excerpts
- Patient visit references
- Patient report references
- Guideline and research labels
- Source URLs when available

The existing `Research Citations` section should use stored RAG sources instead of only static mock citations.

### 6. Update report indexing status

Replace the localStorage-based report behavior in `src/lib/patientReports.ts` with API-backed report metadata when the backend is available.

Display these states:

- Uploaded
- Indexing
- Ready for AI analysis
- Indexing failed

Add a retry action for failed indexing.

### 7. Add frontend tests

Test:

- Analysis request starts the loading state.
- Retrieved evidence renders correctly.
- Completed AI output renders correctly.
- Errors expose a retry action.
- Evidence is not visible to unauthorized users.
- Prescription approval still requires doctor confirmation.
- Gemini and database secrets never appear in browser code.

## Phase 2: Backend Changes

### 1. Add vector storage

Use Supabase Postgres with the `pgvector` extension.

Create migrations for:

```text
knowledge_sources
knowledge_chunks
rag_queries
rag_results
document_indexing_jobs
```

Suggested fields:

```text
knowledge_sources
- id
- source_type
- title
- publisher
- publication_date
- url
- workspace_id
- patient_id nullable
- version
- status
- created_at

knowledge_chunks
- id
- source_id
- chunk_text
- embedding vector
- metadata jsonb
- chunk_index
- created_at

rag_queries
- id
- patient_id
- requested_by
- question
- query_text
- status
- created_at

rag_results
- id
- query_id
- chunk_id
- rank
- similarity_score
- excerpt
- created_at
```

### 2. Add document ingestion

Create a worker pipeline:

```text
Uploaded report
      |
      v
Extract text
      |
      v
Clean and normalize
      |
      v
Split into chunks
      |
      v
Generate embeddings
      |
      v
Store chunks and metadata
```

The worker should support PDF extraction first, with OCR support added later. Upload must succeed even if indexing fails temporarily.

### 3. Add clinical knowledge ingestion

Create an administrative or seed-only process for:

- Clinical guidelines
- Medication references
- Research papers
- Institution-approved protocols

Each source requires title, publisher, publication date, URL, version, type, workspace visibility, and review status.

Do not allow arbitrary users to inject shared clinical knowledge.

### 4. Add authorization-aware retrieval

Before vector search, verify:

- Authenticated user
- Doctor role
- Workspace membership
- Patient assignment
- Consent and report visibility
- Knowledge-source visibility

Search should combine:

```text
Approved global clinical sources
+
Authorized patient-specific sources
```

Never search all patient records through one unrestricted query.

### 5. Add RAG API endpoints

Recommended endpoints:

```text
POST /doctor/patients/:patientId/ai-analyses
GET  /doctor/ai-analyses/:analysisId
GET  /doctor/ai-analyses/:analysisId/evidence
POST /reports/:reportId/reindex
```

The analysis endpoint must:

1. Validate the doctor session.
2. Verify access to the patient.
3. Save the analysis request.
4. Build an authorized patient context snapshot.
5. Generate the retrieval query embedding.
6. Retrieve relevant chunks.
7. Call Gemini.
8. Validate Gemini's structured response.
9. Save retrieved evidence and analysis provenance.
10. Return the analysis status.

### 6. Add the Gemini adapter

Create:

```text
apps/api/src/ai/gemini.ts
apps/api/src/ai/prompts.ts
apps/api/src/ai/schemas.ts
```

Gemini receives:

- Clinical question
- Symptoms
- Authorized patient context
- Retrieved evidence
- Explicit instructions that retrieved text is untrusted evidence

Expected structured output:

```json
{
  "hypothesis": "...",
  "explanation": "...",
  "confidence": 0.87,
  "severity": "mild",
  "rootCause": "...",
  "safetyFlags": [],
  "citations": [],
  "suggestedMedications": [],
  "requiresDoctorReview": true
}
```

Validate this response on the server before storing or returning it.

### 7. Add provenance and audit logging

Persist:

- Original symptoms
- Clinical question
- Patient context snapshot
- Retrieved chunk IDs
- Retrieval scores
- Prompt version
- Gemini model version
- Gemini output
- Safety flags
- Doctor reviewer
- Review timestamp
- Correlation ID

Extend the audit requirements in `openspec/changes/setup-backend-infrastructure/specs/clinical-backend/spec.md`.

### 8. Add prompt-injection and safety controls

The backend must:

- Treat uploaded reports and notes as untrusted text.
- Delimit retrieved evidence in the Gemini prompt.
- Ignore instructions embedded in retrieved documents.
- Detect weak, missing, or conflicting evidence.
- Return uncertainty when evidence is insufficient.
- Never activate prescriptions automatically.
- Require doctor review before prescription activation.

### 9. Add worker jobs

Add durable jobs for:

```text
index_uploaded_report
generate_embedding
run_rag_analysis
retry_failed_analysis
reindex_source
```

Each job requires status, attempt count, retry timestamp, idempotency key, error details, and dead-letter handling.

### 10. Add backend tests

Test:

- Patient isolation
- Doctor authorization
- Consent filtering
- Vector search ranking
- Report indexing
- Duplicate job prevention
- Gemini failure recovery
- Invalid Gemini output
- Prompt-injection-resistant formatting
- Audit completeness
- Prescription approval boundaries

## Implementation Order

1. Add frontend types and API contract.
2. Add Postgres and `pgvector` migrations.
3. Add authorization-aware retrieval.
4. Add Gemini adapter and structured response validation.
5. Add report-indexing worker.
6. Connect `PatientPage.tsx` to the AI API.
7. Add Retrieved Evidence UI.
8. Add audit, security, and authorization tests.
9. Run the complete doctor workflow end to end.

## Safety Boundary

```text
RAG evidence
    -> Gemini analysis
    -> Doctor review
    -> Doctor approval
    -> Prescription activation
```

RAG and Gemini must never activate a prescription automatically.
