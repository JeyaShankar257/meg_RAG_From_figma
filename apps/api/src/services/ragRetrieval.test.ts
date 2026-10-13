import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    cosineSimilarity,
    filterAndRankChunks,
    mapRankedResultsToEvidence,
    authorizeRagAnalysis,
    authorizeKnowledgeSourceIngestion,
    type VectorSearchCandidate,
} from "./ragRetrieval.js";
import type { UserContext, PatientContext, ConsentRecord, CareTeamAssignmentRecord } from "./authorization.js";

// Helper to generate a normalized 768-dimension synthetic embedding vector
function generateSyntheticEmbedding(biasIndex: number, magnitude = 1.0): number[] {
    const vec = new Array(768).fill(0.01);
    // Introduce distinctive pattern at specified position
    vec[biasIndex % 768] = magnitude;
    vec[(biasIndex + 10) % 768] = magnitude * 0.8;
    vec[(biasIndex + 20) % 768] = magnitude * 0.5;

    // Normalize vector
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map((val) => Number((val / norm).toFixed(6)));
}

describe("RAG Vector Data & Retrieval Model (Task 2.1 - 2.5)", () => {
    const workspace1 = "a0000000-0000-0000-0000-000000000001";
    const workspace2 = "a0000000-0000-0000-0000-000000000002";

    const patientA = "p-001";
    const patientB = "p-002";

    // Standard 768-dim query embedding
    const queryEmbedding = generateSyntheticEmbedding(42, 1.0);

    // High match embedding (close to queryEmbedding)
    const highMatchEmbedding = generateSyntheticEmbedding(42, 0.95);
    // Medium match embedding
    const mediumMatchEmbedding = generateSyntheticEmbedding(42, 0.68);
    // Low match embedding (dissimilar direction)
    const lowMatchEmbedding = generateSyntheticEmbedding(500, 1.0);

    describe("768-Dimension Vector Contract & Cosine Similarity (Task 2.1 & 2.2)", () => {
        it("computes accurate cosine similarity between 768-dimensional vectors", () => {
            const simSelf = cosineSimilarity(queryEmbedding, queryEmbedding);
            expect(simSelf).toBeCloseTo(1.0, 4);

            const simHigh = cosineSimilarity(queryEmbedding, highMatchEmbedding);
            expect(simHigh).toBeGreaterThan(0.9);

            const simLow = cosineSimilarity(queryEmbedding, lowMatchEmbedding);
            expect(simLow).toBeLessThan(0.4);
        });

        it("strictly enforces 768-dimensional contract and rejects mismatched dimensions", () => {
            const shortVector = [0.1, 0.2, 0.3];
            expect(() => cosineSimilarity(queryEmbedding, shortVector)).toThrow(/Vector dimension mismatch/);
            expect(() => cosineSimilarity([], [])).toThrow(/Vector dimension mismatch/);
        });

        it("rejects incompatible embedding model or version from being mixed silently", () => {
            const candidateWithWrongVersion: VectorSearchCandidate = {
                chunk: {
                    id: "chk-old",
                    sourceId: "src-old",
                    workspaceId: workspace1,
                    chunkIndex: 0,
                    chunkText: "Old embedding version chunk",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "v0.9-legacy", // incompatible version!
                },
                source: {
                    id: "src-old",
                    sourceType: "guideline",
                    title: "Old Guideline",
                    workspaceId: workspace1,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const candidateWithWrongModel: VectorSearchCandidate = {
                chunk: {
                    id: "chk-other-model",
                    sourceId: "src-other-model",
                    workspaceId: workspace1,
                    chunkIndex: 0,
                    chunkText: "Different model chunk",
                    embedding: highMatchEmbedding,
                    embeddingModel: "bert-base-uncased", // incompatible model!
                    embeddingVersion: "1",
                },
                source: {
                    id: "src-other-model",
                    sourceType: "guideline",
                    title: "Different Model Guideline",
                    workspaceId: workspace1,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                embeddingModel: "text-embedding-004",
                embeddingVersion: "1",
                candidates: [candidateWithWrongVersion, candidateWithWrongModel],
            });

            expect(results).toHaveLength(0);
        });
    });

    describe("Vector Similarity Search, Thresholding & Deterministic Ranking (Task 2.3)", () => {
        it("ranks candidates by similarity score descending and applies top-6 limit", () => {
            const candidates: VectorSearchCandidate[] = [
                {
                    chunk: {
                        id: "c-med",
                        sourceId: "s-med",
                        workspaceId: workspace1,
                        chunkIndex: 0,
                        chunkText: "Medium match chunk text",
                        embedding: mediumMatchEmbedding,
                        embeddingModel: "text-embedding-004",
                        embeddingVersion: "1",
                    },
                    source: {
                        id: "s-med",
                        sourceType: "research",
                        title: "Medium Match Study",
                        workspaceId: workspace1,
                        version: "1.0",
                        status: "reviewed",
                    },
                },
                {
                    chunk: {
                        id: "c-high",
                        sourceId: "s-high",
                        workspaceId: workspace1,
                        chunkIndex: 0,
                        chunkText: "High match chunk text",
                        embedding: highMatchEmbedding,
                        embeddingModel: "text-embedding-004",
                        embeddingVersion: "1",
                    },
                    source: {
                        id: "s-high",
                        sourceType: "guideline",
                        title: "High Match Guideline",
                        workspaceId: workspace1,
                        version: "1.0",
                        status: "reviewed",
                    },
                },
            ];

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                similarityThreshold: 0.65,
                candidates,
            });

            expect(results).toHaveLength(2);
            expect(results[0].chunkId).toBe("c-high");
            expect(results[0].rank).toBe(1);
            expect(results[1].chunkId).toBe("c-med");
            expect(results[1].rank).toBe(2);
        });

        it("filters out chunks below configurable minimum similarity threshold", () => {
            const candidateLow: VectorSearchCandidate = {
                chunk: {
                    id: "c-low",
                    sourceId: "s-low",
                    workspaceId: workspace1,
                    chunkIndex: 0,
                    chunkText: "Low match irrelevant text",
                    embedding: lowMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-low",
                    sourceType: "research",
                    title: "Low Match Study",
                    workspaceId: workspace1,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                similarityThreshold: 0.65,
                candidates: [candidateLow],
            });

            expect(results).toHaveLength(0);
        });

        it("breaks similarity ties deterministically using chunkIndex ascending", () => {
            const candidateA: VectorSearchCandidate = {
                chunk: {
                    id: "c-idx-2",
                    sourceId: "s-tied",
                    workspaceId: workspace1,
                    chunkIndex: 2,
                    chunkText: "Part 2",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-tied",
                    sourceType: "guideline",
                    title: "Tied Guideline",
                    workspaceId: workspace1,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const candidateB: VectorSearchCandidate = {
                chunk: {
                    id: "c-idx-0",
                    sourceId: "s-tied",
                    workspaceId: workspace1,
                    chunkIndex: 0,
                    chunkText: "Part 0",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-tied",
                    sourceType: "guideline",
                    title: "Tied Guideline",
                    workspaceId: workspace1,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                candidates: [candidateA, candidateB],
            });

            expect(results[0].chunkId).toBe("c-idx-0");
            expect(results[1].chunkId).toBe("c-idx-2");
        });
    });

    describe("Cross-Patient Isolation & Authorization Boundaries (Task 2.4)", () => {
        it("strictly prevents chunks from patient B from appearing in retrieval results for patient A", () => {
            const patientBChunk: VectorSearchCandidate = {
                chunk: {
                    id: "c-patient-b",
                    sourceId: "s-patient-b",
                    workspaceId: workspace1,
                    patientId: patientB, // belongs to patient B
                    chunkIndex: 0,
                    chunkText: "Confidential record of patient B",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-patient-b",
                    sourceType: "patient_visit",
                    title: "Patient B Visit",
                    workspaceId: workspace1,
                    patientId: patientB,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const patientAChunk: VectorSearchCandidate = {
                chunk: {
                    id: "c-patient-a",
                    sourceId: "s-patient-a",
                    workspaceId: workspace1,
                    patientId: patientA, // belongs to patient A
                    chunkIndex: 0,
                    chunkText: "Authorized record of patient A",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-patient-a",
                    sourceType: "patient_visit",
                    title: "Patient A Visit",
                    workspaceId: workspace1,
                    patientId: patientA,
                    version: "1.0",
                    status: "reviewed",
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA, // requesting for patient A
                queryEmbedding,
                candidates: [patientBChunk, patientAChunk],
            });

            expect(results).toHaveLength(1);
            expect(results[0].chunkId).toBe("c-patient-a");
        });

        it("excludes patient report chunks when report sharing or AI consent is revoked", () => {
            const unsharedReportChunk: VectorSearchCandidate = {
                chunk: {
                    id: "c-report-unshared",
                    sourceId: "s-report-unshared",
                    workspaceId: workspace1,
                    patientId: patientA,
                    chunkIndex: 0,
                    chunkText: "Unshared lab report",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-report-unshared",
                    sourceType: "patient_report",
                    title: "Unshared Lab",
                    reportId: "rep-001",
                    workspaceId: workspace1,
                    patientId: patientA,
                    version: "1.0",
                    status: "reviewed",
                },
                reportMetadata: {
                    sharedWithCareTeam: false, // sharing revoked!
                    allowAiAnalysis: true,
                },
            };

            const noConsentReportChunk: VectorSearchCandidate = {
                chunk: {
                    id: "c-report-no-consent",
                    sourceId: "s-report-no-consent",
                    workspaceId: workspace1,
                    patientId: patientA,
                    chunkIndex: 0,
                    chunkText: "Report without AI consent",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-report-no-consent",
                    sourceType: "patient_report",
                    title: "No Consent Lab",
                    reportId: "rep-002",
                    workspaceId: workspace1,
                    patientId: patientA,
                    version: "1.0",
                    status: "reviewed",
                },
                reportMetadata: {
                    sharedWithCareTeam: true,
                    allowAiAnalysis: false, // patient opted out of AI!
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                candidates: [unsharedReportChunk, noConsentReportChunk],
            });

            expect(results).toHaveLength(0);
        });

        it("denies doctor from initiating RAG analysis if not assigned or patient opted out", () => {
            const doctor: UserContext = {
                profileId: "doc-1",
                workspaceId: workspace1,
                role: "doctor",
                email: "doc@clinic.com",
            };
            const patientContext: PatientContext = {
                id: patientA,
                workspaceId: workspace1,
            };

            // Unassigned doctor
            const unassignedResult = authorizeRagAnalysis({
                user: doctor,
                patient: patientContext,
                assignments: [], // no assignment
            });
            expect(unassignedResult.authorized).toBe(false);

            // Assigned doctor but patient opted out of AI analysis
            const assignedResultWithOptOut = authorizeRagAnalysis({
                user: doctor,
                patient: patientContext,
                assignments: [{ patientId: patientA, doctorProfileId: "doc-1" }],
                consent: {
                    patientId: patientA,
                    shareWithCareTeam: true,
                    allowReminders: true,
                    allowAiAnalysis: false, // opted out!
                },
            });
            expect(assignedResultWithOptOut.authorized).toBe(false);
            expect(assignedResultWithOptOut.reason).toContain("opted out");

            // Assigned doctor with valid consent
            const authorizedResult = authorizeRagAnalysis({
                user: doctor,
                patient: patientContext,
                assignments: [{ patientId: patientA, doctorProfileId: "doc-1" }],
                consent: {
                    patientId: patientA,
                    shareWithCareTeam: true,
                    allowReminders: true,
                    allowAiAnalysis: true,
                },
            });
            expect(authorizedResult.authorized).toBe(true);
        });
    });

    describe("Reviewed Clinical Source Fixtures & Ingestion Controls (Task 2.5)", () => {
        it("loads and verifies the fictional clinical sources fixture structure", () => {
            const fixturePath = path.resolve(
                __dirname,
                "../../../../packages/contracts/fixtures/rag-clinical-sources.fixture.json",
            );
            const content = fs.readFileSync(fixturePath, "utf-8");
            const fixture = JSON.parse(content);

            expect(fixture.embeddingDimension).toBe(768);
            expect(fixture.sources).toBeInstanceOf(Array);
            expect(fixture.sources.length).toBeGreaterThanOrEqual(5);

            // Verify guidelines, research, medication references, visits, reports are present
            const types = fixture.sources.map((s: any) => s.sourceType);
            expect(types).toContain("guideline");
            expect(types).toContain("research");
            expect(types).toContain("medication_reference");
            expect(types).toContain("patient_visit");
            expect(types).toContain("patient_report");
        });

        it("verifies unreviewed draft sources cannot enter the shared retrieval corpus", () => {
            const draftSourceCandidate: VectorSearchCandidate = {
                chunk: {
                    id: "c-draft-001",
                    sourceId: "s-draft-001",
                    workspaceId: workspace1,
                    patientId: null,
                    chunkIndex: 0,
                    chunkText: "Unreviewed experimental guidelines",
                    embedding: highMatchEmbedding,
                    embeddingModel: "text-embedding-004",
                    embeddingVersion: "1",
                },
                source: {
                    id: "s-draft-001",
                    sourceType: "guideline",
                    title: "Experimental Draft",
                    workspaceId: workspace1,
                    patientId: null,
                    version: "0.1",
                    status: "draft", // Unreviewed!
                },
            };

            const results = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                candidates: [draftSourceCandidate],
            });

            expect(results).toHaveLength(0);
        });

        it("verifies client-created non-admin sources cannot enter shared clinical corpus", () => {
            const doctorUser: UserContext = {
                profileId: "doc-1",
                workspaceId: workspace1,
                role: "doctor",
                email: "doc@clinic.com",
            };
            const patientUser: UserContext = {
                profileId: "pat-1",
                workspaceId: workspace1,
                role: "patient",
                email: "pat@email.com",
            };
            const adminUser: UserContext = {
                profileId: "admin-1",
                workspaceId: workspace1,
                role: "admin",
                email: "admin@clinic.com",
            };

            // Doctor attempts to create shared clinical source (patientId is null)
            const doctorIngest = authorizeKnowledgeSourceIngestion(doctorUser, { patientId: null });
            expect(doctorIngest.authorized).toBe(false);
            expect(doctorIngest.reason).toContain("only administrators");

            // Patient attempts to create shared clinical source
            const patientIngest = authorizeKnowledgeSourceIngestion(patientUser, { patientId: null });
            expect(patientIngest.authorized).toBe(false);

            // Admin creates shared clinical source
            const adminIngest = authorizeKnowledgeSourceIngestion(adminUser, { patientId: null });
            expect(adminIngest.authorized).toBe(true);
        });

        it("maps ranked results to RetrievedEvidence items preserving citations", () => {
            const candidates: VectorSearchCandidate[] = [
                {
                    chunk: {
                        id: "c-guideline",
                        sourceId: "s-ada",
                        workspaceId: workspace1,
                        chunkIndex: 0,
                        chunkText: "HbA1c target <7.0%",
                        embedding: highMatchEmbedding,
                        embeddingModel: "text-embedding-004",
                        embeddingVersion: "1",
                    },
                    source: {
                        id: "s-ada",
                        sourceType: "guideline",
                        title: "ADA Guidelines 2024",
                        publisher: "ADA",
                        publicationDate: "2024-01-01",
                        workspaceId: workspace1,
                        version: "1.0",
                        status: "reviewed",
                    },
                },
            ];

            const ranked = filterAndRankChunks({
                workspaceId: workspace1,
                patientId: patientA,
                queryEmbedding,
                candidates,
            });

            const evidence = mapRankedResultsToEvidence(ranked);
            expect(evidence).toHaveLength(1);
            expect(evidence[0].sourceId).toBe("s-ada");
            expect(evidence[0].chunkId).toBe("c-guideline");
            expect(evidence[0].title).toBe("ADA Guidelines 2024");
            expect(evidence[0].sourceType).toBe("guideline");
            expect(evidence[0].excerpt).toBe("HbA1c target <7.0%");
            expect(evidence[0].relevanceNote).toContain("Rank #1");
        });
    });
});
