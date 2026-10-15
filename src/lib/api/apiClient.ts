import {
  DEMO_ADHERENCE,
  DEMO_CARE_TEAM,
  DEMO_DOCTOR,
  DEMO_PATIENTS,
  DEMO_PRESCRIPTIONS,
  DEMO_VISITS,
} from "../mockData"
import type {
  Patient,
  Prescription,
  Visit,
  DoctorDashboardResponse,
  PatientPipelineResponse,
  DoctorSettingsResponse,
  DoctorProfilePreferences,
  ApprovalResponse,
} from "../types"

const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
)

const ACCESS_TOKEN_KEY = "mednova_access_token"

const REFRESH_TOKEN_KEY = "mednova_refresh_token"

const DEV_USER_KEY = "mednova_dev_user"

type ApiPatient = {
  id: string
  full_name?: string
  contact_email?: string
  date_of_birth?: string
  contact_phone?: string
  status?: "active" | "invited" | "pending" | "inactive"
}

export function normalizePatient(patient: ApiPatient): Patient {
  const name = patient.full_name?.trim() || "Unnamed patient"
  const patientId = patient.id.toUpperCase().startsWith("P-")
    ? `PT-${patient.id.slice(2)}`
    : patient.id

  return {
    id: patient.id,
    patientId,
    name,
    email: patient.contact_email ?? "",
    dob: patient.date_of_birth ?? "",
    age: 0,
    gender: "",
    phone: patient.contact_phone ?? "",
    address: "",
    status:
      patient.status === "inactive" ? "pending" : (patient.status ?? "pending"),
    assignedDoctor: "",
    careTeam: [],
    conditions: Array.isArray(
      (patient as ApiPatient & { conditions?: string[] }).conditions,
    )
      ? (patient as ApiPatient & { conditions: string[] }).conditions
      : [],
    adherenceScore: 0,
    trend: "stable",
    hasEscalation: false,
    lastVisit: "",
  }
}

function normalizeVisit(visit: Record<string, unknown>): Visit {
  return {
    id: String(visit.id ?? crypto.randomUUID()),
    patientId: String(visit.patient_id ?? visit.patientId ?? ""),
    date: String(visit.visit_date ?? visit.date ?? ""),
    condition: String(visit.condition ?? "Clinical visit"),
    symptoms: Array.isArray(visit.symptoms) ? visit.symptoms.map(String) : [],
    notes: String(visit.notes ?? ""),
    proposedSolution: String(
      visit.proposed_solution ?? visit.proposedSolution ?? "",
    ),
    outcome: String(visit.outcome ?? ""),
    relatedVisits: Array.isArray(visit.related_visits)
      ? visit.related_visits.map(String)
      : [],
    doctor: String(visit.doctor ?? ""),
  }
}

function normalizePrescription(
  prescription: Record<string, unknown>,
): Prescription {
  const medication = (prescription.medications ??
    prescription.medication ??
    {}) as Record<string, unknown>
  const status = String(prescription.status ?? "pending_review")
  return {
    id: String(prescription.id ?? crypto.randomUUID()),
    status: (status === "approved"
      ? "active"
      : status) as Prescription["status"],
    suggestedBy: prescription.suggested_by === "ai" ? "ai" : "doctor",
    approvedBy: String(prescription.approved_by_profile_id ?? ""),
    approvedAt: String(prescription.approved_at ?? ""),
    citations: [],
    revisions: [],
    medication: {
      id: String(medication.id ?? ""),
      name: String(medication.name ?? "Medication"),
      genericName: String(medication.generic_name ?? ""),
      strength: String(medication.dosage ?? medication.strength ?? ""),
      unit: String(medication.unit ?? ""),
      frequency: String(medication.frequency ?? medication.form ?? ""),
      quantity: Number(medication.quantity ?? 0),
      duration: String(medication.duration ?? ""),
      instructions: String(medication.instructions ?? ""),
      startDate: String(medication.start_date ?? ""),
      endDate: String(medication.end_date ?? ""),
      status: "active",
      prescribedBy: String(medication.prescribed_by ?? ""),
      nextDose: String(medication.next_dose ?? ""),
    },
  }
}

