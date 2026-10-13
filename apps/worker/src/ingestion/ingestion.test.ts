import { describe, it, expect, vi, beforeEach } from "vitest";
import { StandardPdfExtractor } from "./pdfExtractor.js";
import { normalizeReportText, chunkAndEmbedReportText, generateGeminiCompatibleEmbedding } from "./chunker.js";
import { processIndexUploadedReport, processGenerateEmbedding } from "../jobs/ingestionProcessors.js";
import type { DurableJob } from "../queue/durableQueue.js";

// Helper to construct a minimal valid PDF byte stream with text
function createMinimalValidPdf(textContent: string): Buffer {
    const stream = `BT /F1 12 Tf 72 712 Td (${textContent}) Tj ET`;
    const streamLength = stream.length;

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

    return Buffer.from(pdf, "latin1");
}

describe("Report and Knowledge Ingestion Pipeline (Task 3.1 - 3.5)", () => {
    describe("PDF Extraction Adapter (Task 3.1)", () => {
        const extractor = new StandardPdfExtractor();

        it("extracts text and page count from valid PDF stream", async () => {
            const pdfBuffer = createMinimalValidPdf("Comprehensive Metabolic Panel: Glucose 105 mg/dL");
            const result = await extractor.extractText(pdfBuffer, "lab_report.pdf");

            expect(result.success).toBe(true);
            expect(result.text).toContain("Comprehensive Metabolic Panel: Glucose 105 mg/dL");
            expect(result.pageCount).toBeGreaterThanOrEqual(1);
        });

        it("produces safe indexing error for zero-byte or empty buffer", async () => {
            const result = await extractor.extractText(Buffer.alloc(0));
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe("invalid_format");
            expect(result.error).toContain("Empty or zero-byte file");
        });

        it("produces safe indexing error for non-PDF file", async () => {
            const result = await extractor.extractText(Buffer.from("This is a plain text file, not a PDF."));
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe("invalid_format");
            expect(result.error).toContain("does not contain valid PDF magic header");
        });

        it("produces safe indexing error for truncated corrupted PDF", async () => {
            const result = await extractor.extractText(Buffer.from("%PDF-1.4 Truncated"));
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe("corrupted");
            expect(result.error).toContain("missing EOF trailer");
        });

        it("produces safe indexing error for password-protected/encrypted PDF", async () => {
            const encryptedPdf = Buffer.from(
                "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n/Encrypt 5 0 R\n%%EOF",
            );
            const result = await extractor.extractText(encryptedPdf);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe("unsupported");
            expect(result.error).toContain("encrypted");
        });
    });

    describe("Report Normalization, Chunking & Embeddings (Task 3.2)", () => {
        it("normalizes whitespace and removes control characters", () => {
            const raw = "Patient Note:\r\n\r\n\tHbA1c test\x00 resulted in   7.2%.\n\n\n\nFollow up scheduled.";
            const normalized = normalizeReportText(raw);

            expect(normalized).not.toContain("\r");
            expect(normalized).not.toContain("\x00");
            expect(normalized).not.toContain("   ");
            expect(normalized).toContain("HbA1c test resulted in 7.2%.");
        });

        it("splits text into ordered chunks and preserves metadata and patient scope", () => {
            const sampleText =
                "Section 1: Patient presents with mild persistent dry cough.\n\n" +
                "Section 2: Started Lisinopril 20mg daily two weeks ago.\n\n" +
                "Section 3: Lungs clear on auscultation. Blood pressure is 128/82 mmHg.\n\n" +
                "Section 4: Assessment and plan: Suspected ACE inhibitor cough. Discontinue Lisinopril.";

            const chunks = chunkAndEmbedReportText(sampleText, {
                sourceId: "src-001",
                patientId: "p-001",
                workspaceId: "ws-001",
                reportId: "rep-001",
                maxChunkChars: 120,
                overlapChars: 20,
            });

            expect(chunks.length).toBeGreaterThanOrEqual(2);

            // Verify sequential chunk order
            for (let i = 0; i < chunks.length; i++) {
                expect(chunks[i].chunkIndex).toBe(i);
                expect(chunks[i].metadata.sourceId).toBe("src-001");
                expect(chunks[i].metadata.patientId).toBe("p-001");
                expect(chunks[i].metadata.workspaceId).toBe("ws-001");
                expect(chunks[i].metadata.reportId).toBe("rep-001");
                expect(chunks[i].embedding).toHaveLength(768);
                expect(chunks[i].embeddingModel).toBe("text-embedding-004");
                expect(chunks[i].embeddingVersion).toBe("1");
            }
        });

        it("generates normalized 768-dimension Gemini-compatible embeddings", () => {
            const embedding = generateGeminiCompatibleEmbedding("Lisinopril 20mg oral tablet");
            expect(embedding).toHaveLength(768);

            // Verify L2 unit norm
            const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            expect(norm).toBeCloseTo(1.0, 3);
        });
    });

    describe("Durable Indexing Job Execution, Idempotency & Status Transitions (Task 3.3 & 3.4)", () => {
        let mockTables: Record<string, any[]>;
        let mockSupabase: any;

        beforeEach(() => {
            mockTables = {
                patient_reports: [
                    {
                        id: "rep-100",
                        patient_id: "p-001",
                        indexing_status: "uploaded",
                    },
                ],
                document_indexing_jobs: [],
                knowledge_sources: [],
                knowledge_chunks: [],
            };

            mockSupabase = {
                from: (table: string) => {
                    const query: any = {
                        select: vi.fn().mockReturnThis(),
                        insert: vi.fn().mockImplementation((rows: any) => {
                            const arr = Array.isArray(rows) ? rows : [rows];
                            const insertedRows: any[] = [];
                            for (const r of arr) {
                                const rowWithId = { id: r.id || `gen-${Math.random()}`, ...r };
                                mockTables[table].push(rowWithId);
                                insertedRows.push(rowWithId);
                            }
                            return {
                                data: insertedRows,
                                error: null,
                                select: () => ({
                                    single: async () => ({ data: insertedRows[0], error: null }),
                                }),
                            };
                        }),
                        update: vi.fn().mockImplementation((updates: any) => {
                            return {
                                eq: (col: string, val: any) => {
                                    for (const r of mockTables[table]) {
                                        if (r[col] === val) {
                                            Object.assign(r, updates);
                                        }
                                    }
                                    return { data: null, error: null };
                                },
                            };
                        }),
                        delete: vi.fn().mockImplementation(() => {
                            return {
                                eq: (col: string, val: any) => {
                                    mockTables[table] = mockTables[table].filter((r) => r[col] !== val);
                                    return { data: null, error: null };
                                },
                            };
                        }),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockImplementation(async () => {
                            return { data: mockTables[table][0] || null, error: null };
                        }),
                        single: vi.fn().mockImplementation(async () => {
                            return { data: mockTables[table][0] || null, error: null };
                        }),
                    };
                    return query;
                },
            };
        });

        it("transitions status to searchable and persists chunks", async () => {
            const validPdfBuffer = createMinimalValidPdf("Potassium 4.5 mEq/L, Creatinine 0.9 mg/dL");
            const job: DurableJob = {
                id: "job-idx-1",
                type: "index_uploaded_report",
                payload: {
                    reportId: "rep-100",
                    patientId: "p-001",
                    workspaceId: "ws-001",
                    filename: "metabolic_panel.pdf",
                    fileContent: validPdfBuffer.toString("latin1"),
                },
                status: "claimed",
                idempotency_key: "idx-rep-100",
                correlation_id: "req-100",
                attempts: 1,
                max_attempts: 3,
                next_run_at: new Date().toISOString(),
            };

            const result = await processIndexUploadedReport(job, mockSupabase);

            expect(result.success).toBe(true);
            // Verify report status transitioned to searchable
            expect(mockTables.patient_reports[0].indexing_status).toBe("searchable");
            // Verify knowledge source was created
            expect(mockTables.knowledge_sources.length).toBe(1);
            expect(mockTables.knowledge_sources[0].source_type).toBe("patient_report");
            // Verify chunks were persisted
            expect(mockTables.knowledge_chunks.length).toBeGreaterThan(0);
            expect(mockTables.knowledge_chunks[0].patient_id).toBe("p-001");
        });

        it("is idempotent and does not duplicate chunks on retry", async () => {
            const validPdfBuffer = createMinimalValidPdf("Normal sinus rhythm noted.");
            const job: DurableJob = {
                id: "job-idx-retry",
                type: "index_uploaded_report",
                payload: {
                    reportId: "rep-100",
                    patientId: "p-001",
                    workspaceId: "ws-001",
                    filename: "ecg_report.pdf",
                    fileContent: validPdfBuffer.toString("latin1"),
                },
                status: "claimed",
                idempotency_key: "idx-rep-100",
                correlation_id: "req-100",
                attempts: 1,
                max_attempts: 3,
                next_run_at: new Date().toISOString(),
            };

            // First run
            await processIndexUploadedReport(job, mockSupabase);
            const countAfterFirstRun = mockTables.knowledge_chunks.length;
            expect(countAfterFirstRun).toBeGreaterThan(0);

            // Retry execution (attempt 2)
            job.attempts = 2;
            await processIndexUploadedReport(job, mockSupabase);
            const countAfterRetry = mockTables.knowledge_chunks.length;

            // Chunks should NOT be duplicated
            expect(countAfterRetry).toBe(countAfterFirstRun);
        });

        it("records failure without deleting report record on malformed file", async () => {
            const job: DurableJob = {
                id: "job-idx-fail",
                type: "index_uploaded_report",
                payload: {
                    reportId: "rep-100",
                    patientId: "p-001",
                    workspaceId: "ws-001",
                    filename: "corrupt.pdf",
                    fileContent: "Not a valid PDF at all",
                },
                status: "claimed",
                idempotency_key: "idx-rep-corrupt",
                correlation_id: "req-fail",
                attempts: 1,
                max_attempts: 3,
                next_run_at: new Date().toISOString(),
            };

            const result = await processIndexUploadedReport(job, mockSupabase);

            expect(result.success).toBe(false);
            // Report record still exists in database!
            expect(mockTables.patient_reports.length).toBe(1);
            // Report status is marked failed
            expect(mockTables.patient_reports[0].indexing_status).toBe("failed");
        });

        it("processes generate_embedding job and updates chunk", async () => {
            mockTables.knowledge_chunks.push({
                id: "chunk-xyz",
                chunk_text: "Cardiology follow up recommendation",
                embedding: [],
            });

            const job: DurableJob = {
                id: "job-emb-1",
                type: "generate_embedding",
                payload: {
                    chunkId: "chunk-xyz",
                    chunkText: "Cardiology follow up recommendation",
                    model: "text-embedding-004",
                },
                status: "claimed",
                idempotency_key: "emb-chunk-xyz",
                correlation_id: "req-emb",
                attempts: 1,
                max_attempts: 3,
                next_run_at: new Date().toISOString(),
            };

            const result = await processGenerateEmbedding(job, mockSupabase);

            expect(result.success).toBe(true);
            expect(mockTables.knowledge_chunks[0].embedding).toHaveLength(768);
            expect(mockTables.knowledge_chunks[0].embedding_model).toBe("text-embedding-004");
        });
    });
});
