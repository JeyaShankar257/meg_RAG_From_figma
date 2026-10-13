# MedNova RAG AI Assistant: Deployment & Configuration Guide

This guide documents configuration, deployment, security invariants, and operational parameters for the evidence-grounded Retrieval-Augmented Generation (RAG) subsystem in MedNova.

---

## 1. Architecture Overview

The MedNova RAG AI Assistant provides evidence-grounded advisory clinical decision support for doctors.

```
┌────────────────┐      HTTPS Bearer      ┌─────────────────┐
│ Doctor Portal  │ ─────────────────────> │   apps/api      │
│ (React/Vite)   │ <───────────────────── │  (Hono Service) │
└────────────────┘   Advisory Hypothesis  └────────┬────────┘
                                                   │
                        ┌──────────────────────────┼──────────────────────────┐
                        ▼                          ▼                          ▼
               ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
               │    PostgreSQL   │        │     Gemini      │        │   apps/worker   │
               │   (pgvector)    │        │ (Advisory LLM)  │        │ (Async Ingest)  │
               └─────────────────┘        └─────────────────┘        └─────────────────┘
```

**Core Safety Contract**:
- AI outputs are **strictly advisory**.
- AI analysis results and medication suggestions **never activate prescriptions**.
- Prescriptions can only be created and activated via an authenticated doctor's explicit approval transaction.

---

## 2. PostgreSQL & pgvector Configuration

### 2.1 Extension & Vector Dimension
- **Extension**: `CREATE EXTENSION IF NOT EXISTS vector;`
- **Vector Dimension Contract**: `vector(768)`
- **Embedding Model**: `text-embedding-004` (version `1`)
- **Metric**: Cosine Distance (`vector_cosine_ops`)

### 2.2 Indexing
HNSW indexing is configured for sub-millisecond approximate nearest neighbor retrieval:
```sql
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 2.3 Database Tables
1. `knowledge_sources`: Metadata, source type (`guideline`, `research`, `medication_reference`, `patient_visit`, `patient_report`), review status (`draft`, `reviewed`, `rejected`), workspace and patient scopes.
2. `knowledge_chunks`: Text chunks, chunk index, 768-dim embedding, model and version tags.
3. `rag_queries`: Audit trail of queries, patient scope, requesting doctor, threshold, top-k, correlation ID.
4. `rag_results`: Retrieved chunks, ranks, similarity scores, and excerpts.
5. `document_indexing_jobs`: Durable queue for asynchronous report PDF extraction and chunking.

---

## 3. Retrieval Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `topK` | `6` | Maximum number of ranked evidence chunks passed to clinical context. |
| `similarityThreshold` | `0.65` | Minimum cosine similarity required for a chunk to be considered relevant. |
| `embeddingModel` | `text-embedding-004` | Model used for vector embeddings. Incompatible models are rejected. |
| `embeddingVersion` | `1` | Schema version for embeddings. Mismatched versions cannot be mixed. |
| `evidenceStatus` | Dynamic | `sufficient` (≥2 chunks), `limited` (1 chunk), `insufficient` (0 chunks). |

---

## 4. Environment Variables

All environment variables must be configured in `.env` files for `apps/api` and `apps/worker`.

### 4.1 Server Secrets (NEVER expose to browser bundles)
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Service role key with admin rights
SUPABASE_ANON_KEY=eyJ...              # Public client anon key

# Gemini AI (Server-side only)
GEMINI_API_KEY=AIzaSy...              # Google Gemini API Key
GEMINI_MODEL=gemini-2.0-flash         # Or gemini-1.5-pro

# API Service
API_PORT=3001
API_ORIGIN=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Medical Reports Storage
REPORTS_BUCKET_NAME=medical-reports
SIGNED_URL_EXPIRY_SECONDS=300

# Background Worker
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENT_JOBS=5

# Mode
DEMO_MODE=false                       # Set to "false" in production
```

---

## 5. Security & Isolation Invariants

1. **Patient Scoping & RLS**:
   - Chunks with a non-null `patient_id` are strictly isolated to that specific patient.
   - Doctor care-team assignment and patient consent (`allow_ai_analysis = true`) are enforced before retrieval.
   - Cross-patient records are never returned in search results.
2. **Untrusted Evidence Delimiters**:
   - Patient-reported symptoms, notes, and uploaded document text are enclosed within untrusted delimiters (`<patient_untrusted_input>`).
   - Instructions inside user text (e.g., prompt injections attempting to bypass doctor review) are ignored by the agent prompt.
3. **Audit Trail**:
   - Every RAG query records `requested_by_profile_id`, `correlation_id`, `retrieval_configuration`, and retrieved chunks in `rag_queries` and `rag_results`.
   - Audit records NEVER log API keys or provider secrets.
4. **Storage Security**:
   - `medical-reports` storage bucket is private.
   - Time-limited signed URLs (`SIGNED_URL_EXPIRY_SECONDS=300`) are used for viewing reports.

---

## 6. Verification Checklist

Run full test suite and verification commands:
```bash
# Verify backend typecheck and Python agent tests
pnpm run verify:backend

# Run API test suites (all 7 files, 65 tests)
pnpm --filter @mednova/api test

# Run Worker ingestion & PDF extractor tests
pnpm --filter @mednova/worker test

# Run Frontend unit & RAG integration tests
pnpm run test:frontend

# Run End-to-End RAG Fictional Data Workflow
pnpm run e2e:rag

# Build frontend production bundle
pnpm run build
```
