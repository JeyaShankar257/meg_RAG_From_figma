# Design

## Context

The current AI Assistant in `src/pages/doctor/PatientPage.tsx` uses a simulated delay and static `DEMO_AI_ANALYSIS`, while citations are static mock records and patient reports are stored through browser localStorage. The broader `setup-backend-infrastructure` change provides the authentication, API, private storage, TypeScript worker, Python agent service, audit, and doctor-approval foundations that this RAG feature depends on.

## Goals / Non-Goals

**Goals:**

- Add evidence-grounded analysis to the existing doctor Patient Page without creating a separate RAG portal.
- Retrieve approved clinical knowledge and authorized patient-specific context.
- Use Gemini server-side with validated structured output.
- Index patient reports asynchronously and expose searchable/indexing states.
- Display traceable evidence and preserve complete retrieval and model provenance.
- Keep prescription activation behind explicit doctor approval.

**Non-Goals:**

- Autonomous diagnosis, treatment, or prescribing.
- Patient-facing RAG in the first release.
- Replacing the broader backend authentication or clinical schema foundation.
- Automatically importing arbitrary web content or user-submitted clinical guidance into the shared knowledge base.
- OCR for image-only documents in the first indexing iteration.

## Decisions

### Integrate RAG into the existing AI Assistant

The primary experience remains `/doctor/patients/:patientId` in the `AI Assistant` tab. The existing symptoms input and `Run Analysis` action become the RAG request boundary. A collapsed `Retrieved Evidence` section appears before the AI result, while the existing prescription suggestion remains a separate downstream review surface.

Alternative considered: a standalone RAG page or new navigation item. Rejected because it would separate evidence retrieval from the clinical question, patient context, and doctor approval workflow already present on the Patient Page.

### Use Supabase Postgres with pgvector

Store source metadata and chunks in Postgres with vector embeddings. Use separate logical scopes for approved global clinical sources and patient-specific sources. Retrieval queries enforce workspace, patient, assignment, and consent constraints before similarity ranking.

Use Gemini-compatible embeddings through a server-side adapter so the embedding provider remains replaceable without changing the frontend contract. Embedding model/version is stored with each chunk and query.

Alternative considered: a separate vector database. Rejected for the initial feature because it adds another authorization and operational boundary while the project already plans to use Supabase Postgres.

### Separate indexing and analysis jobs

Report upload commits the private file and metadata first, then enqueues an indexing job. The worker extracts PDF text, normalizes it, chunks it, generates embeddings, and stores searchable chunks. RAG analysis uses a separate job or API workflow that records query, retrieval results, and Gemini output independently.

This keeps uploads reliable and makes indexing failures retryable without blocking the patient portal.

### Python agent workflow with schema validation

Create a Python agent workflow under `apps/agents` with prompt construction, retrieval orchestration, Gemini integration, and response schemas. The TypeScript API or worker dispatches only authorized context and retrieved evidence through a versioned job contract. Retrieved text is delimited and labeled untrusted so embedded instructions cannot override system safety rules.

Validate confidence, severity, safety flags, citations, and medication suggestions at the Python boundary and again before persistence. Invalid or incomplete output becomes an error or needs-review state. The agent cannot approve prescriptions or directly mutate clinical records.

### Provenance-first result model

Persist the original question, patient context snapshot, query identifier, retrieved chunk IDs, excerpts, scores, source metadata, prompt version, Gemini model version, structured output, safety flags, and doctor review state. The frontend consumes the same stored evidence used to generate the answer instead of recomputing or displaying unrelated citations.

### Typed asynchronous API contract

Use:

```text
POST /doctor/patients/:patientId/ai-analyses
GET  /doctor/ai-analyses/:analysisId
GET  /doctor/ai-analyses/:analysisId/evidence
POST /reports/:reportId/reindex
```

The create endpoint returns an analysis ID and status. The frontend polls or refreshes the analysis until it is complete or failed. The API owns authorization, context assembly, persistence, and audit events. The Python agent service owns model orchestration and returns structured results through the versioned job contract.

### Frontend migration boundary

Add RAG request/response types and a typed client under `src/lib/api/`. Replace the local timeout in `PatientPage.tsx` only after the API contract is available. Keep static mock behavior behind an explicit development-only flag; backend-enabled environments must surface API errors instead of silently displaying `DEMO_AI_ANALYSIS`.

## Risks / Trade-offs

- [Risk] Patient-specific chunks leak across patients -> Apply server-side patient/workspace filters, RLS, authorization tests, and query-level scope checks before vector ranking.
- [Risk] Uploaded text contains prompt injection -> Treat all retrieved text as untrusted evidence, delimit it in prompts, validate output, and preserve doctor approval boundaries.
- [Risk] Similarity ranking returns clinically weak evidence -> Store scores, use source review/status filters, set a minimum relevance threshold, and communicate insufficient evidence.
- [Risk] Gemini output is malformed or unsafe -> Validate against a strict schema, store an error/needs-review state, and never activate prescriptions automatically.
- [Risk] Indexing increases upload complexity -> Commit uploads independently, process indexing asynchronously, expose status, and allow retry/dead-letter handling.
- [Risk] Embeddings or Gemini APIs become unavailable -> Use durable jobs, bounded retries, provider timeouts, and a clear recoverable error state.
- [Risk] RAG citations become stale -> Version sources and embeddings, store ingestion timestamps, and support explicit source reindexing.
- [Risk] Medical data is sent to an external provider -> Keep credentials server-only, minimize context, apply deployment consent/compliance gates, and make provider usage observable through audit records.

## Migration Plan

1. Add RAG types, API schemas, and database migrations for sources, chunks, queries, results, and indexing jobs.
2. Add pgvector functions, source ingestion, report text extraction, embedding generation, and worker retry behavior.
3. Add authorization-aware retrieval and the Python agent workflow with strict input/output validation.
4. Add RAG API endpoints, provenance persistence, audit events, and integration tests.
5. Replace the Patient Page mock AI request with the typed API client and add Retrieved Evidence rendering.
6. Replace static citations with persisted evidence and add report indexing status.
7. Run end-to-end doctor analysis and prescription-review tests using isolated fictional data.

Rollback disables the backend RAG feature flag and preserves the existing development-only mock path. Existing report files, clinical records, and audit events remain intact; rollback does not delete indexed data.

## Implementation Defaults

- Use the Gemini embedding adapter with a 768-dimension vector contract for the initial fictional dataset. Keep the embedding model name and dimension in server configuration so a later model migration can create a new source/chunk version rather than mixing incompatible vectors.
- Retrieve the top 6 eligible chunks initially, with a configurable minimum similarity threshold. Record the threshold and top-k values with each retrieval query so evaluation can tune them without changing the API contract.
- Select the PDF text extraction library during backend setup based on the Node deployment runtime and repository license policy. The extraction interface remains provider-independent so OCR or another parser can be added later.
