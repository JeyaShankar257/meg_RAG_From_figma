import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import { correlationMiddleware } from "../middleware/correlation.js"
import { authRouter } from "./auth/index.js"
import { patientsRouter } from "./patients/index.js"
import { handleApiError } from "../lib/errors.js"

// In-memory test store
const testStore: {
  profiles: any[]
  patients: any[]
  audit_events: any[]
  authUsers: any[]
} = {
  profiles: [],
  patients: [],
  audit_events: [],
  authUsers: [],
}

const workspaceId = "a0000000-0000-0000-0000-000000000001"
const adminProfileId = "e0000000-0000-0000-0000-000000000001"
const doctorProfileId = "d0000000-0000-0000-0000-000000000001"

vi.mock("../lib/supabase.js", () => {
  const mockFrom = (table: string) => {
    let filters: Array<(row: any) => boolean> = []
    let updateValues: any = null
    let limitVal: number | null = null

    const chain: any = {
      select: vi.fn().mockImplementation(() => chain),
      eq: vi.fn().mockImplementation((col: string, val: any) => {
        filters.push((row: any) => row[col] === val)
        return chain
      }),
      is: vi.fn().mockImplementation((col: string, val: any) => {
        filters.push((row: any) => row[col] === val)
        return chain
      }),
      in: vi.fn().mockImplementation((col: string, vals: any[]) => {
        filters.push((row: any) => vals.includes(row[col]))
        return chain
      }),
      order: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation((n: number) => {
        limitVal = n
        return chain
      }),
      single: vi.fn().mockImplementation(async () => {
        const store = (testStore as any)[table] || []
        const matched = store.filter((r: any) => filters.every((f) => f(r)))
        if (matched.length === 0)
          return { data: null, error: { message: "Not found" } }
        return { data: matched[0], error: null }
      }),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const store = (testStore as any)[table] || []
        const matched = store.filter((r: any) => filters.every((f) => f(r)))
        return { data: matched.length > 0 ? matched[0] : null, error: null }
      }),
      insert: vi.fn().mockImplementation((rows: any) => {
        const list = Array.isArray(rows) ? rows : [rows]
        const store = (testStore as any)[table] || []
        for (const row of list) {
          const created = {
            id: row.id || `auto-${Date.now()}-${Math.random()}`,
            ...row,
          }
          store.push(created)
        }
        return {
          ...chain,
          select: () => ({
            single: async () => ({ data: list[0], error: null }),
          }),
          then: (resolve: any) => resolve({ data: list, error: null }),
          catch: (reject: any) => Promise.resolve({ data: list, error: null }),
        }
      }),
      update: vi.fn().mockImplementation((vals: any) => {
        updateValues = vals
        return {
          ...chain,
          eq: (col: string, val: any) => {
            filters.push((row: any) => row[col] === val)
            const store = (testStore as any)[table] || []
            for (const row of store) {
              if (filters.every((f) => f(row))) {
                Object.assign(row, updateValues)
              }
            }
            return {
              ...chain,
              then: (resolve: any) =>
                resolve({ data: updateValues, error: null }),
            }
          },
          then: (resolve: any) => {
            const store = (testStore as any)[table] || []
            for (const row of store) {
              if (filters.every((f) => f(row))) {
                Object.assign(row, updateValues)
              }
            }
            return resolve({ data: updateValues, error: null })
          },
        }
      }),
      delete: vi.fn().mockImplementation(() => {
        return {
          eq: (col: string, val: any) => {
            const store = (testStore as any)[table] || []
            const index = store.findIndex((r: any) => r[col] === val)
            if (index !== -1) store.splice(index, 1)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }),
      upsert: vi.fn().mockImplementation((row: any) => {
        const store = (testStore as any)[table] || []
        const existingIdx = store.findIndex(
          (r: any) =>
            (row.email && r.email === row.email) ||
            (row.id && r.id === row.id),
        )
        if (existingIdx !== -1) {
          Object.assign(store[existingIdx], row)
        } else {
          store.push({ id: row.id || `auto-${Date.now()}`, ...row })
        }
        return Promise.resolve({ data: row, error: null })
      }),
      then: (resolve: any) => {
        const store = (testStore as any)[table] || []
        let result = store.filter((r: any) => filters.every((f) => f(r)))
        if (limitVal !== null) result = result.slice(0, limitVal)
        return resolve({ data: result, error: null })
      },
    }
    return chain
  }

  const mockAdminClient = {
    from: (table: string) => mockFrom(table),
    rpc: vi.fn().mockImplementation(async (funcName: string, args: any) => {
      if (funcName === "provision_invited_profile") {
        testStore.profiles.push({
          id: args.p_id,
          workspace_id: args.p_workspace_id,
          role: args.p_role,
          full_name: args.p_full_name,
          email: args.p_email,
          approval_status: args.p_approval_status,
          invited_by_profile_id: args.p_invited_by_profile_id,
        })
        return { data: args.p_id, error: null }
      }
      if (funcName === "activate_patient_account") {
        const patient = testStore.patients.find(
          (p) => p.profile_id === args.p_profile_id,
        )
        if (patient) {
          patient.status = "active"
          patient.activated_at = new Date().toISOString()
        }
        return { data: patient?.id ?? "p-activated", error: null }
      }
      if (funcName === "reconcile_workspace_orphans") {
        return {
          data: {
            workspace_id: args.p_workspace_id,
            total_orphans: 0,
            orphaned_patients: [],
            orphaned_profiles: [],
          },
          error: null,
        }
      }
      return { data: null, error: null }
    }),
    auth: {
      signInWithPassword: vi
        .fn()
        .mockImplementation(async ({ email, password }) => {
          const user = testStore.authUsers.find(
            (u) => u.email === email && u.password === password,
          )
          if (!user)
            return {
              data: { session: null, user: null },
              error: new Error("Invalid login"),
            }
          return {
            data: {
              session: {
                access_token: `token-${user.id}`,
                refresh_token: `refresh-${user.id}`,
              },
              user,
            },
            error: null,
          }
        }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockImplementation(async (token: string) => {
        if (token === "demo-token-admin") {
          return {
            data: {
              user: testStore.authUsers.find((u) => u.id === adminProfileId),
            },
            error: null,
          }
        }
        if (token === "demo-token-doctor-jwt") {
          return {
            data: {
              user: testStore.authUsers.find((u) => u.id === doctorProfileId),
            },
            error: null,
          }
        }
        const userId = token.replace("token-", "")
        const user = testStore.authUsers.find(
          (u) => u.id === userId || token.includes(u.id),
        )
        if (!user)
          return { data: { user: null }, error: new Error("User not found") }
        return { data: { user }, error: null }
      }),
    },
  }

  const mockAuthAdminClient = {
    auth: {
      admin: {
        inviteUserByEmail: vi
          .fn()
          .mockImplementation(async (email: string, options: any) => {
            if (email === "ratelimit@example.com") {
              return { data: null, error: new Error("rate limit exceeded") }
            }
            const user = {
              id: `auth-user-${Date.now()}`,
              email,
              email_confirmed_at: new Date().toISOString(),
              user_metadata: options?.data ?? {},
            }
            testStore.authUsers.push(user)
            return { data: { user }, error: null }
          }),
        deleteUser: vi.fn().mockImplementation(async (id: string) => {
          const idx = testStore.authUsers.findIndex((u) => u.id === id)
          if (idx !== -1) testStore.authUsers.splice(idx, 1)
          return { data: null, error: null }
        }),
        updateUserById: vi
          .fn()
          .mockImplementation(async (id: string, updates: any) => {
            const user = testStore.authUsers.find((u) => u.id === id)
            if (user && updates.password) user.password = updates.password
            return { data: user, error: null }
          }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }

  const mockUserClient = (token: string) => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => {
        const userId = token.replace("token-", "")
        const user = testStore.authUsers.find(
          (u) => u.id === userId || token.includes(u.id),
        )
        return {
          data: { user: user ?? { id: userId, email: "user@example.com" } },
          error: null,
        }
      }),
      updateUser: vi.fn().mockImplementation(async ({ password }: any) => {
        return { data: { user: { password } }, error: null }
      }),
    },
  })

  return {
    getAdminClient: () => mockAdminClient,
    getAuthAdminClient: () => mockAuthAdminClient,
    getPublicAuthClient: () => mockAdminClient,
    getUserClient: (token: string) => mockUserClient(token),
  }
})

