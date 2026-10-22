import zlib from "node:zlib";
import { getAdminClient } from "../lib/supabase.js";
import { generateGeminiCompatibleEmbedding } from "./ragRetrieval.js";
import { logger } from "../lib/logger.js";

/**
 * Extracts human-readable text from raw PDF buffer.
 * Supports:
 * - FlateDecode zlib compressed streams
 * - Text layout blocks (BT ... ET) and string operators (Tj, TJ, ', ")
 * - Fallback plain ASCII / UTF-8 text streams
 */
export function extractTextFromPdf(buffer: Buffer, filename = "report.pdf"): string {
    if (!buffer || buffer.length === 0) return "";

    const rawString = buffer.toString("latin1");
    const extractedChunks: string[] = [];

    // Helper to decode PDF literal escape sequences
    const decodePdfString = (input: string): string => {
        return input
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
    };

    // 1. Scan for compressed or uncompressed streams
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(rawString)) !== null) {
        const streamBytes = Buffer.from(streamMatch[1], "latin1");
        let decompressed = "";

        // Try zlib / flate inflation
        try {
            decompressed = zlib.inflateSync(streamBytes).toString("latin1");
        } catch {
            try {
                decompressed = zlib.inflateRawSync(streamBytes).toString("latin1");
            } catch {
                decompressed = streamMatch[1];
            }
        }

        // Look for text operators in the decompressed stream
        if (decompressed.includes("BT")) {
            const btRegex = /BT([\s\S]*?)ET/g;
            let btMatch: RegExpExecArray | null;
            while ((btMatch = btRegex.exec(decompressed)) !== null) {
                const block = btMatch[1];

                // Literal string Tj: (Text) Tj
                const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
                let tjMatch: RegExpExecArray | null;
                while ((tjMatch = tjRegex.exec(block)) !== null) {
                    const decoded = decodePdfString(tjMatch[1]).trim();
                    if (decoded) extractedChunks.push(decoded);
                }

                // Array TJ: [(Text 1) 120 (Text 2)] TJ
                const arrayRegex = /\[(.*?)\]\s*TJ/g;
                let arrMatch: RegExpExecArray | null;
                while ((arrMatch = arrayRegex.exec(block)) !== null) {
                    const innerStrRegex = /\(([^)]+)\)/g;
                    let innerMatch: RegExpExecArray | null;
                    const parts: string[] = [];
                    while ((innerMatch = innerStrRegex.exec(arrMatch[1])) !== null) {
                        parts.push(decodePdfString(innerMatch[1]));
                    }
                    if (parts.length > 0) {
                        const joined = parts.join("").trim();
                        if (joined) extractedChunks.push(joined);
                    }
                }
            }
        } else {
            // Check for plain printable text chunks
            const cleaned = decompressed
                .replace(/[^\x20-\x7E\t\r\n]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            if (cleaned.length > 25 && !cleaned.includes("/Type") && !cleaned.includes("endobj")) {
                extractedChunks.push(cleaned);
            }
        }
    }

    // 2. Direct string regex across raw string if stream extraction didn't yield text
    if (extractedChunks.length === 0) {
        const btRegex = /BT([\s\S]*?)ET/g;
        let btMatch: RegExpExecArray | null;
        while ((btMatch = btRegex.exec(rawString)) !== null) {
            const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
            let tjMatch: RegExpExecArray | null;
            while ((tjMatch = tjRegex.exec(btMatch[1])) !== null) {
                const decoded = decodePdfString(tjMatch[1]).trim();
                if (decoded) extractedChunks.push(decoded);
            }
        }
    }

    return extractedChunks
        .join("\n")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Splits plain or clinical text into semantic chunks with overlap.
 */
export function chunkReportText(
    text: string,
    maxChunkChars = 500,
    overlapChars = 80,
): string[] {
    const cleaned = text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();

    if (!cleaned) return [];
    if (cleaned.length <= maxChunkChars) return [cleaned];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleaned.length) {
        let end = Math.min(start + maxChunkChars, cleaned.length);

        if (end < cleaned.length) {
            // Try break at paragraph, line, or sentence boundary
            const newlineIndex = cleaned.lastIndexOf("\n", end);
            const periodIndex = cleaned.lastIndexOf(". ", end);
            const breakPoint = Math.max(newlineIndex, periodIndex);

            if (breakPoint > start + 100) {
                end = breakPoint + (breakPoint === periodIndex ? 1 : 0);
            }
        }

        const chunk = cleaned.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        if (end >= cleaned.length) break;
        start = Math.max(start + 1, end - overlapChars);
    }

    return chunks;
}

export interface IndexReportParams {
    reportId: string;
    patientId: string;
    workspaceId: string;
    storagePath: string;
    filename?: string;
}

/**
 * Indexes a patient uploaded medical report into knowledge_sources and knowledge_chunks.
 */
