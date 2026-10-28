import { useEffect, useState } from "react"

import type { Visit } from "../../lib/types"

import { api, getPatientId, isBackendConfigured } from "../../lib/api/apiClient"

import { useSession } from "../../lib/auth/SessionProvider"

import Card from "../../components/ui/Card"

import Badge from "../../components/ui/Badge"

export default function PatientVisits() {
  const { user } = useSession()

  const [visits, setVisits] = useState<Visit[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const patientId = getPatientId(user)

    if (!patientId) {
      setLoading(false)

      return
    }

    setLoading(true)

    api.patients
      .getVisits(patientId)

      .then(({ visits: result }) => {
        setVisits(result)

        if (result.length > 0) {
          setExpanded(result[0].id)
        }
      })

      .catch((err) => setError(err?.message || "Visits could not be loaded."))

      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Visit History</h1>
        <p className="text-slate-500 text-sm">
          Read-only view of your clinical visits. Contact your care team for
          corrections.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="fill-amber-500 flex-shrink-0"
          width={14}
          height={14}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Clinical notes are shared according to your consent settings. Some
        details may be summarized.
      </div>

      {loading && <p className="text-sm text-slate-500">Loading visits…</p>}
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {!loading && !error && visits.length === 0 && (
        <p className="text-sm text-slate-500">No visits are available.</p>
      )}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-3">
          {visits.map((visit, i) => (
            <div
              key={visit.id}
              className="relative pl-12 animate-slide-in-up"
              style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}
            >
              <div
                className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 z-10 ${
                  i === 0
                    ? "bg-teal-500 border-teal-500"
                    : "bg-white border-slate-300"
                }`}
              />
              <Card
                hover
                onClick={() =>
                  setExpanded(expanded === visit.id ? null : visit.id)
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-slate-400">
                        {visit.date}
                      </span>
                      {i === 0 && (
                        <Badge variant="success" size="sm">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {visit.condition}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {visit.doctor}
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {visit.symptoms.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width={16}
                    height={16}
                    className={`text-slate-400 flex-shrink-0 mt-1 transition-transform ${
                      expanded === visit.id ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M19 9l-7 7-7-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {expanded === visit.id && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 animate-fade-in">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        What was discussed
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {visit.notes}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Outcome
                      </p>
                      <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        {visit.outcome}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