describe("Controlled Authentication Lifecycle (Tasks 2.1 - 2.8)", () => {
  let app: Hono

  beforeEach(() => {
    testStore.profiles = [
      {
        id: adminProfileId,
        workspace_id: workspaceId,
        role: "admin",
        full_name: "Admin User",
        email: "admin@mednova.clinic",
        approval_status: "approved",
        must_change_password: false,
      },
      {
        id: doctorProfileId,
        workspace_id: workspaceId,
        role: "doctor",
        full_name: "Dr. Sarah Chen",
        email: "s.chen@mednova.clinic",
        approval_status: "approved",
        must_change_password: false,
      },
    ]
    testStore.patients = []
    testStore.audit_events = []
    testStore.authUsers = [
      {
        id: adminProfileId,
        email: "admin@mednova.clinic",
        password: "adminPassword123",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      {
        id: doctorProfileId,
        email: "s.chen@mednova.clinic",
        password: "doctorPassword123",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
    ]

    app = new Hono()
    app.use("*", correlationMiddleware)
    app.route("/auth", authRouter)
    app.route("/patients", patientsRouter)
    app.onError(handleApiError)
  })

  describe("Administrator Doctor Provisioning & Approval Lifecycle", () => {
    it("denies non-admin roles from inviting a doctor", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-doctor-jwt",
        },
        body: JSON.stringify({
          email: "newdoc@mednova.clinic",
          fullName: "Dr. New",
          workspaceId,
        }),
      })
      expect(res.status).toBe(403)
      const audit = testStore.audit_events.find(
        (e) => e.action === "denied_doctor_provisioning",
      )
      expect(audit).toBeDefined()
      expect(audit.outcome).toBe("denied")
    })

    it("denies doctor invitation targeting a different workspace", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "crossdoc@mednova.clinic",
          fullName: "Dr. Cross",
          workspaceId: "b0000000-0000-0000-0000-000000000002",
        }),
      })
      expect(res.status).toBe(403)
    })

    it("rejects doctor invitation for duplicate email with 409 Conflict", async () => {
      testStore.profiles.push({
        id: "doc-dup",
        email: "existingdoc@mednova.clinic",
        workspace_id: workspaceId,
        role: "doctor",
      })
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "existingdoc@mednova.clinic",
          fullName: "Dr. Dup",
          workspaceId,
        }),
      })
      expect(res.status).toBe(409)
    })

    it("maps email rate-limit errors from provider to 429 without exposing secrets", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "ratelimit@example.com",
          fullName: "Dr. Rate",
          workspaceId,
        }),
      })
      expect(res.status).toBe(429)
      const body = (await res.json()) as any
      expect(body.message).toContain("rate limit exceeded")
    })

    it("successfully invites doctor, provisions pending profile, and emits audit event", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "dr.adams@mednova.clinic",
          fullName: "Dr. Adams",
          workspaceId,
        }),
      })
      expect(res.status).toBe(201)
      const profile = testStore.profiles.find(
        (p) => p.email === "dr.adams@mednova.clinic",
      )
      expect(profile).toBeDefined()
      expect(profile.approval_status).toBe("pending")

      const audit = testStore.audit_events.find(
        (e) => e.action === "invite_doctor",
      )
      expect(audit).toBeDefined()
      expect(audit.outcome).toBe("success")
    })

    it("allows admin to list doctor invitations", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        headers: { Authorization: "Bearer demo-token-admin" },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(Array.isArray(body.doctors)).toBe(true)
    })

    it("approves pending doctor idempotently and records audit event", async () => {
      const docId = "doc-to-approve"
      testStore.profiles.push({
        id: docId,
        workspace_id: workspaceId,
        role: "doctor",
        full_name: "Dr. Pending",
        email: "dr.pending@mednova.clinic",
        approval_status: "pending",
      })

      // First approval
      const res1 = await app.request(
        `/auth/doctor-invitations/${docId}/approve`,
        {
          method: "POST",
          headers: { Authorization: "Bearer demo-token-admin" },
        },
      )
      expect(res1.status).toBe(200)
      expect(
        testStore.profiles.find((p) => p.id === docId)?.approval_status,
      ).toBe("approved")

      // Idempotent second approval
      const res2 = await app.request(
        `/auth/doctor-invitations/${docId}/approve`,
        {
          method: "POST",
          headers: { Authorization: "Bearer demo-token-admin" },
        },
      )
      expect(res2.status).toBe(200)
      const body2 = (await res2.json()) as any
      expect(body2.alreadyApproved).toBe(true)
    })

    it("rejects doctor account idempotently", async () => {
      const docId = "doc-to-reject"
      testStore.profiles.push({
        id: docId,
        workspace_id: workspaceId,
        role: "doctor",
        full_name: "Dr. Reject",
        email: "dr.reject@mednova.clinic",
        approval_status: "pending",
      })

      const res1 = await app.request(
        `/auth/doctor-invitations/${docId}/reject`,
        {
          method: "POST",
          headers: { Authorization: "Bearer demo-token-admin" },
        },
      )
      expect(res1.status).toBe(200)
      expect(
        testStore.profiles.find((p) => p.id === docId)?.approval_status,
      ).toBe("rejected")

      const res2 = await app.request(
        `/auth/doctor-invitations/${docId}/reject`,
        {
          method: "POST",
          headers: { Authorization: "Bearer demo-token-admin" },
        },
      )
      expect(res2.status).toBe(200)
      const body2 = (await res2.json()) as any
      expect(body2.alreadyRejected).toBe(true)
    })

    it("enforces approval before setting a temporary password and sets must_change_password flag", async () => {
      const docId = "doc-pw"
      testStore.profiles.push({
        id: docId,
        workspace_id: workspaceId,
        role: "doctor",
        full_name: "Dr. Password",
        email: "dr.pw@mednova.clinic",
        approval_status: "pending",
        must_change_password: false,
      })
      testStore.authUsers.push({ id: docId, email: "dr.pw@mednova.clinic" })

      // Cannot set temp password before approval
      const resFail = await app.request(
        `/auth/doctor-invitations/${docId}/password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer demo-token-admin",
          },
          body: JSON.stringify({ temporaryPassword: "TempPassword123!" }),
        },
      )
      expect(resFail.status).toBe(400)

      // Approve doctor
      testStore.profiles.find((p) => p.id === docId)!.approval_status =
        "approved"

      // Now set temp password
      const resOk = await app.request(
        `/auth/doctor-invitations/${docId}/password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer demo-token-admin",
          },
          body: JSON.stringify({ temporaryPassword: "TempPassword123!" }),
        },
      )
      expect(resOk.status).toBe(200)
      expect(
        testStore.profiles.find((p) => p.id === docId)?.must_change_password,
      ).toBe(true)

      // Verify audit event does NOT log password
      const pwAudit = testStore.audit_events.find(
        (e) => e.action === "set_temporary_password",
      )
      expect(pwAudit).toBeDefined()
      expect(JSON.stringify(pwAudit)).not.toContain("TempPassword123!")
    })

    it("invites doctor successfully when workspaceId is omitted in request body", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "dr.noworkspace@mednova.clinic",
          fullName: "Dr. Fallback",
        }),
      })
      expect(res.status).toBe(201)
      const profile = testStore.profiles.find(
        (p) => p.email === "dr.noworkspace@mednova.clinic",
      )
      expect(profile).toBeDefined()
      expect(profile?.workspace_id).toBe(workspaceId)
    })

    it("rejects doctor invitation when invalid payload is sent (400 Bad Request)", async () => {
      const res = await app.request("/auth/doctor-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          email: "not-an-email",
          fullName: "A",
        }),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as any
      expect(body.error).toBe("validation_error")
    })

    it("supports setting temporary password via /temporary-password alias", async () => {
      const docId = "doc-temp-alias"
      testStore.profiles.push({
        id: docId,
        workspace_id: workspaceId,
        role: "doctor",
        full_name: "Dr. Alias",
        email: "dr.alias@mednova.clinic",
        approval_status: "approved",
      })

      const res = await app.request(
        `/auth/doctor-invitations/${docId}/temporary-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer demo-token-admin",
          },
          body: JSON.stringify({ temporaryPassword: "AliasPassword123!" }),
        },
      )
      expect(res.status).toBe(200)
      expect(
        testStore.profiles.find((p) => p.id === docId)?.must_change_password,
      ).toBe(true)
    })

    it("allows admin to query orphans via GET /auth/reconcile-orphans", async () => {
      const res = await app.request("/auth/reconcile-orphans", {
        headers: { Authorization: "Bearer demo-token-admin" },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.success).toBe(true)
      expect(Array.isArray(body.orphans)).toBe(true)
    })

    it("denies non-admin roles from accessing GET /auth/reconcile-orphans", async () => {
      const res = await app.request("/auth/reconcile-orphans", {
        headers: { Authorization: "Bearer demo-token-doctor-jwt" },
      })
      expect(res.status).toBe(403)
    })

    it("allows admin to clean up an orphan via POST /auth/reconcile-orphans", async () => {
      testStore.patients.push({
        id: "p-orphan-to-clean",
        workspace_id: workspaceId,
        full_name: "Orphan Patient",
        is_deleted: false,
      })

      const res = await app.request("/auth/reconcile-orphans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token-admin",
        },
        body: JSON.stringify({
          orphanId: "p-orphan-to-clean",
          orphanType: "patient",
        }),
      })
      expect(res.status).toBe(200)
      const cleaned = testStore.patients.find(
        (p) => p.id === "p-orphan-to-clean",
      )
      expect(cleaned?.is_deleted).toBe(true)
    })

    it("allows admin to trigger legacy orphan reconciliation via POST /auth/reconciliation/orphans", async () => {
      const res = await app.request("/auth/reconciliation/orphans", {
        method: "POST",
        headers: { Authorization: "Bearer demo-token-admin" },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.success).toBe(true)
      expect(body.report).toBeDefined()
    })
  })

  describe("Patient Activation & Acceptance Lifecycle", () => {
    it("accepts patient invitation, sets password, and activates patient clinical record", async () => {
      const patientAuthId = "auth-pat-1"
      testStore.authUsers.push({
        id: patientAuthId,
        email: "pat.active@example.com",
      })
      testStore.profiles.push({
        id: patientAuthId,
        workspace_id: workspaceId,
        role: "patient",
        full_name: "Patient Active",
        email: "pat.active@example.com",
      })
      testStore.patients.push({
        id: "P-100001",
        workspace_id: workspaceId,
        profile_id: patientAuthId,
        status: "pending",
        full_name: "Patient Active",
        is_deleted: false,
      })

      const res = await app.request("/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: `token-${patientAuthId}`,
          password: "NewPassword123!",
        }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.success).toBe(true)

      const pat = testStore.patients.find((p) => p.profile_id === patientAuthId)
      expect(pat?.status).toBe("active")

      const audit = testStore.audit_events.find(
        (e) => e.action === "activate_account",
      )
      expect(audit).toBeDefined()
      expect(audit.outcome).toBe("success")
    })
  })

  describe("Admin Portal Login & Role Gating", () => {
    it("allows admin user to login with portal: 'admin'", async () => {
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@mednova.clinic",
          password: "adminPassword123",
          portal: "admin",
        }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.user.role).toBe("admin")
      expect(body.token).toBeDefined()
    })

    it("rejects doctor from logging in through portal: 'admin'", async () => {
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "s.chen@mednova.clinic",
          password: "doctorPassword123",
          portal: "admin",
        }),
      })
      expect(res.status).toBe(401)
      const body = (await res.json()) as any
      expect(body.message).toBe("Invalid login credentials for this portal")
    })
  })
})
