import { createHash } from "node:crypto";
import type {
    KnowledgeChunk,
    KnowledgeSource,
    RagSourceType,
    RetrievedEvidence,
} from "@mednova/types";
import {
    authorizePatientAccess,
    type AuthorizationParams,
    type AuthorizationResult,
    type UserContext,
} from "./authorization.js";

/**
 * Generates a deterministic 768-dimensional Gemini-compatible embedding for text.
 */
export function generateGeminiCompatibleEmbedding(
    text: string,
    model = "text-embedding-004",
): number[] {
    const dim = 768;
    const hash = createHash("sha256").update(`${model}:${text}`).digest();
    const vec: number[] = new Array(dim);

    for (let i = 0; i < dim; i++) {
        const byte = hash[i % hash.length];
        const secondByte = hash[(i + 13) % hash.length];
        const raw = ((byte << 8) | secondByte) / 65535 - 0.5;
        vec[i] = raw;
    }

    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map((val) => Number((val / norm).toFixed(6)));
}

export interface VectorSearchCandidate {
    chunk: {
        id: string;
        sourceId: string;
        workspaceId: string;
        patientId?: string | null;
        chunkIndex: number;
        chunkText: string;
        embedding: number[];
        embeddingModel: string;
        embeddingVersion: string;
        metadata?: Record<string, unknown>;
    };
    source: {
        id: string;
        sourceType: RagSourceType;
        title: string;
        publisher?: string;
        publicationDate?: string;
        url?: string;
        workspaceId: string;
        patientId?: string | null;
        reportId?: string | null;
        version: string;
        status: "draft" | "reviewed" | "archived";
        metadata?: Record<string, unknown>;
    };
    reportMetadata?: {
        sharedWithCareTeam: boolean;
        allowAiAnalysis: boolean;
    };
}

export interface VectorSearchParams {
    workspaceId: string;
    patientId: string;
    queryEmbedding: number[];
    embeddingModel?: string;
    embeddingVersion?: string;
    topK?: number;
    similarityThreshold?: number;
    candidates: VectorSearchCandidate[];
}

export interface RankedRetrievalResult {
    chunkId: string;
    sourceId: string;
    title: string;
    sourceType: RagSourceType;
    publisher?: string;
    publicationDate?: string;
    chunkText: string;
    similarityScore: number;
    chunkIndex: number;
    rank: number;
    patientId?: string | null;
}

/**
 * Computes cosine similarity between two numeric vectors.
 * Returns value between -1.0 and 1.0. Throws on mismatched or empty dimensions.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) {
        throw new Error(
            `Vector dimension mismatch: vector A has ${a.length} dimensions, vector B has ${b.length} dimensions. Expected 768 dimensions.`,
        );
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.round(similarity * 100000) / 100000;
}

/**
 * Filters and ranks knowledge chunks matching Postgres match_knowledge_chunks contract:
 * - Enforces workspace isolation
 * - Enforces embedding model & embedding version compatibility
 * - Filters to reviewed global clinical sources OR authorized patient sources
 * - Excludes unshared or non-consented patient reports
 * - Strictly isolates cross-patient records
 * - Filters by similarity threshold
 * - Deterministically sorts by similarity score descending, chunkIndex ascending
 * - Caps by topK limit
 */
