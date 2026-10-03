# Proposal

## Why

The doctor-facing AI Assistant currently returns static mock analysis and citations, so it cannot ground its reasoning in the patient's authorized history, uploaded reports, or curated clinical knowledge. RAG will make the analysis evidence-grounded and auditable while preserving the existing doctor-review boundary for clinical action.

This change depends on the authentication, API, storage, worker, and audit foundations described by `setup-backend-infrastructure`, but scopes the user-facing RAG capability and its retrieval-specific data flow.

## What Changes

- Add RAG to the `AI Assistant` tab on `/doctor/patients/:patientId`.
- Replace the simulated analysis response with an authenticated API request containing the patient's symptoms and clinical question.
- Retrieve authorized evidence from curated clinical sources and patient-scoped records.
- Add Postgres/pgvector storage for knowledge sources, chunks, retrieval queries, results, and document-indexing jobs.
- Add asynchronous indexing for patient-uploaded reports, including extraction, chunking, embeddings, and indexing status.
- Add a server-side Gemini adapter that receives the patient context and retrieved evidence and returns validated structured analysis.
- Display a collapsed `Retrieved Evidence` section with source metadata, excerpts, relevance, and citations before the AI result.
- Persist retrieval provenance, prompt/model versions, input snapshots, AI output, safety flags, and doctor review state.
- Add authorization, prompt-injection, retry, duplicate-job, and AI failure handling.
- Keep RAG and Gemini advisory only; prescriptions remain inactive until explicit doctor approval.

## Capabilities

### New Capabilities

- `rag-ai-assistant`: Evidence-grounded clinical analysis in the doctor Patient Page, including authorized retrieval, Gemini analysis, report indexing, citations, provenance, and doctor-review safety.

### Modified Capabilities

- None. The repository currently has no main OpenSpec capability specifications. The broader backend foundation is planned separately in `setup-backend-infrastructure`.

## Impact

- Frontend: `src/lib/types.ts`, `src/pages/doctor/PatientPage.tsx`, the future typed API client, citation rendering, report indexing status, and frontend tests.
- Backend: `apps/api`, `apps/worker`, Gemini integration, authorization-aware retrieval, Postgres/pgvector migrations, report text extraction, embeddings, audit records, and retryable jobs.
- Data: new knowledge-source, knowledge-chunk, RAG-query, RAG-result, and indexing-job records; private report files remain in protected storage.
- Dependencies: pgvector, an embedding provider compatible with the selected Gemini setup, Gemini server credentials, document extraction tooling, and backend test infrastructure.
- Security: all patient retrieval is server-side and scope-filtered; retrieved text is treated as untrusted evidence; no browser secrets or unrestricted cross-patient search are allowed.
- Compatibility: existing mock behavior may remain as an explicit development fallback during migration, but backend-enabled environments must use the RAG API and must not silently fall back to static analysis.
