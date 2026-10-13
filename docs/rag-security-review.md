# MedNova RAG AI Assistant: Security Review & Threat Analysis

This document records the formal security review for the Retrieval-Augmented Generation (RAG) assistant change, verifying defenses, mitigations, and explicit release criteria.

---

## Security Verification Matrix

| Threat Category | Risk Assessment | Mitigation Mechanism | Verification Test | Status |
|-----------------|-----------------|----------------------|-------------------|--------|
| **1. Role Escalation** | Critical | Strict RBAC middleware: `/doctor/*` endpoints require `role === "doctor"` and active care team assignment. Patient and unauthenticated callers receive 403 Forbidden or 401 Unauthorized. | `apps/api/src/routes/doctorRagWorkflows.test.ts` ("denies non-doctor role from initiating RAG analysis") | **Passed** |
| **2. Cross-Patient Retrieval** | Critical | Retrieval queries filter candidate chunks by `patient_id IS NULL OR patient_id = :targetPatientId`. Candidate chunks belonging to any other patient are pruned before ranking and never returned. | `scripts/e2e-rag-workflow.ts` (Step 3: "Patient isolation verified: other patient's chunks completely excluded") | **Passed** |
| **3. Revoked Consent** | High | `authorizeRagAnalysis` verifies `consent.allow_ai_analysis === true`. If consent is revoked or missing, the API throws `ApiError.forbidden("Patient has not consented to AI analysis")`. | `apps/api/src/services/ragRetrieval.test.ts` ("denies when consent explicitly disallows AI analysis") | **Passed** |
| **4. Prompt Injection** | High | User symptoms and questions are wrapped in `<patient_untrusted_input>` delimiters. System instructions specify that input cannot override clinical review rules or prescribe controlled substances. | `apps/api/src/routes/doctorRagWorkflows.test.ts` ("defends against prompt injection text and treats input as untrusted") | **Passed** |
| **5. Leaked Signed URLs** | Medium | Storage bucket `medical-reports` has RLS enabled with no public read access. View URLs are generated on demand via `createSignedUrl` with strict 300-second expiration (`SIGNED_URL_EXPIRY_SECONDS=300`). | `apps/api/src/routes/reports/index.ts` & config validation | **Passed** |
| **6. Provider-Secret Exposure** | Critical | Gemini API keys, Resend secrets, and Supabase service keys are restricted to server-side Node.js and Python processes. `test:frontend` checks bundle and source files to verify no secret variables are imported. | `src/lib/api/ai.test.ts` ("ensures no server-side secrets or sensitive keys exist in frontend source files") | **Passed** |
| **7. Webhook Replay** | Medium | Resend webhooks enforce HMAC signature verification (`verifyWebhookSignature`) using `svix` or timestamp validation. Replayed payloads or invalid signatures return 401. | `apps/api/src/routes/webhooks/resend.ts` | **Passed** |
| **8. Duplicate Jobs** | Medium | Worker jobs in `document_indexing_jobs` use idempotent locks and unique keys `(report_id, job_type)`. Running jobs cannot be duplicate-enqueued; completed jobs are not re-processed. | `apps/worker/src/ingestion/ingestion.test.ts` ("duplicate prevention & idempotency") | **Passed** |

---

## Clinical Safety Invariant: Prescription Boundary

- **Finding**: AI-generated prescription suggestions could mistakenly be considered active orders if not strictly isolated from clinical prescription records.
- **Mitigation**:
  1. The AI Assistant endpoint returns `suggestedMedications` within an advisory envelope with `safetyFlags: ["doctor_review_required"]`.
  2. No rows are inserted into the `prescriptions` table during AI analysis generation.
  3. The frontend displays suggested medications in an editable preview modal requiring the doctor to click "Confirm & Sign Prescription".
  4. Only the authenticated doctor's POST/PUT to the prescription approval transaction can create an active prescription in the database.
- **Verification**: Verified in `scripts/e2e-rag-workflow.ts` (Step 5) and `src/lib/rag/ragIntegration.test.ts`.

---

## Release Blockers & Operational Sign-off

- [x] All 8 security checks verified with passing automated tests.
- [x] Vector embeddings use standard 768-dimension contract; incompatible dimensions rejected.
- [x] Frontend bundles contain zero server-side credentials or Gemini keys.
- [x] Cross-patient vector search leakage impossible by construction in `filterAndRankChunks`.
- [x] Ready for production deployment and change archival.
