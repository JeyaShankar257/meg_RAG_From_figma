import { useState, useEffect } from "react"

import { api, getPatientId, isBackendConfigured } from "../../lib/api/apiClient"

import { useSession } from "../../lib/auth/SessionProvider"

import { DEMO_PRESCRIPTIONS } from "../../lib/mockData"

import Card from "../../components/ui/Card"

import Button from "../../components/ui/Button"

import StatusPill from "../../components/ui/StatusPill"

interface DoseEntry {
  id: string

  name: string

  strength: string

  unit: string

  scheduledTime: string

  status: "pending" | "taken" | "late" | "skipped"

  loggedAt?: string

  reason?: string
}

const todayDoses: DoseEntry[] = [
  {
    id: "d1",
    name: "Metformin",
    strength: "1000",
    unit: "mg",
    scheduledTime: "8:00 AM",
    status: "taken",
    loggedAt: "8:04 AM",
  },

  {
    id: "d2",
    name: "Amlodipine",
    strength: "5",
    unit: "mg",
    scheduledTime: "8:00 AM",
    status: "taken",
    loggedAt: "8:04 AM",
  },

  {
    id: "d3",
    name: "Metformin",
    strength: "1000",
    unit: "mg",
    scheduledTime: "7:00 PM",
    status: "pending",
  },
]

const SKIP_REASONS = [
  "Felt unwell",

  "Forgot",

  "Out of medication",

  "Side effects",

  "Travelling",

  "Other",
]

