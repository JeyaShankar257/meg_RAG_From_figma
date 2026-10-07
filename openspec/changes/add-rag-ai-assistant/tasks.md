# Tasks

## 1. RAG Contract and Frontend Types

- [x] 1.1 Confirm the `setup-backend-infrastructure` authentication, API, worker, storage, and audit foundations are available or define their integration stubs; verify the RAG change can run only with authorized server context.
- [x] 1.2 Add `RagSourceType`, `RetrievedEvidence`, `RagAnalysisRequest`, and `RagAnalysisResponse` shared types and extend `AIAnalysis` with retrieval identifiers; verify TypeScript compilation succeeds.
- [x] 1.3 Add `src/lib/api/client.ts` and `src/lib/api/ai.ts` with authenticated analysis creation, status retrieval, evidence retrieval, and report reindex functions; verify request and error shapes match the documented API contract.
- [ ] 1.4 Add frontend API tests for pending, running, complete, error, unauthorized, and retryable responses; verify no server secrets are imported into browser bundles.

## 2. Vector Data and Source Model

- [ ] 2.1 Add migrations enabling pgvector and creating knowledge sources, knowledge chunks, RAG queries, RAG results, and document-indexing jobs; verify migrations apply cleanly to an isolated database.
- [ ] 2.2 Add source metadata, embedding model/version, 768-dimension vector contract, chunk indexes, workspace scope, optional patient scope, review status, and timestamps; verify incompatible embedding versions cannot be mixed silently.
- [ ] 2.3 Add vector similarity search functions using an initial top-6 result limit and configurable minimum similarity threshold; verify ranking, threshold filtering, and deterministic ordering with fixture embeddings.
- [ ] 2.4 Add RLS and server authorization policies for workspace, doctor assignment, patient ownership, consent, approved clinical sources, and patient-specific chunks; verify cross-patient and revoked-report chunks never appear in retrieval results.
- [ ] 2.5 Add reviewed fictional clinical source fixtures for guidelines, research, medication references, prior visits, and patient reports; verify unreviewed or client-created clinical sources cannot enter the shared retrieval corpus.

## 3. Report and Knowledge Ingestion

- [ ] 3.1 Add a server-side PDF extraction adapter with a runtime-compatible implementation and a provider-independent interface; verify valid PDFs produce text and malformed or unsupported files produce safe indexing errors.
- [ ] 3.2 Implement report normalization, chunking, metadata preservation, and Gemini-compatible embedding generation; verify chunk order, source identifiers, patient scope, and embedding model/version are stored.
- [ ] 3.3 Implement durable `index_uploaded_report` and `generate_embedding` jobs with idempotency, retry, backoff, terminal failure, and dead-letter status; verify retries do not duplicate chunks.
- [ ] 3.4 Add report indexing status transitions for uploaded, indexing, searchable, and indexing-failed states; verify report availability is independent from indexing success and authorized retry works.
- [ ] 3.5 Add ingestion tests for report isolation, extraction failure, embedding failure, retry behavior, duplicate prevention, and source metadata; verify tests run without production provider credentials.

## 4. Retrieval, Gemini, and API Workflow

- [ ] 4.1 Implement authorized patient-context assembly from symptoms, question, visits, medications, adherence, reports, consent, and workspace scope; verify the context excludes unauthorized or revoked records.
- [ ] 4.2 Implement query embedding, authorization-aware vector retrieval, evidence ranking, similarity thresholding, and persisted RAG query/results; verify each result stores source IDs, excerpts, rank, score, and retrieval configuration.
- [ ] 4.3 Implement the Python agent workflow service, Gemini adapter, prompt construction, untrusted-evidence delimiters, and strict response schema validation; verify valid output is accepted and malformed output becomes an error or needs-review state.
- [ ] 4.4 Implement `POST /doctor/patients/:patientId/ai-analyses`, `GET /doctor/ai-analyses/:analysisId`, `GET /doctor/ai-analyses/:analysisId/evidence`, and `POST /reports/:reportId/reindex`; verify authentication, authorization, validation, correlation IDs, and safe error responses.
- [ ] 4.5 Persist the question, patient-context snapshot, retrieved evidence, versioned agent job/result envelope, prompt/model versions, Gemini output, confidence, safety flags, citations, status transitions, and doctor-review state; verify audit records never contain provider secrets.
- [ ] 4.6 Ensure AI medication suggestions remain advisory and cannot activate prescriptions; verify only the existing authenticated doctor approval transaction can create an active prescription.
- [ ] 4.7 Add API and worker tests for retrieval ranking, patient isolation, weak evidence, conflicting sources, Gemini timeout, invalid output, prompt injection text, retries, and duplicate analysis jobs; verify all tests use isolated fixtures.

## 5. Patient Page AI Assistant Integration

- [x] 5.1 Replace the simulated `setTimeout` analysis in `src/pages/doctor/PatientPage.tsx` with the typed RAG API request; verify the page shows pending/running/complete/error states without silently using static analysis in backend mode.
- [x] 5.2 Add a collapsed `Retrieved Evidence` section between analysis loading and the AI result; verify each source renders title, type, metadata, excerpt, relevance, and citation information.
- [x] 5.3 Replace static research citations with persisted RAG evidence while preserving the existing citation expansion behavior; verify opening a citation does not mutate clinical records.
- [x] 5.4 Preserve and connect the existing AI prescription suggestion review flow to the stored analysis; verify AI suggestions are labeled, require confirmation, and trigger no prescription activation before doctor approval.
- [ ] 5.5 Replace report localStorage behavior with backend report metadata and indexing status when backend mode is enabled; verify upload, indexing, searchable, failure, and retry states render correctly.
- [ ] 5.6 Add loading, empty, unauthorized, insufficient-evidence, stale-data, recoverable-error, and retry UI states; verify the user can distinguish no evidence from a failed analysis.
- [ ] 5.7 Add frontend component tests for evidence rendering, analysis polling, error recovery, citation expansion, report status, and prescription approval boundaries; verify the frontend build succeeds.

## 6. End-to-End Verification and Operations

- [ ] 6.1 Add an end-to-end fictional-data workflow covering doctor login, patient-scoped analysis, evidence display, Gemini result, report indexing, citation inspection, and doctor prescription review; verify no cross-patient evidence is exposed.
- [ ] 6.2 Add configuration and deployment documentation for pgvector, embedding model/version, retrieval top-k/threshold, Gemini credentials, API, worker, and storage; verify documented environment variables match runtime validation.
- [ ] 6.3 Add security review checks for role escalation, cross-patient retrieval, revoked consent, prompt injection, leaked signed URLs, provider-secret exposure, webhook replay, and duplicate jobs; verify findings have mitigations or explicit release blockers.
- [ ] 6.4 Run formatting, type checks, database migrations, authorization tests, API tests, worker tests, frontend tests, frontend build, and end-to-end checks; verify the RAG change is ready for implementation review.