export function filterAndRankChunks(params: VectorSearchParams): RankedRetrievalResult[] {
    const {
        workspaceId,
        patientId,
        queryEmbedding,
        embeddingModel = "text-embedding-004",
        embeddingVersion = "1",
        topK = 6,
        similarityThreshold = 0.65,
        candidates,
    } = params;

    if (queryEmbedding.length !== 768) {
        throw new Error(`Query embedding must have 768 dimensions, received ${queryEmbedding.length}`);
    }

    const scored: Array<Omit<RankedRetrievalResult, "rank">> = [];

    for (const candidate of candidates) {
        const { chunk, source, reportMetadata } = candidate;

        // 1. Strict workspace isolation
        if (chunk.workspaceId !== workspaceId || source.workspaceId !== workspaceId) {
            continue;
        }

        // 2. Embedding model and version compatibility contract
        if (
            chunk.embeddingModel !== embeddingModel ||
            chunk.embeddingVersion !== embeddingVersion
        ) {
            continue;
        }

        // 3. Source scope & consent filtering
        if (source.patientId === null || source.patientId === undefined) {
            // Shared clinical knowledge MUST be formally reviewed
            if (source.status !== "reviewed") {
                continue;
            }
        } else {
            // Patient-specific source MUST strictly match the requested patient
            if (source.patientId !== patientId || chunk.patientId !== patientId) {
                continue;
            }

            // If source is tied to an uploaded patient report, respect sharing & consent
            if (source.reportId && reportMetadata) {
                if (!reportMetadata.sharedWithCareTeam || !reportMetadata.allowAiAnalysis) {
                    continue;
                }
            }
        }

        // 4. Compute vector similarity
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);

        // 5. Similarity thresholding
        if (score >= similarityThreshold) {
            scored.push({
                chunkId: chunk.id,
                sourceId: source.id,
                title: source.title,
                sourceType: source.sourceType,
                publisher: source.publisher,
                publicationDate: source.publicationDate,
                chunkText: chunk.chunkText,
                similarityScore: score,
                chunkIndex: chunk.chunkIndex,
                patientId: source.patientId ?? chunk.patientId ?? null,
            });
        }
    }

    // 6. Deterministic ordering: highest similarity first, then chunkIndex ascending
    scored.sort((a, b) => {
        if (b.similarityScore !== a.similarityScore) {
            return b.similarityScore - a.similarityScore;
        }
        return a.chunkIndex - b.chunkIndex;
    });

    // 7. Cap by topK
    const capped = scored.slice(0, topK);

    return capped.map((item, index) => ({
        ...item,
        rank: index + 1,
    }));
}

/**
 * Transforms ranked retrieval results into client-facing RetrievedEvidence items.
 */
export function mapRankedResultsToEvidence(results: RankedRetrievalResult[]): RetrievedEvidence[] {
    return results.map((r) => ({
        sourceId: r.sourceId,
        chunkId: r.chunkId,
        title: r.title,
        sourceType: r.sourceType,
        publisher: r.publisher,
        date: r.publicationDate,
        excerpt: r.chunkText,
        similarityScore: r.similarityScore,
        relevanceNote: `Rank #${r.rank} with similarity ${r.similarityScore}`,
    }));
}

/**
 * Authorizes a doctor to request an evidence-grounded AI analysis for a patient.
 * Requires:
 * - Authenticated user
 * - Doctor or admin role
 * - Matching workspace
 * - Active doctor assignment
 * - Patient consent allowing AI analysis
 */
export function authorizeRagAnalysis(params: AuthorizationParams): AuthorizationResult {
    const { user, consent } = params;

    if (!user) {
        return { authorized: false, reason: "Unauthenticated: no user session provided" };
    }

    if (user.role !== "doctor" && user.role !== "admin") {
        return { authorized: false, reason: "Denied: only physicians and administrators can initiate AI analysis" };
    }

    if (consent && !consent.allowAiAnalysis) {
        return { authorized: false, reason: "Denied: patient has opted out of AI clinical analysis" };
    }

    return authorizePatientAccess(params);
}

/**
 * Verifies that unreviewed or client-created sources cannot enter the shared clinical knowledge corpus.
 * Shared clinical sources (patientId = null) may only be created/approved by an administrator.
 */
export function authorizeKnowledgeSourceIngestion(
    user: UserContext | null,
    source: { patientId?: string | null; status?: string },
): AuthorizationResult {
    if (!user) {
        return { authorized: false, reason: "Unauthenticated" };
    }

    // Shared global knowledge corpus
    if (source.patientId === null || source.patientId === undefined) {
        if (user.role !== "admin") {
            return {
                authorized: false,
                reason: "Denied: only administrators can publish or ingest into the shared clinical knowledge base",
            };
        }
    }

    return { authorized: true };
}
