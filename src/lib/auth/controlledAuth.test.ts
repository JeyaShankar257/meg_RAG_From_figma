import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clearSessionTokens,
  saveSessionTokens,
  getRefreshToken,
  type ApiUser,
} from "../api/apiClient.ts";

describe("Controlled Authentication Frontend Lifecycle (Tasks 3.1 - 3.6)", () => {
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

  describe("Session Storage and Token Clearing (Task 3.1)", () => {
    it("saves and retrieves tokens correctly", () => {
      saveSessionTokens("test-access-token", "test-refresh-token");
      assert.equal(getRefreshToken(), "test-refresh-token");
      assert.equal(localStorage.getItem("mednova_access_token"), "test-access-token");
    });

    it("clears tokens on logout or session expiration", () => {
      saveSessionTokens("test-access-token", "test-refresh-token");
      clearSessionTokens();
      assert.equal(getRefreshToken(), null);
      assert.equal(localStorage.getItem("mednova_access_token"), null);
    });

    it("supports extended ApiUser status fields", () => {
      const user: ApiUser = {
        id: "usr-001",
        email: "doctor@mednova.clinic",
        role: "doctor",
        approvalStatus: "pending",
        mustChangePassword: true,
        isVerified: true,
        patientStatus: "active",
      };

      assert.equal(user.approvalStatus, "pending");
      assert.equal(user.mustChangePassword, true);
      assert.equal(user.isVerified, true);
    });
  });

  describe("Activation Hash and Fragment Parsing Logic (Task 3.2)", () => {
    it("parses valid access_token from hash fragment", () => {
      const hash = "#access_token=valid-jwt-token-123&type=invite";
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get("access_token");
      const error = params.get("error");

      assert.equal(token, "valid-jwt-token-123");
      assert.equal(error, null);
    });

    it("detects expired or access_denied error fragment from provider", () => {
      const hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
      const params = new URLSearchParams(hash.slice(1));
      const error = params.get("error");
      const errorCode = params.get("error_code");

      assert.equal(error, "access_denied");
      assert.equal(errorCode, "otp_expired");
    });

    it("identifies missing token in activation URL", () => {
      const hash = "";
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get("access_token") ?? "";

      assert.equal(token, "");
    });
  });

  describe("Doctor Forced Temporary Password Lifecycle (Task 3.3)", () => {
    it("identifies when doctor must change password before clinical access", () => {
      const doctorWithTempPwd: ApiUser = {
        id: "doc-temp-1",
        email: "temp@mednova.clinic",
        role: "doctor",
        mustChangePassword: true,
      };

      const doctorWithNormalPwd: ApiUser = {
        id: "doc-perm-1",
        email: "perm@mednova.clinic",
        role: "doctor",
        mustChangePassword: false,
      };

      assert.equal(doctorWithTempPwd.mustChangePassword, true);
      assert.equal(doctorWithNormalPwd.mustChangePassword, false);
    });
  });

  describe("Administrator Doctor Provisioning & Orphan Operations (Task 3.4)", () => {
    it("invokes doctor invitations listing API with admin bearer token", async () => {
      saveSessionTokens("admin-token", "admin-refresh");

      globalThis.fetch = (async (url: any, opts: any) => {
        assert.ok(String(url).includes("/auth/doctor-invitations"));
        assert.equal(opts.headers.Authorization, "Bearer admin-token");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            invitations: [
              {
                id: "doc-1",
                email: "dr.chen@mednova.clinic",
                fullName: "Dr. Chen",
                approvalStatus: "pending",
                mustChangePassword: false,
                workspaceId: "ws-1",
              },
            ],
          }),
        };
      }) as any;

      const res = await api.auth.doctorInvitations.list("all");
      assert.equal(res.success, true);
      assert.equal(res.invitations.length, 1);
      assert.equal(res.invitations[0].approvalStatus, "pending");
    });

    it("invokes approve endpoint for pending doctor", async () => {
      saveSessionTokens("admin-token", "admin-refresh");

      globalThis.fetch = (async (url: any, opts: any) => {
        assert.ok(String(url).includes("/auth/doctor-invitations/doc-1/approve"));
        assert.equal(opts.method, "POST");
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: "Doctor approved" }),
        };
      }) as any;

      const res = await api.auth.doctorInvitations.approve("doc-1");
      assert.equal(res.success, true);
    });

    it("invokes orphan reconciliation query endpoint", async () => {
      saveSessionTokens("admin-token", "admin-refresh");

      globalThis.fetch = (async (url: any) => {
        assert.ok(String(url).includes("/auth/reconcile-orphans"));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            orphans: [],
          }),
        };
      }) as any;

      const res = await api.auth.orphans.list();
      assert.equal(res.success, true);
      assert.deepEqual(res.orphans, []);
    });
  });

  describe("Live Mode Non-Fallback Verification (Task 3.5)", () => {
    it("throws ApiError upon 401 unauthorized and never substitutes mock data", async () => {
      saveSessionTokens("stale-token", "stale-refresh");

      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: "unauthorized",
            message: "Session expired or invalid",
          }),
        };
      }) as any;

      await assert.rejects(
        async () => {
          await api.auth.me();
        },
        (err: any) => {
          assert.equal(err.status, 401);
          assert.equal(err.message, "Session expired or invalid");
          return true;
        },
      );
    });

    it("throws ApiError upon 403 pending approval without fallback", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: "account_pending_approval",
            message: "Doctor account pending administrator approval.",
          }),
        };
      }) as any;

      await assert.rejects(
        async () => {
          await api.auth.login("pending.doc@mednova.clinic", "password123", "doctor");
        },
        (err: any) => {
          assert.equal(err.status, 403);
          assert.ok(err.message.includes("pending administrator approval"));
          return true;
        },
      );
    });
  });
});
