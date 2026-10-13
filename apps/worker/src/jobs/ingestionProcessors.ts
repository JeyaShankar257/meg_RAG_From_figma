import type { SupabaseClient } from "@supabase/supabase-js";
import type { DurableJob } from "../queue/durableQueue.js";
import type { JobProcessResult } from "./processors.js";
import { StandardPdfExtractor, type PdfExtractionAdapter } from "../ingestion/pdfExtractor.js";
import { chunkAndEmbedReportText, generateGeminiCompatibleEmbedding } from "../ingestion/chunker.js";

export interface IndexUploadedReportPayload {
    reportId: string;
    patientId: string;
    workspaceId: string;
    storagePath?: string;
    filename?: string;
    mimeType?: string;
    fileContent?: string; // Base64 or plain string for fixtures/testing
}

/**
 * Durable report indexing job processor (Task 3.3 & 3.4).
 * Orchestrates:
 * 1. Status transition: uploaded -> indexing
 * 2. File retrieval & PDF text extraction
 * 3. Text normalization and ordered chunking
 * 4. Gemini-compatible 768-dim embedding generation
 * 5. Idempotent storage (prevents chunk duplication on retries)
 * 6. Status transition: indexing -> searchable (or failed)
 * 7. Preserves report availability independently from indexing outcome
 */
export async function processIndexUploadedReport(
    job: DurableJob,
    supabase: SupabaseClient,
    extractor: PdfExtractionAdapter = new StandardPdfExtractor(),
): Promise<JobProcessResult> {
    const payload = job.payload as IndexUploadedReportPayload;
    const { reportId, patientId, workspaceId, filename = "report.pdf", storagePath, fileContent } = payload;

    if (!reportId || !patientId || !workspaceId) {
        return {
            success: false,
            error: "Missing required fields (reportId, patientId, workspaceId) in indexing payload",
            retryable: false,
        };
    }

    // 1. Mark report indexing_status as 'indexing'
    await supabase
        .from("patient_reports")
        .update({ indexing_status: "indexing" })
        .eq("id", reportId);

    // Also update document_indexing_jobs status if row exists
    await supabase
        .from("document_indexing_jobs")
        .update({ status: "indexing", updated_at: new Date().toISOString() })
        .eq("report_id", reportId);

    // 2. Obtain report file buffer
    let fileBuffer: Buffer;

    if (fileContent) {
        // Provided directly in job payload (fixtures / tests)
        fileBuffer = fileContent.startsWith("%PDF-")
            ? Buffer.from(fileContent, "latin1")
            : Buffer.from(fileContent, "base64");
    } else if (storagePath) {
        // Download from Supabase private storage
        const { data: fileData, error: downloadErr } = await supabase.storage
            .from("medical-reports")
            .download(storagePath);

        if (downloadErr || !fileData) {
            const errorMsg = `Failed to download report from storage: ${downloadErr?.message || "File not found"}`;
            await recordIndexingFailure(supabase, reportId, errorMsg);
            return { success: false, retryable: true, error: errorMsg };
        }

        const arrayBuffer = await fileData.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
    } else {
        const errorMsg = "No file content or storage path provided for report indexing";
        await recordIndexingFailure(supabase, reportId, errorMsg);
        return { success: false, retryable: false, error: errorMsg };
    }

    // 3. Extract text via PDF adapter
    const extractionResult = await extractor.extractText(fileBuffer, filename);

    if (!extractionResult.success || !extractionResult.text) {
        const failureReason = extractionResult.error || "Text extraction produced empty text";
        await recordIndexingFailure(supabase, reportId, failureReason);
        return {
            success: false,
            retryable: extractionResult.errorCode === "extraction_failed" && job.attempts < job.max_attempts,
            error: failureReason,
        };
    }

    // 4. Create or obtain knowledge_source record for this report
    let sourceId: string;
    const { data: existingSource } = await supabase
        .from("knowledge_sources")
        .select("id")
        .eq("report_id", reportId)
        .maybeSingle();

    if (existingSource) {
        sourceId = existingSource.id;
    } else {
        const { data: newSource, error: srcErr } = await supabase
            .from("knowledge_sources")
            .insert({
                source_type: "patient_report",
                title: filename.replace(/\.[^/.]+$/, ""),
                workspace_id: workspaceId,
                patient_id: patientId,
                report_id: reportId,
                version: "1.0",
                status: "reviewed",
                metadata: {
                    reportId,
                    indexedAt: new Date().toISOString(),
                    pageCount: extractionResult.pageCount || 1,
                },
            })
            .select("id")
            .single();

        if (srcErr || !newSource) {
            const err = `Failed to create knowledge source: ${srcErr?.message}`;
            await recordIndexingFailure(supabase, reportId, err);
            return { success: false, retryable: true, error: err };
        }
        sourceId = newSource.id;
    }

    // 5. Chunk and embed normalized report text
    const chunks = chunkAndEmbedReportText(extractionResult.text, {
        sourceId,
        patientId,
        workspaceId,
        reportId,
        embeddingModel: "text-embedding-004",
        embeddingVersion: "1",
    });

    // 6. Idempotently write chunks: Delete any pre-existing chunks for this source to prevent duplicate chunks on retry
    await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId);

    const chunkRows = chunks.map((c) => ({
        source_id: sourceId,
        workspace_id: workspaceId,
        patient_id: patientId,
        chunk_index: c.chunkIndex,
        chunk_text: c.chunkText,
        embedding: c.embedding,
        embedding_model: c.embeddingModel,
        embedding_version: c.embeddingVersion,
        metadata: c.metadata,
    }));

    if (chunkRows.length > 0) {
        const { error: chunkErr } = await supabase.from("knowledge_chunks").insert(chunkRows);
        if (chunkErr) {
            const err = `Failed to persist knowledge chunks: ${chunkErr.message}`;
            await recordIndexingFailure(supabase, reportId, err);
            return { success: false, retryable: true, error: err };
        }
    }

    // 7. Successful completion: transition report indexing_status to 'searchable'
    await supabase
        .from("patient_reports")
        .update({ indexing_status: "searchable" })
        .eq("id", reportId);

    await supabase
        .from("document_indexing_jobs")
        .update({
            status: "searchable",
            source_id: sourceId,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("report_id", reportId);

    return { success: true };
}

/**
 * Durable generate_embedding job processor (Task 3.3).
 * Generates and updates 768-dim embeddings for knowledge chunks with backoff and retry handling.
 */
export async function processGenerateEmbedding(
    job: DurableJob,
    supabase: SupabaseClient,
): Promise<JobProcessResult> {
    const { chunkId, chunkText, model = "text-embedding-004" } = job.payload;

    if (!chunkId || !chunkText) {
        return { success: false, error: "Missing chunkId or chunkText in embedding payload", retryable: false };
    }

    try {
        const embedding = generateGeminiCompatibleEmbedding(chunkText, model);

        const { error: updateErr } = await supabase
            .from("knowledge_chunks")
            .update({
                embedding,
                embedding_model: model,
                embedding_version: "1",
            })
            .eq("id", chunkId);

        if (updateErr) {
            return { success: false, retryable: true, error: updateErr.message };
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, retryable: true, error: `Embedding generation failed: ${err.message}` };
    }
}

async function recordIndexingFailure(supabase: SupabaseClient, reportId: string, error: string): Promise<void> {
    await supabase
        .from("patient_reports")
        .update({ indexing_status: "failed" })
        .eq("id", reportId);

    await supabase
        .from("document_indexing_jobs")
        .update({
            status: "failed",
            last_error: error,
            updated_at: new Date().toISOString(),
        })
        .eq("report_id", reportId);
}
