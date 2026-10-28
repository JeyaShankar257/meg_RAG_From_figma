import { useEffect, useState, useCallback } from "react"

import { useNavigate } from "react-router-dom"

import { api, isBackendConfigured } from "../../lib/api/apiClient"

import type { Patient, DoctorDashboardResponse } from "../../lib/types"

import Card from "../../components/ui/Card"

import Badge from "../../components/ui/Badge"

import Button from "../../components/ui/Button"

import StatusPill from "../../components/ui/StatusPill"

import TrustBadge from "../../components/ui/TrustBadge"

import TrendSparkline from "../../components/charts/TrendSparkline"

export default function DoctorDashboard() {
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState("")

  const [searchId, setSearchId] = useState("")

  const [patients, setPatients] = useState<Patient[]>([])

  const [dashboardData, setDashboardData] =
    useState<DoctorDashboardResponse | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const loadData = useCallback(() => {
    setLoading(true)

    setError("")

    Promise.all([
      api.patients.list(),

      api.doctor.getDashboard(),
    ])

      .then(([patientsRes, dashboardRes]) => {
        setPatients(patientsRes.patients)

        setDashboardData(dashboardRes)
      })

      .catch((err) => {
        setDashboardData(null)

        setError(
          err?.message ||
            "Dashboard and patient data could not be loaded. Please retry.",
        )
      })

      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const openEscalations = patients.filter((patient) => patient.hasEscalation)

  // Derive metric values safely based on backend data

  const patientCountDisplay =
    dashboardData?.patientCount.availability === "available"
      ? String(dashboardData.patientCount.value)
      : String(patients.length)

  const adherenceDisplay =
    dashboardData?.averageAdherence.availability === "available"
      ? `${dashboardData.averageAdherence.value}%`
      : "—"

  const escalationsDisplay =
    dashboardData?.openEscalations.availability === "available"
      ? String(dashboardData.openEscalations.value)
      : String(openEscalations.length)

  const remindersDisplay =
    dashboardData?.remindersDelivered.availability === "available"
      ? String(dashboardData.remindersDelivered.value)
      : "—"

  // Recent activity items

  const activityList = (dashboardData?.recentActivity || []).map((act) => ({
    id: act.id,

    text: act.description,

    time: act.timestamp
      ? new Date(act.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recent",

    type: act.type.includes("escalation")
      ? "error"
      : act.type.includes("approved")
        ? "success"
        : "info",
  }))

  return (
    <div className="p-6 max-w-7xl space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {dashboardData?.freshnessTimestamp
              ? `Updated ${new Date(dashboardData.freshnessTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Saturday, September 12, 2026"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <Button size="sm" variant="outline" onClick={loadData}>
              Retry Loading
            </Button>
          )}
          <Button
            onClick={() => navigate("/doctor/patients/new")}
            icon={<PlusIcon />}
          >
            Add New Patient
          </Button>
        </div>
      </div>

      {loading && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          Loading clinical dashboard and patient data…
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-sm text-rose-700">
          <div>
            <p className="font-semibold text-rose-800">Dashboard Unavailable</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
          <Button size="sm" variant="danger" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Escalation banner */}
      {openEscalations.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 animate-slide-in-up">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse-ring">
                <svg
                  viewBox="0 0 24 24"
                  className="fill-rose-600"
                  width={16}
                  height={16}
                >
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-rose-800">
                  {openEscalations.length} Active Escalation
                  {openEscalations.length > 1 ? "s" : ""} Requiring Attention
                </div>
                {openEscalations.map((esc) => (
                  <div key={esc.id} className="mt-1.5 text-sm text-rose-700">
                    <span className="font-medium">{esc.name}</span> — adherence
                    escalation
                    <span className="ml-2 bg-rose-100 text-rose-700 text-xs px-1.5 py-0.5 rounded-full font-medium border border-rose-200">
                      attention
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                navigate(`/doctor/patients/${openEscalations[0]?.id}/care-team`)
              }
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Patients",

            value: patientCountDisplay,

            sub:
              dashboardData?.patientCount.availability !== "available"
                ? dashboardData?.patientCount.errorMessage ||
                  "Temporarily unavailable"
                : "Assignment scoped",

            color: "teal",

            availability: dashboardData?.patientCount.availability,
          },

          {
            label: "Avg Adherence",

            value: adherenceDisplay,

            sub:
              dashboardData?.averageAdherence.availability !== "available"
                ? dashboardData?.averageAdherence.errorMessage ||
                  "Computation unavailable"
                : "Monitored patients",

            color: "teal",

            availability: dashboardData?.averageAdherence.availability,
          },

          {
            label: "Open Escalations",

            value: escalationsDisplay,

            sub:
              dashboardData?.openEscalations.availability !== "available"
                ? dashboardData?.openEscalations.errorMessage || "Query error"
                : "Requires review",

            color: "rose",

            availability: dashboardData?.openEscalations.availability,
          },

          {
            label: "Reminders Delivered",

            value: remindersDisplay,

            sub:
              dashboardData?.remindersDelivered.availability !== "available"
                ? dashboardData?.remindersDelivered.errorMessage ||
                  "Metric unavailable"
                : "Verified delivered",

            color: "slate",

            availability: dashboardData?.remindersDelivered.availability,
          },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center justify-between mb-0.5">
              <div
                className={`text-2xl font-bold ${
                  stat.color === "rose" ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {stat.value}
              </div>
              {stat.availability && stat.availability !== "available" && (
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    stat.availability === "error"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {stat.availability}
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-slate-700">
              {stat.label}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {stat.sub}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Assigned Patients
            </h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or ID…"
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
              />
            </div>
          </div>

          {filtered.length === 0 && !loading && (
            <Card
              padding="md"
              className="text-center py-8 text-slate-500 text-sm"
            >
              {searchQuery
                ? "No patients matching your search."
                : "No assigned patients found."}
            </Card>
          )}

          <div className="space-y-3">
            {filtered.map((patient, i) => (
              <Card
                key={patient.id}
                hover
                onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                className="animate-slide-in-up"
                style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                    {patient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {patient.name}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {patient.patientId}
                      </span>
                      <StatusPill status={patient.status} />
                      {patient.hasEscalation && (
                        <Badge variant="error" dot>
                          Escalation
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {patient.conditions.join(" · ")} · Last visit{" "}
                      {patient.lastVisit || "N/A"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {patient.status === "active" && (
                      <>
                        <TrustBadge
                          score={patient.adherenceScore}
                          trend={patient.trend}
                          size="sm"
                        />
                        <div className="w-20 h-8">
                          <TrendSparkline
                            data={[
                              {
                                date: "1",
                                value: Math.max(0, patient.adherenceScore - 6),
                              },

                              {
                                date: "2",
                                value: Math.max(0, patient.adherenceScore - 2),
                              },

                              { date: "3", value: patient.adherenceScore },

                              { date: "4", value: patient.adherenceScore },
                            ]}
                            color={
                              patient.trend === "down" ? "#e11d48" : "#0d9488"
                            }
                          />
                        </div>
                      </>
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width={16}
                      height={16}
                      className="text-slate-400 flex-shrink-0"
                    >
                      <path
                        d="M9 18l6-6-6-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Patient ID lookup */}
          <Card
            padding="md"
            className="border-dashed border-2 border-slate-200 bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Look up by Patient ID (PT-XXXXX)…"
                className="flex-1 text-sm bg-transparent border-0 outline-none text-slate-700 placeholder-slate-400 font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!searchId.trim()) return

                  const found = patients.find(
                    (p) =>
                      p.patientId.toLowerCase() ===
                      searchId.trim().toLowerCase(),
                  )

                  if (found) navigate(`/doctor/patients/${found.id}`)
                }}
              >
                Look Up
              </Button>
            </div>
          </Card>
        </div>

        {/* Activity feed */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Activity
          </h2>
          <Card padding="none">
            {activityList.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center">
                No recent clinical activity recorded.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activityList.map((item) => (
                  <div key={item.id} className="flex gap-3 p-4">
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        item.type === "error"
                          ? "bg-rose-500"
                          : item.type === "success"
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {item.text}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        {item.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick add card */}
          <Card padding="md" className="bg-teal-50 border-teal-100">
            <h3 className="text-sm font-semibold text-teal-800 mb-1">
              Add New Patient
            </h3>
            <p className="text-xs text-teal-700 mb-3">
              Register a new patient and send them an activation email.
            </p>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => navigate("/doctor/patients/new")}
            >
              Start Registration
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      width={16}
      height={16}
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
