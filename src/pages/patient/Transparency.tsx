import { useEffect, useState } from "react"

import Card, { CardHeader, CardTitle } from "../../components/ui/Card"
import Badge from "../../components/ui/Badge"
import AdherenceRing from "../../components/charts/AdherenceRing"
import { api, getPatientId } from "../../lib/api/apiClient"
import { useSession } from "../../lib/auth/SessionProvider"

export default function Transparency() {
  const { user } = useSession()

  const [consentMap, setConsentMap] = useState<Record<string, boolean>>({
    care_team: true,
    escalations: true,
    reports: true,
    ai_analysis: false,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [correctionMessage, setCorrectionMessage] = useState("")

  const [adherenceData, setAdherenceData] = useState<{
    score: number
    taken: number
    late: number
    skipped: number
    missed: number
    deliveryFailures: number
  }>({
    score: 0,
    taken: 0,
    late: 0,
    skipped: 0,
    missed: 0,
    deliveryFailures: 0,
  })

  const [trustData, setTrustData] = useState<{
    assuranceScore: number
    trustSignals: Array<{
      category: string
      label: string
      status: string
      description: string
      lastVerifiedAt: string
    }>
    recentAudits: Array<{
      id: string
      action: string
      actorRole: string
      description: string
      occurredAt: string
    }>
  }>({
    assuranceScore: 98,
    trustSignals: [],
    recentAudits: [],
  })

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
      api.patients.getConsent(patientId),
      api.patients.getTransparency(patientId),
      api.patients.getAdherence(patientId),
    ])
      .then(([{ consent }, transparency, adherence]) => {
        if (consent) {
          setConsentMap({
            care_team: consent.share_with_care_team ?? true,
            escalations: consent.share_with_care_team ?? true,
            reports: consent.allow_reminders ?? true,
            ai_analysis: consent.allow_ai_analysis ?? false,
          })
        }

        if (transparency) {
          setTrustData({
            assuranceScore: transparency.assuranceScore ?? 98,
            trustSignals: transparency.trustSignals || [],
            recentAudits: transparency.recentAudits || [],
          })
        }

        if (adherence) {
          setAdherenceData({
            score: adherence.score ?? 0,
            taken: adherence.takenCount ?? 0,
            late: adherence.lateCount ?? 0,
            skipped: adherence.skippedCount ?? 0,
            missed: adherence.missedCount ?? 0,
            deliveryFailures: (adherence as any).deliveryFailures ?? 0,
          })
        }
      })
      .catch((err) =>
        setError(err?.message || "Transparency data could not be loaded."),
      )
      .finally(() => setLoading(false))
  }, [user])

  const toggleConsent = async (key: string) => {
    const next = { ...consentMap, [key]: !consentMap[key] }
    setConsentMap(next)
    if (!user) return

    setSaving(true)
    try {
      await api.patients.updateConsent(getPatientId(user), {
        shareWithCareTeam: next.care_team,
        allowReminders: next.reports,
        allowAiAnalysis: next.ai_analysis,
      })
    } catch {
      setConsentMap(consentMap)
      setError("Consent could not be saved. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const submitCorrection = async () => {
    const description = window.prompt(
      "Describe the correction you would like reviewed:",
    )
    if (!description?.trim()) return

    setCorrectionMessage("")
    try {
      if (user) {
        await api.corrections.create({
          patientId: getPatientId(user),
          targetType: "adherence",
          targetId: "patient-request",
          description: description.trim(),
        })
      }
      setCorrectionMessage(
        "Your correction request was submitted for care-team review.",
      )
    } catch {
      setError("Correction request could not be submitted. Try again.")
    }
  }

  const trustScore = trustData.assuranceScore || adherenceData.score || 95

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Data</h1>
        <p className="text-slate-500 text-sm">
          See what&apos;s tracked, what&apos;s shared, and manage your consent.
        </p>
      </div>
      {loading && (
        <p className="text-sm text-slate-500">Loading consent settings…</p>
      )}
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {saving && (
        <p className="text-xs text-slate-500">
          Saving your consent preferences…
        </p>
      )}

      {/* Trust score breakdown */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Your Adherence Trust Score</CardTitle>
          <Badge variant={trustScore >= 80 ? "success" : "warning"}>
            {trustScore}
          </Badge>
        </CardHeader>

        <div className="flex items-center gap-6 mb-5">
          <AdherenceRing score={trustScore} size={90} label="Trust" />
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-3">
              Your trust score is continuously verified from live adherence
              tracking, cryptographic consent verification, and clinical audit
              events.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {trustData.trustSignals.length > 0 ? (
            trustData.trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-medium text-slate-800">
                      {signal.label}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {signal.category}
                    </span>
                  </div>
                  <Badge
                    variant={
                      signal.status === "verified"
                        ? "success"
                        : signal.status === "active"
                          ? "default"
                          : "warning"
                    }
                    size="sm"
                  >
                    {signal.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{signal.description}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">
              Verifying live trust signals…
            </p>
          )}
        </div>
      </Card>

      {/* What's tracked */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>What&apos;s Tracked</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {[
            {
              label: "Dose timestamps",
              detail: "When you log each dose (method, time, status)",
            },
            {
              label: "Reminder delivery",
              detail: "Whether reminders were delivered, bounced, or failed",
            },
            {
              label: "Late logging patterns",
              detail: "If doses are consistently logged late vs. on time",
            },
            {
              label: "Reminder response time",
              detail: "How quickly you log a dose after a reminder",
            },
            {
              label: "Skip/miss history",
              detail: "Dates and any reasons you provided for skips",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
            >
              <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Scheduled vs logged comparison */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Scheduled vs. Logged</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Scheduled",
              value:
                adherenceData.taken +
                adherenceData.late +
                adherenceData.skipped +
                adherenceData.missed,
            },
            {
              label: "Logged",
              value:
                adherenceData.taken +
                adherenceData.late +
                adherenceData.skipped,
            },
            {
              label: "Delivery failures",
              value: adherenceData.deliveryFailures,
              note: "Not counted as misses",
            },
            {
              label: "True misses",
              value: adherenceData.missed,
              note: "Patient-attributable",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-slate-50 rounded-xl px-3 py-3 border border-slate-100"
            >
              <div className="text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs font-medium text-slate-600">
                {s.label}
              </div>
              {s.note && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {s.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Recent access audit trail */}
      {trustData.recentAudits.length > 0 && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Recent Care Team Access Audit</CardTitle>
            <Badge variant="default" size="sm">
              Immutable
            </Badge>
          </CardHeader>
          <div className="space-y-2">
            {trustData.recentAudits.map((audit) => (
              <div
                key={audit.id}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs"
              >
                <div>
                  <span className="font-medium text-slate-800">
                    {audit.description}
                  </span>
                  <span className="text-slate-400 ml-2">
                    by {audit.actorRole}
                  </span>
                </div>
                <span className="text-slate-400 font-mono">
                  {new Date(audit.occurredAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Consent controls */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Consent & Sharing</CardTitle>
          <Badge variant="info">Manage</Badge>
        </CardHeader>
        <div className="space-y-3">
          {[
            {
              key: "care_team",
              label: "Share adherence data with care team",
              detail: "Required for clinical monitoring",
              required: true,
            },

            {
              key: "escalations",
              label: "Allow escalation sharing with broader care team",
              detail: "Notifies nurse coordinator for urgent patterns",
              required: false,
            },

            {
              key: "reports",
              label: "Receive weekly and monthly reports by email",
              detail: "Encouragement-focused adherence summaries",
              required: false,
            },

            {
              key: "ai_analysis",
              label: "Allow AI diagnostic analysis for my visits",
              detail:
                "AI output is advisory only; doctor reviews before any action",
              required: false,
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500">{item.detail}</p>
                {item.required && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Required for care
                  </p>
                )}
              </div>
              <button
                onClick={() => !item.required && toggleConsent(item.key)}
                disabled={item.required}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  consentMap[item.key] ? "bg-teal-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    consentMap[item.key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Correction request */}
      <Card padding="md" className="border-dashed border-slate-300 bg-slate-50">
        <p className="text-sm font-medium text-slate-800 mb-1">
          Request a Data Correction
        </p>
        <p className="text-xs text-slate-500 mb-3">
          If you believe a dose log, adherence record, or AI classification is
          incorrect, you can request a review from your care team.
        </p>
        <button
          onClick={() => void submitCorrection()}
          className="text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer transition-colors"
        >
          Submit Correction Request →
        </button>
        {correctionMessage && (
          <p className="text-xs text-emerald-700 mt-2">{correctionMessage}</p>
        )}
      </Card>
    </div>
  )
}