export interface ApiUser {
  id: string
  patientId?: string

  role: "doctor" | "patient" | "care_team" | "admin"

  email: string

  fullName?: string

  workspaceId?: string
}

export function getPatientId(user: ApiUser): string {
  return user.patientId ?? user.id
}

export type PortalRole = Extract<ApiUser["role"], "doctor" | "patient">

export type ApiError = Error & {
  status?: number
  code?: string
  details?: unknown
}

export function isBackendConfigured(): boolean {
  return (
    import.meta.env?.VITE_USE_BACKEND === "true" ||
    Boolean(import.meta.env?.VITE_API_BASE_URL)
  )
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function saveSessionTokens(token: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)

  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearSessionTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)

  localStorage.removeItem(REFRESH_TOKEN_KEY)

  localStorage.removeItem(DEV_USER_KEY)
}

export function getDevelopmentUser(): ApiUser | null {
  if (isBackendConfigured() || !import.meta.env?.DEV) return null

  const value = localStorage.getItem(DEV_USER_KEY)

  if (!value) return null

  try {
    return JSON.parse(value) as ApiUser
  } catch {
    clearSessionTokens()

    return null
  }
}

export function saveDevelopmentUser(user: ApiUser): void {
  if (!isBackendConfigured() && import.meta.env.DEV) {
    localStorage.setItem(DEV_USER_KEY, JSON.stringify(user))
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  const correlationId = crypto.randomUUID()

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,

    credentials: "include",

    headers: {
      Accept: "application/json",

      ...(options.body ? { "Content-Type": "application/json" } : {}),

      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Correlation-ID": correlationId,

      ...options.headers,
    },
  })

  const body = (await response.json().catch(() => undefined)) as {
    message?: string
    error?: string
    details?: unknown
  } | undefined

  if (!response.ok) {
    const error = new Error(
      body?.message ??
        body?.error ??
        `Request failed with status ${response.status}`,
    ) as ApiError

    error.status = response.status

    error.code = body?.error

    error.details = body?.details

    throw error
  }

  return body as T
}

