import { useState, useEffect } from "react"
import { api, getPatientId } from "../../lib/api/apiClient"
import { useSession } from "../../lib/auth/SessionProvider"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import StatusPill from "../../components/ui/StatusPill"

interface DoseEntry {
  id: string
  name: string
  strength: string
  unit: string
  scheduledTime: string
  status: "pending" | "taken" | "skipped" | "missed"
  isActionable: boolean
  isOverdue: boolean
  loggedAt?: string
  reason?: string
}

interface DoseHistoryItem {
  id: string
  date: string
  time: string
  name: string
  status: "taken" | "skipped" | "missed" | "late"
  logged?: string
}

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

  const [doses, setDoses] = useState<DoseEntry[]>([])
  const [history, setHistory] = useState<DoseHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [logging, setLogging] = useState<string | null>(null)
  const [skippingId, setSkippingId] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState("")
  const [justTaken, setJustTaken] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const patientId = getPatientId(user)
    if (!patientId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    Promise.all([
      api.patients.getDoseSchedules(patientId),
      api.patients.getAdherence(patientId),
    ])
      .then(([schedRes, adhRes]) => {
        const nextDoses: DoseEntry[] = (schedRes.schedules || []).map((s) => {
          const isLogged =
            Boolean(s.loggedAt) || s.status === "taken" || s.status === "skipped"
          const isOverdue = !isLogged && s.status === "missed"
          return {
            id: s.id,
            name: s.medicationName,
            strength: s.dosage,
            unit: "",
            scheduledTime: s.scheduledTime,
            status: isLogged
              ? ((s.status === "late" ? "taken" : s.status) as
                  | "taken"
                  | "skipped")
              : "pending",
            isActionable: !isLogged,
            isOverdue,
            loggedAt: s.loggedAt
              ? new Date(s.loggedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined,
            reason: s.reason || undefined,
          }
        })
        setDoses(nextDoses)

        const mappedHistory: DoseHistoryItem[] = (adhRes.logs || []).map(
          (l, index) => {
            const logDate = l.loggedAt ? new Date(l.loggedAt) : new Date()
            const isToday =
              logDate.toDateString() === new Date().toDateString()
            const dateStr = isToday
              ? "Today"
              : logDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
            const timeStr = logDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })

            const medName = l.medicationName
              ? `${l.medicationName}${l.dosage ? ` ${l.dosage}` : ""}`
              : "Medication Dose"

            return {
              id: l.id || `hist-${index}`,
              date: dateStr,
              time: timeStr,
              name: medName,
              status: (l.status === "late" ? "taken" : l.status) as
                | "taken"
                | "skipped"
                | "missed"
                | "late",
              logged:
                l.status === "skipped" && l.reason
                  ? `Reason: ${l.reason}`
                  : timeStr,
            }
          },
        )
        setHistory(mappedHistory)
      })
      .catch(() => setError("Today's dose schedule could not be loaded."))
      .finally(() => setLoading(false))
  }, [user])

  const handleTake = async (id: string) => {
    const targetDose = doses.find((d) => d.id === id)
    if (!targetDose) return

    setError("")
    setLogging(id)

    try {
      if (user) {
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

    const nowFormatted = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    setDoses((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: "taken",
              isActionable: false,
              isOverdue: false,
              loggedAt: nowFormatted,
            }
          : d,
      ),
    )

    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        date: "Today",
        time: nowFormatted,
        name: `${targetDose.name} ${targetDose.strength}`.trim(),
        status: "taken",
        logged: nowFormatted,
      },
      ...prev,
    ])

    setJustTaken(id)
    setLogging(null)
    setSkippingId(null)
    setTimeout(() => setJustTaken(null), 2000)
  }

  const handleSkip = async (id: string) => {
    const targetDose = doses.find((d) => d.id === id)
    if (!targetDose) return

    setError("")
    setLogging(id)

    try {
      if (user) {
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

    const nowFormatted = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    setDoses((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: "skipped",
              isActionable: false,
              isOverdue: false,
              reason: skipReason,
              loggedAt: nowFormatted,
            }
          : d,
      ),
    )

    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        date: "Today",
        time: nowFormatted,
        name: `${targetDose.name} ${targetDose.strength}`.trim(),
        status: "skipped",
        logged: `Reason: ${skipReason}`,
      },
      ...prev,
    ])

    setLogging(null)
    setSkippingId(null)
    setSkipReason("")
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dose Center</h1>
        <p className="text-slate-500 text-sm">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} padding="md" className="animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-200 rounded w-20" />
                  </div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && doses.length === 0 && (
        <Card padding="lg" className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">All caught up!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {"No doses are scheduled for today. Check back tomorrow or consult your care team if you have questions."}
          </p>
        </Card>
      )}

      {/* Today's doses */}
      {!loading && doses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {"Today's Schedule"}
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
                            : dose.isOverdue
                              ? "bg-amber-50 border border-amber-200"
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
                      ) : dose.isOverdue ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="fill-amber-600"
                          width={18}
                          height={18}
                        >
                          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2C11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
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
                      {dose.isOverdue && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full mt-1">
                          Past due window
                        </span>
                      )}
                      {dose.loggedAt && (
                        <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                          Logged at {dose.loggedAt}
                        </p>
                      )}
                      {dose.reason && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Reason: {dose.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions: Take Dose & Skip Dose */}
                  <div className="flex-shrink-0">
                    {dose.isActionable ? (
                      skippingId === dose.id ? (
                        <div className="space-y-2 animate-fade-in min-w-[200px]">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Reason for skipping:
                            </label>
                            <select
                              value={skipReason}
                              onChange={(e) => setSkipReason(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              autoFocus
                            >
                              <option value="">Select reason…</option>
                              {SKIP_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              fullWidth
                              onClick={() => skipReason && handleSkip(dose.id)}
                              disabled={!skipReason || logging === dose.id}
                            >
                              Confirm Skip
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSkippingId(null)
                                setSkipReason("")
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleTake(dose.id)}
                            disabled={logging === dose.id}
                            className="gap-1.5 shadow-sm"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-3.5 h-3.5 fill-current"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            Take Dose
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSkippingId(dose.id)
                              setSkipReason("")
                            }}
                            disabled={logging === dose.id}
                            className="text-slate-600 hover:text-slate-800"
                          >
                            Skip Dose
                          </Button>
                        </div>
                      )
                    ) : (
                      <StatusPill status={dose.status} />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Adherence Guidance Card */}
      <Card padding="md" className="bg-teal-50/60 border border-teal-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 text-teal-700">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width={18}
              height={18}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-950">
              Simple Daily Dose Tracking
            </p>
            <p className="text-xs text-teal-800 mt-0.5">
              {"Stay consistent with your care plan. Simply tap Take Dose whenever you take your medication, or Skip Dose if advised or unable."}
            </p>
          </div>
        </div>
      </Card>

      {/* Recent history */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Recent History
        </h2>
        {history.length === 0 ? (
          <Card padding="md" className="text-center py-6 text-slate-400 text-xs">
            No dose history recorded yet.
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 w-14">
                      {h.date}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {h.name} · {h.time}
                      </p>
                      {h.logged && (
                        <p className="text-xs text-slate-400">{h.logged}</p>
                      )}
                    </div>
                  </div>
                  <StatusPill status={h.status} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
