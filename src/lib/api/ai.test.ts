import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPatientRagAnalysis, getRagAnalysis, getRagEvidence, reindexPatientReport } from "./ai.ts";
import { ApiError } from "./client.ts";
import type { RagAnalysisResponse } from "../types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Frontend API Client Tests (Task 1.4)", () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: (idx: number) => Object.keys(mockStorage)[idx] ?? null,
      get length() {
        return Object.keys(mockStorage).length;
      },
    } as Storage;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  });

  describe("RAG Analysis API responses", () => {
    it("handles pending analysis response", async () => {
      const pendingResponse: RagAnalysisResponse = {
        id: "analysis-001",
        status: "pending",
        evidence: [],
        correlationId: "req-123",
      };

      let requestedUrl = "";
      let requestedOptions: RequestInit | undefined;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = String(input);
        requestedOptions = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            "content-type": "application/json",
            "x-request-id": "req-123",
          }),
          json: async () => pendingResponse,
        } as unknown as Response;
      }) as typeof fetch;

      const result = await runPatientRagAnalysis({
        patientId: "p-001",
        symptoms: "Mild persistent cough",
        question: "Could this be ACE inhibitor cough?",
      });

      assert.equal(result.status, "pending");
      assert.equal(result.id, "analysis-001");
      assert.deepEqual(result.evidence, []);
      assert.ok(requestedUrl.includes("/doctor/patients/p-001/ai-analyses"));
      assert.equal(requestedOptions?.method, "POST");
    });

    it("handles running analysis response", async () => {
      const runningResponse: RagAnalysisResponse = {
        id: "analysis-002",
        status: "running",
        evidence: [
          {
            sourceId: "src-1",
            title: "Hypertension Guidelines",
            sourceType: "guideline",
            excerpt: "ACE inhibitors frequently cause dry cough.",
          },
        ],
      };

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => runningResponse,
        } as unknown as Response;
      }) as typeof fetch;

      const result = await getRagAnalysis("analysis-002");
      assert.equal(result.status, "running");
      assert.equal(result.evidence.length, 1);
      assert.equal(result.evidence[0].title, "Hypertension Guidelines");
    });

    it("handles complete analysis response with evidence and analysis", async () => {
      const completeResponse: RagAnalysisResponse = {
        id: "analysis-003",
        status: "complete",
        evidence: [
          {
            sourceId: "src-1",
            title: "Clinical Reference",
            sourceType: "guideline",
            excerpt: "Switching to ARB resolves cough.",
          },
        ],
        analysis: {
          id: "analysis-003",
          type: "diagnostic",
          status: "complete",
          confidence: 0.92,
          hypothesis: "Lisinopril-induced cough",
          explanation: "Patient reports persistent dry cough after starting Lisinopril.",
          safetyFlags: [],
          citations: [],
          relatedVisits: [],
          modelVersion: "gemini-1.5-pro",
          createdAt: new Date().toISOString(),
        },
      };

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => completeResponse,
        } as unknown as Response;
      }) as typeof fetch;

      const result = await getRagAnalysis("analysis-003");
      assert.equal(result.status, "complete");
      assert.equal(result.analysis?.confidence, 0.92);
      assert.equal(result.analysis?.hypothesis, "Lisinopril-induced cough");
    });

    it("handles getRagEvidence endpoint response", async () => {
      const evidenceResponse: RagAnalysisResponse = {
        id: "analysis-003",
        status: "complete",
        evidence: [
          {
            sourceId: "src-1",
            title: "Cardiology Reference",
            sourceType: "research",
            excerpt: "Sample excerpt",
          },
        ],
      };

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => evidenceResponse,
        } as unknown as Response;
      }) as typeof fetch;

      const result = await getRagEvidence("analysis-003");
      assert.equal(result.evidence.length, 1);
      assert.equal(result.evidence[0].sourceType, "research");
    });

    it("handles report reindex endpoint", async () => {
      let requestedUrl = "";
      let requestedMethod = "";

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = String(input);
        requestedMethod = init?.method ?? "";
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ status: "indexing" }),
        } as unknown as Response;
      }) as typeof fetch;

      const result = await reindexPatientReport("rep-123");
      assert.equal(result.status, "indexing");
      assert.ok(requestedUrl.includes("/reports/rep-123/reindex"));
      assert.equal(requestedMethod, "POST");
    });
  });

  describe("Error handling, authorization, and retryable responses", () => {
    it("handles unauthorized response (401)", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: "Token expired" }),
        } as unknown as Response;
      }) as typeof fetch;

      await assert.rejects(
        async () => {
          await getRagAnalysis("analysis-auth");
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status, 401);
          assert.equal(err.retryable, false);
          return true;
        },
      );
    });

    it("handles forbidden response (403)", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 403,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: "Forbidden access" }),
        } as unknown as Response;
      }) as typeof fetch;

      await assert.rejects(
        async () => {
          await getRagAnalysis("analysis-forbidden");
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status, 403);
          assert.equal(err.retryable, false);
          return true;
        },
      );
    });

    it("handles retryable responses (429, 408, 503)", async () => {
      // 429 Too Many Requests
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 429,
          headers: new Headers({
            "content-type": "application/json",
            "x-request-id": "req-429",
          }),
          json: async () => ({ error: "Rate limit exceeded" }),
        } as unknown as Response;
      }) as typeof fetch;

      await assert.rejects(
        async () => {
          await getRagAnalysis("analysis-busy");
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status, 429);
          assert.equal(err.retryable, true);
          assert.equal(err.requestId, "req-429");
          return true;
        },
      );

      // 503 Service Unavailable
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: "Provider unavailable" }),
        } as unknown as Response;
      }) as typeof fetch;

      await assert.rejects(
        async () => {
          await getRagAnalysis("analysis-down");
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status, 503);
          assert.equal(err.retryable, true);
          return true;
        },
      );
    });

    it("handles error response in body (status 400)", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 400,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: "Patient ID is required" }),
        } as unknown as Response;
      }) as typeof fetch;

      await assert.rejects(
        async () => {
          await runPatientRagAnalysis({ patientId: "", symptoms: "cough" });
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status, 400);
          assert.equal(err.message, "Patient ID is required");
          assert.equal(err.retryable, false);
          return true;
        },
      );
    });

    it("attaches bearer token from localStorage when present", async () => {
      mockStorage["mednova_access_token"] = "jwt-mock-token-abc";
      let authHeader: string | undefined;

      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined;
        authHeader = headers?.["Authorization"];
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ id: "1", status: "pending", evidence: [] }),
        } as unknown as Response;
      }) as typeof fetch;

      await getRagAnalysis("test-id");
      assert.equal(authHeader, "Bearer jwt-mock-token-abc");
    });
  });

  describe("Browser bundle security (verify no server secrets are imported)", () => {
    it("ensures no server-side secrets or sensitive keys exist in frontend source files", () => {
      const srcDir = path.resolve(__dirname, "../../");
      const forbiddenPatterns = [
        /SUPABASE_SERVICE_ROLE_KEY/i,
        /GEMINI_API_KEY\s*=\s*['"`][^'"`]+['"`]/i,
        /POSTGRES_PASSWORD/i,
        /process\.env\.SUPABASE_SERVICE_ROLE/i,
        /process\.env\.GEMINI_API_KEY/i,
      ];

      function checkDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            checkDir(fullPath);
          } else if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.includes(".test.")) {
            const content = fs.readFileSync(fullPath, "utf-8");
            for (const pattern of forbiddenPatterns) {
              const match = content.match(pattern);
              assert.equal(
                match,
                null,
                `Found potential server secret pattern ${pattern} in client file: ${fullPath}`,
              );
            }
          }
        }
      }

      checkDir(srcDir);
    });
  });
});