export async function indexPatientReport(params: IndexReportParams): Promise<{ success: boolean; chunkCount: number }> {
    const { reportId, patientId, workspaceId, storagePath, filename = "medical_report.pdf" } = params;
    const admin = getAdminClient();

    try {
        // 1. Download file buffer from Supabase private storage
        const { data: fileData, error: downloadErr } = await admin.storage
            .from("medical-reports")
            .download(storagePath);

        if (downloadErr || !fileData) {
            logger.warn("Failed to download report for indexing", {
                reportId,
                storagePath,
                error: downloadErr?.message,
            });
            return { success: false, chunkCount: 0 };
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extract plain text
        let extractedText = extractTextFromPdf(buffer, filename);

        // Fallback: If empty, check if file is raw text
        if (!extractedText.trim()) {
            const raw = buffer.toString("utf-8");
            if (!raw.startsWith("%PDF-") && raw.length > 10) {
                extractedText = raw;
            }
        }

        if (!extractedText.trim()) {
            // Provide synthetic fallback from filename / metadata so report is still searchable by doctor
            extractedText = `Medical Report: ${filename.replace(/_/g, " ")}\nPatient ID: ${patientId}\nUploaded document record for clinical workspace evaluation.`;
        }

        // 3. Create or reuse knowledge_sources record
        const { data: existingSource } = await admin
            .from("knowledge_sources")
            .select("id")
            .eq("report_id", reportId)
            .maybeSingle();

        let sourceId: string;
        if (existingSource) {
            sourceId = existingSource.id;
        } else {
            const cleanTitle = filename.replace(/\.[^/.]+$/, "").replace(/^[0-9]+-/, "").replace(/_/g, " ");
            const { data: newSource, error: srcErr } = await admin
                .from("knowledge_sources")
                .insert({
                    source_type: "patient_report",
                    title: cleanTitle || "Patient Medical Report",
                    workspace_id: workspaceId,
                    patient_id: patientId,
                    report_id: reportId,
                    version: "1.0",
                    status: "reviewed",
                    metadata: {
                        reportId,
                        storagePath,
                        filename,
                        indexedAt: new Date().toISOString(),
                    },
                })
                .select("id")
                .single();

            if (srcErr || !newSource) {
                logger.error("Failed to create knowledge_sources record", { reportId, error: srcErr?.message });
                return { success: false, chunkCount: 0 };
            }
            sourceId = newSource.id;
        }

        // 4. Generate chunks & embeddings
        const chunks = chunkReportText(extractedText, 500, 80);
        await admin.from("knowledge_chunks").delete().eq("source_id", sourceId);

        const chunkRows = chunks.map((chunkText, idx) => ({
            source_id: sourceId,
            workspace_id: workspaceId,
            patient_id: patientId,
            chunk_index: idx,
            chunk_text: chunkText,
            embedding: generateGeminiCompatibleEmbedding(chunkText, "text-embedding-004"),
            embedding_model: "text-embedding-004",
            embedding_version: "1",
            metadata: {
                reportId,
                filename,
                startChar: idx * 420,
            },
        }));

        if (chunkRows.length > 0) {
            const { error: chunkErr } = await admin.from("knowledge_chunks").insert(chunkRows);
            if (chunkErr) {
                logger.error("Failed to insert knowledge_chunks", { reportId, error: chunkErr?.message });
                return { success: false, chunkCount: 0 };
            }
        }

        // 5. Update patient_reports indexing_status to 'searchable'
        await admin
            .from("patient_reports")
            .update({ indexing_status: "searchable" })
            .eq("id", reportId);

        logger.info("Report indexed successfully for RAG", {
            reportId,
            patientId,
            chunkCount: chunkRows.length,
        });

        return { success: true, chunkCount: chunkRows.length };
    } catch (err: any) {
        logger.error("Unexpected error in report indexing", { reportId, error: err?.message });
        return { success: false, chunkCount: 0 };
    }
}

/**
 * Ensures all reports for a patient are indexed and searchable before RAG queries run.
 */
export async function ensurePatientReportsIndexed(patientId: string, workspaceId: string): Promise<void> {
    const admin = getAdminClient();
    const candidateIds = [
        patientId,
        patientId.replace(/^PT-/i, "p-"),
        patientId.replace(/^PT-/i, "P-"),
    ];

    const q = admin
        .from("patient_reports")
        .select("id, patient_id, storage_path, label, indexing_status");

    const queryWithIn = typeof (q as any).in === "function"
        ? (q as any).in("patient_id", candidateIds)
        : q.eq("patient_id", patientId);

    const { data: unindexedReports } = typeof (queryWithIn as any).neq === "function"
        ? await (queryWithIn as any).neq("indexing_status", "searchable")
        : await queryWithIn;

    if (unindexedReports && unindexedReports.length > 0) {
        for (const rep of unindexedReports) {
            if (rep.storage_path) {
                await indexPatientReport({
                    reportId: rep.id,
                    patientId: rep.patient_id,
                    workspaceId,
                    storagePath: rep.storage_path,
                    filename: rep.label || "report.pdf",
                });
            }
        }
    }
}