export default function DoseCenter() {
  const { user } = useSession()

  const [doses, setDoses] = useState<DoseEntry[]>(
    isBackendConfigured() ? [] : todayDoses,
  )

  const [loading, setLoading] = useState(isBackendConfigured())

  const [error, setError] = useState("")

  const [logging, setLogging] = useState<string | null>(null)

  const [skipReason, setSkipReason] = useState("")

  const [justTaken, setJustTaken] = useState<string | null>(null)

  const [lateMode, setLateMode] = useState<string | null>(null)

  useEffect(() => {
    if (!isBackendConfigured() || !user) return

    setLoading(true)
    setError("")

    api.patients
      .getDoseSchedules(getPatientId(user))
      .then(({ schedules }) => {
        const next = (schedules || []).map((s) => ({
          id: s.id,
          name: s.medicationName,
          strength: s.dosage,
          unit: "",
          scheduledTime: s.scheduledTime,
          status: (s.status === "scheduled" ? "pending" : s.status) as "pending" | "taken" | "late" | "skipped",
          loggedAt: s.loggedAt ? new Date(s.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
          reason: s.reason || undefined,
        }))

        setDoses(next)
      })
      .catch(() => setError("Today's dose schedule could not be loaded."))
      .finally(() => setLoading(false))
  }, [user])

  const handleTake = async (id: string) => {
    setError("")
    setLogging(id)

    try {
      if (isBackendConfigured() && user) {
        await api.doses.log({
          patientId: getPatientId(user),
          scheduleId: id,
          status: "taken",
          idempotencyKey: crypto.randomUUID(),
        })
      }
    } catch {
      setError("Dose could not be saved. Try again.")
      setLogging(null)
      return
    }

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    setDoses((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "taken", loggedAt: now } : d,
      ),
    )

    setJustTaken(id)
    setLogging(null)
    setTimeout(() => setJustTaken(null), 2000)
  }

  const handleSkip = async (id: string) => {
    setError("")
    setLogging(id)

    try {
      if (isBackendConfigured() && user) {
        await api.doses.log({
          patientId: getPatientId(user),
          scheduleId: id,
          status: "skipped",
          reason: skipReason,
          idempotencyKey: crypto.randomUUID(),
        })
      }
    } catch {
      setError("Dose could not be saved. Try again.")
      setLogging(null)
      return
    }

    setDoses((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "skipped", reason: skipReason } : d,
      ),
    )

    setLogging(null)
    setSkipReason("")
  }

  const handleLate = async (id: string) => {
    setError("")
    setLogging(id)

    try {
      if (isBackendConfigured() && user) {
        await api.doses.log({
          patientId: getPatientId(user),
          scheduleId: id,
          status: "late",
          idempotencyKey: crypto.randomUUID(),
        })
      }
    } catch {
      setError("Dose could not be saved. Try again.")
      setLogging(null)
      return
    }

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    setDoses((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "late", loggedAt: now } : d,
      ),
    )

    setLateMode(null)
    setLogging(null)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dose Center</h1>
        <p className="text-slate-500 text-sm">Saturday, September 12, 2026</p>
      </div>
      {loading && (
        <p className="text-sm text-slate-500">Loading today’s doses…</p>
      )}
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {!loading && !error && doses.length === 0 && (
        <p className="text-sm text-slate-500">No doses are scheduled today.</p>
      )}

      {/* Today's doses */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Today&apos;s Schedule
        </h2>
        <div className="space-y-3">
          {doses.map((dose) => (
            <Card key={dose.id} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      dose.status === "taken"
                        ? "bg-emerald-100"
                        : dose.status === "skipped"
                          ? "bg-slate-100"
                          : dose.status === "late"
                            ? "bg-amber-100"
                            : "bg-teal-50 border border-teal-200"
                    }`}
                  >
                    {dose.status === "taken" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className={`fill-emerald-600 ${
                          justTaken === dose.id ? "animate-heartbeat" : ""
                        }`}
                        width={18}
                        height={18}
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : dose.status === "skipped" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="fill-slate-400"
                        width={18}
                        height={18}
                      >
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="fill-teal-600"
                        width={18}
                        height={18}
                      >
                        <path d="M10.5 19.5h3v-6h6v-3h-6v-6h-3v6h-6v3h6z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {dose.name} {dose.strength}
                      {dose.unit}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Scheduled: {dose.scheduledTime}
                    </p>
                    {dose.loggedAt && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {dose.status === "late" ? "Logged late" : "Logged"} at{" "}
                        {dose.loggedAt}
                      </p>
                    )}
                    {dose.reason && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Reason: {dose.reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {dose.status === "pending" ? (
                    logging === dose.id ? (
                      <div className="space-y-2 animate-fade-in min-w-[200px]">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            fullWidth
                            onClick={() => handleTake(dose.id)}
                          >
                            ✓ Taken Now
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          fullWidth
                          onClick={() => {
                            setLateMode(dose.id)
                          }}
                        >
                          Log as Late
                        </Button>
                        <div>
                          <select
                            value={skipReason}
                            onChange={(e) => setSkipReason(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5"
                          >
                            <option value="">Skip — choose reason…</option>
                            {SKIP_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            fullWidth
                            onClick={() => skipReason && handleSkip(dose.id)}
                            disabled={!skipReason}
                          >
                            Log as Skipped
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          fullWidth
                          onClick={() => setLogging(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setLogging(dose.id)}>
                        Log Dose
                      </Button>
                    )
                  ) : (
                    <StatusPill
                      status={dose.status as "taken" | "late" | "skipped"}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* History note */}
      <Card
        padding="md"
        className="bg-slate-50 border-dashed border-2 border-slate-200"
      >
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width={20}
            height={20}
            className="text-slate-400 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Late logging is supported
            </p>
            <p className="text-xs text-slate-500">
              You can log a missed or late dose up to 72 hours after the
              scheduled time. Late logs are marked and visible to your care
              team.
            </p>
          </div>
        </div>
      </Card>

      {/* Recent history */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Recent History
        </h2>
        <Card padding="none">
          <div className="divide-y divide-slate-100">
            {[
              {
                date: "Sep 11",
                name: "Metformin 1000mg",
                time: "PM",
                status: "taken",
                logged: "6:58 PM",
              },

              {
                date: "Sep 11",
                name: "Metformin 1000mg",
                time: "AM",
                status: "taken",
                logged: "8:02 AM",
              },

              {
                date: "Sep 11",
                name: "Amlodipine 5mg",
                time: "AM",
                status: "taken",
                logged: "8:02 AM",
              },

              {
                date: "Sep 10",
                name: "Metformin 1000mg",
                time: "PM",
                status: "late",
                logged: "9:14 PM",
              },

              {
                date: "Sep 10",
                name: "Metformin 1000mg",
                time: "AM",
                status: "taken",
                logged: "7:55 AM",
              },

              {
                date: "Sep 9",
                name: "Metformin 1000mg",
                time: "PM",
                status: "skipped",
                logged: "",
              },
            ].map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-12">
                    {h.date}
                  </span>
                  <div>
                    <p className="text-sm text-slate-700">
                      {h.name} · {h.time}
                    </p>
                    {h.logged && (
                      <p className="text-xs text-slate-400">{h.logged}</p>
                    )}
                  </div>
                </div>
                <StatusPill status={h.status as "taken" | "late" | "skipped"} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