export const api = {
  auth: {
    async login(email: string, password: string, portal: PortalRole) {
      if (!isBackendConfigured() && import.meta.env?.DEV) {
        if (!email || !password)
          throw new Error("Please enter your email and password.")

        if (
          (portal === "doctor" && email.includes("patient")) ||
          (portal === "patient" && email.includes("doctor"))
        ) {
          throw new Error("Invalid login credentials for this portal.")
        }

        const user: ApiUser =
          portal === "doctor"
            ? {
                id: DEMO_DOCTOR.id,
                role: "doctor",
                email,
                fullName: DEMO_DOCTOR.name,
              }
            : { id: "p-001", role: "patient", email, fullName: "Marcus Rivera" }

        return {
          token: `dev-${portal}-token`,
          refreshToken: `dev-${portal}-refresh`,
          user,
        }
      }

      return request<{ token: string; refreshToken: string; user: ApiUser }>(
        "/auth/login",
        {
          method: "POST",

          body: JSON.stringify({ email, password, portal }),
        },
      )
    },

    logout: () =>
      request<{ success: boolean }>("/auth/logout", { method: "POST" }),

    me: () => request<{ user: ApiUser }>("/auth/me"),

    refresh: (refreshToken: string) =>
      request<{ token: string; refreshToken: string }>("/auth/refresh", {
        method: "POST",

        body: JSON.stringify({ refreshToken }),
      }),

    recoverPassword: (email: string) =>
      request<{ success: boolean; message: string }>("/auth/recover-password", {
        method: "POST",

        body: JSON.stringify({ email }),
      }),
    getSettings: () =>
      isBackendConfigured()
        ? request<{ settings: Record<string, unknown> }>("/auth/me/settings")
        : Promise.resolve({ settings: {} }),
    updateSettings: (settings: Record<string, unknown>) =>
      isBackendConfigured()
        ? request<{ success: boolean; settings: Record<string, unknown> }>(
            "/auth/me/settings",
            {
              method: "PUT",
              body: JSON.stringify(settings),
            },
          )
        : Promise.resolve({ success: true, settings }),
  },

  patients: {
    list: () =>
      isBackendConfigured()
        ? request<{ patients: ApiPatient[] }>("/patients").then(
            ({ patients }) => ({
              patients: patients.map(normalizePatient),
            }),
          )
        : Promise.resolve({ patients: DEMO_PATIENTS }),

    get: (id: string) =>
      isBackendConfigured()
        ? request<{ patient: ApiPatient }>(`/patients/${id}`).then(
            ({ patient }) => ({
              patient: normalizePatient(patient),
            }),
          )
        : Promise.resolve({
            patient:
              DEMO_PATIENTS.find(
                (patient) => patient.id === id || patient.patientId === id,
              ) ?? DEMO_PATIENTS[0],
          }),

    create: (data: {
      fullName: string
      dateOfBirth: string
      contactEmail: string
      conditions?: string[]
    }) =>
      isBackendConfigured()
        ? request<{ success: boolean; patient: typeof DEMO_PATIENTS[number] }>(
            "/patients",
            { method: "POST", body: JSON.stringify(data) },
          )
        : Promise.resolve({
            success: true,
            patient: {
              ...DEMO_PATIENTS[0],
              id: `demo-${Date.now()}`,
              patientId: `PT-${Date.now()}`,
              name: data.fullName,
              email: data.contactEmail,
              dob: data.dateOfBirth,
              conditions: data.conditions ?? [],
              status: "invited" as const,
            },
          }),

    getVisits: (patientId: string) =>
      isBackendConfigured()
        ? request<{ visits: Record<string, unknown>[] }>(
            `/patients/${patientId}/visits`,
          ).then(({ visits }) => ({ visits: visits.map(normalizeVisit) }))
        : Promise.resolve({
            visits: DEMO_VISITS.filter(
              (visit) => visit.patientId === patientId || patientId === "p-001",
            ),
          }),

    getMedications: (patientId: string) =>
      isBackendConfigured()
        ? request<{
            medications: Array<{
              id: string
              name?: string
              dosage?: string
              form?: string
            }>
          }>(`/patients/${patientId}/medications`)
        : Promise.resolve({
            medications: DEMO_PRESCRIPTIONS.map((prescription) => ({
              id: prescription.id,
              name: prescription.medication.name,
              dosage: `${prescription.medication.strength}${prescription.medication.unit}`,
              form: prescription.medication.frequency,
            })),
          }),

    getPrescriptions: (patientId: string) =>
      isBackendConfigured()
        ? request<{ prescriptions: Record<string, unknown>[] }>(
            `/patients/${patientId}/prescriptions`,
          ).then(({ prescriptions }) => ({
            prescriptions: prescriptions.map(normalizePrescription),
          }))
        : Promise.resolve({
            prescriptions: DEMO_PRESCRIPTIONS,
          }),

    getAdherence: (patientId: string) =>
      isBackendConfigured()
        ? request<{ logs: Array<{ status?: string }> }>(
            `/patients/${patientId}/adherence`,
          )
        : Promise.resolve({ logs: [] }),

    getConsent: (patientId: string) =>
      isBackendConfigured()
        ? request<{
            consent: {
              share_with_care_team?: boolean
              allow_reminders?: boolean
              allow_ai_analysis?: boolean
            } | null
          }>(`/patients/${patientId}/consent`)
        : Promise.resolve({
            consent: {
              share_with_care_team: true,
              allow_reminders: true,
              allow_ai_analysis: false,
            },
          }),

    updateConsent: (patientId: string, consent: Record<string, boolean>) =>
      isBackendConfigured()
        ? request<{ success: boolean; consent: Record<string, boolean> }>(
            `/patients/${patientId}/consent`,
            { method: "PUT", body: JSON.stringify(consent) },
          )
        : Promise.resolve({ success: true, consent }),

    getSettings: (patientId: string) =>
      isBackendConfigured()
        ? request<{ settings: unknown[] }>(`/patients/${patientId}/settings`)
        : Promise.resolve({ settings: [] }),

    updateSettings: (patientId: string, setting: Record<string, unknown>) =>
      isBackendConfigured()
        ? request<{ success: boolean; setting: unknown }>(
            `/patients/${patientId}/settings`,
            { method: "PUT", body: JSON.stringify(setting) },
          )
        : Promise.resolve({ success: true, setting }),
  },

  prescriptions: {
    approve: (
      id: string,
      payload?: {
        idempotencyKey?: string
        suggestion?: unknown
        editedValues?: Record<string, unknown>
        changes?: Record<string, unknown>
        reason?: string
        medication?: Record<string, unknown>
      },
    ) =>
      isBackendConfigured()
        ? request<ApprovalResponse>(`/prescriptions/${id}/approve`, {
            method: "POST",
            body: JSON.stringify(payload ?? {}),
          })
        : Promise.resolve<ApprovalResponse>({
            success: true,
            prescription: {
              id,
              status: "approved",
              suggestedBy: "ai",
              approvedBy: DEMO_DOCTOR.id,
              approvedAt: new Date().toISOString(),
              citations: [],
              revisions: [],
              medication: {
                id: `med-ai-${id}`,
                name: (payload?.suggestion as any)?.name ?? "Medication",
                genericName: (payload?.suggestion as any)?.genericName ?? "generic",
                strength: (payload?.suggestion as any)?.strength ?? "10mg",
                unit: (payload?.suggestion as any)?.unit ?? "mg",
                frequency: (payload?.suggestion as any)?.frequency ?? "daily",
                quantity: (payload?.suggestion as any)?.quantity ?? 30,
                duration: "30 days",
                instructions: "Take with food",
                startDate: new Date().toISOString().slice(0, 10),
                endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                status: "active",
                prescribedBy: DEMO_DOCTOR.name,
              },
            },
            correlationId: `corr-demo-${Date.now()}`,
          }),

    reject: (id: string) =>
      request<{ success: boolean; prescription: unknown }>(
        `/prescriptions/${id}/reject`,
        { method: "POST" },
      ),
  },

  doses: {
    log: (data: Record<string, unknown>) =>
      request<{ success: boolean; duplicated: boolean; dose: unknown }>(
        "/doses",
        {
          method: "POST",
          body: JSON.stringify({
            ...data,
            idempotencyKey:
              data.idempotencyKey ??
              `${String(data.patientId)}:${String(data.scheduleId)}:${String(data.status)}`,
          }),
        },
      ),
  },

  escalations: {
    list: (patientId?: string) =>
      request<{ escalations: unknown[] }>(
        patientId
          ? `/escalations?patientId=${encodeURIComponent(patientId)}`
          : "/escalations",
      ),
    acknowledge: (id: string) =>
      request<{ success: boolean; escalation: unknown }>(
        `/escalations/${id}/acknowledge`,
        { method: "POST" },
      ),
  },

  reports: {
    getUploadUrl: (data: Record<string, unknown>) =>
      request<{
        uploadUrl: string
        storagePath: string
        expiresInSeconds: number
      }>("/reports/upload-url", { method: "POST", body: JSON.stringify(data) }),

    create: (data: Record<string, unknown>) =>
      request<{ success: boolean; report: unknown }>("/reports", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    list: (patientId: string) =>
      request<{ reports: unknown[] }>(
        `/reports?patientId=${encodeURIComponent(patientId)}`,
      ),

    getViewUrl: (reportId: string) =>
      request<{ signedUrl: string; expiresInSeconds: number }>(
        `/reports/${reportId}/view-url`,
      ),

    review: (reportId: string) =>
      request<{ success: boolean; report: unknown }>(
        `/reports/${reportId}/review`,
        { method: "PATCH" },
      ),
  },

  corrections: {
    create: (data: Record<string, unknown>) =>
      request<{ success: boolean; correction: unknown }>("/corrections", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    list: (patientId: string) =>
      request<{ corrections: unknown[] }>(
        `/corrections?patientId=${encodeURIComponent(patientId)}`,
      ),

    updateStatus: (
      id: string,
      status: "under_review" | "resolved" | "rejected",
    ) =>
      request<{ success: boolean; correction: unknown }>(
        `/corrections/${id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      ),
  },

  careTeam: {
    list: () =>
      isBackendConfigured()
        ? request<{ members: typeof DEMO_CARE_TEAM }>("/care-team")
        : Promise.resolve({ members: DEMO_CARE_TEAM }),
  },

  audit: {
    list: (params?: { action?: string; limit?: number }) => {
      const query = new URLSearchParams()

      if (params?.action) query.set("action", params.action)

      if (params?.limit) query.set("limit", String(params.limit))

      return request<{ events: unknown[] }>(`/audit?${query}`)
    },
  },

  doctor: {
    getDashboard: () =>
      isBackendConfigured()
        ? request<DoctorDashboardResponse>("/doctor/dashboard")
        : Promise.resolve<DoctorDashboardResponse>({
            patientCount: {
              value: DEMO_PATIENTS.length,
              availability: "available",
            },
            averageAdherence: {
              value:
                Math.round(
                  (DEMO_PATIENTS.reduce(
                    (sum, p) => sum + p.adherenceScore,
                    0,
                  ) /
                    DEMO_PATIENTS.length) *
                    10,
                ) / 10,
              availability: "available",
            },
            openEscalations: {
              value: DEMO_PATIENTS.filter((p) => p.hasEscalation).length,
              availability: "available",
            },
            remindersDelivered: { value: 1284, availability: "available" },
            recentActivity: [
              {
                id: "demo-act-1",
                type: "escalation_opened",
                description: "Missed dose pattern detected for Lisinopril",
                patientId: "p-001",
                patientName: "Marcus Rivera",
                timestamp: new Date(Date.now() - 3600000).toISOString(),
              },
              {
                id: "demo-act-2",
                type: "prescription_approved",
                description: "Prescription approved for Losartan 50mg",
                patientId: "p-001",
                patientName: "Marcus Rivera",
                timestamp: new Date(Date.now() - 7200000).toISOString(),
              },
            ],
            freshnessTimestamp: new Date().toISOString(),
            correlationId: `corr-demo-${Date.now()}`,
          }),

    getPipeline: (patientId: string) =>
      isBackendConfigured()
        ? request<PatientPipelineResponse>(
            `/doctor/patients/${patientId}/pipeline`,
          )
        : Promise.resolve<PatientPipelineResponse>({
            run: null,
            stages: [],
            correlationId: `corr-demo-${Date.now()}`,
          }),

    getSettings: () =>
      isBackendConfigured()
        ? request<DoctorSettingsResponse>("/doctor/settings")
        : Promise.resolve<DoctorSettingsResponse>({
            profile: {
              id: DEMO_DOCTOR.id,
              fullName: DEMO_DOCTOR.name,
              email: DEMO_DOCTOR.email,
              role: "doctor",
            },
            preferences: {
              displayName: DEMO_DOCTOR.name,
              specialty: DEMO_DOCTOR.specialty,
              phone: "+1 (555) 234-5678",
              notification: {
                channels: ["email", "push"],
                quietHoursStart: "22:00",
                quietHoursEnd: "07:00",
              },
            },
            correlationId: `corr-demo-${Date.now()}`,
          }),

    updateSettings: (preferences: Partial<DoctorProfilePreferences>) =>
      isBackendConfigured()
        ? request<DoctorSettingsResponse>("/doctor/settings", {
            method: "PUT",
            body: JSON.stringify(preferences),
          })
        : Promise.resolve<DoctorSettingsResponse>({
            profile: {
              id: DEMO_DOCTOR.id,
              fullName: preferences.displayName || DEMO_DOCTOR.name,
              email: DEMO_DOCTOR.email,
              role: "doctor",
            },
            preferences: {
              displayName: preferences.displayName || DEMO_DOCTOR.name,
              specialty: preferences.specialty || DEMO_DOCTOR.specialty,
              phone: preferences.phone || "",
              notification: preferences.notification || {
                channels: ["email", "push"],
                quietHoursStart: "22:00",
                quietHoursEnd: "07:00",
              },
            },
            correlationId: `corr-demo-${Date.now()}`,
          }),
  },
}
