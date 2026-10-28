import { useState, useEffect, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import type { Patient, PipelineStage, AgentLog } from "../../lib/types"
import Card, { CardHeader, CardTitle } from "../../components/ui/Card"
import Badge from "../../components/ui/Badge"
import Button from "../../components/ui/Button"
import ScoreTrendChart from "../../components/charts/ScoreTrendChart"
import { api, isBackendConfigured } from "../../lib/api/apiClient"

/** Canonical 4-Stage Definitions for Closed-Loop Adherence */
const CANONICAL_STAGE_DEFS = [
  {
    key: "reminder_agent",
    name: "Dose Reminder Agent",
    agentName: "reminder_agent",
    description: "Proactive daily reminders delivered at scheduled dose hours",
  },
  {
    key: "pattern_detection_agent",
    name: "Pattern Detection Agent",
    agentName: "pattern_detection_agent",
    description:
      "End-of-day daily evaluation of adherence score, streak, and skips",
  },
  {
    key: "patient_warning_agent",
    name: "Patient Health Warning Agent",
    agentName: "patient_warning_agent",
    description:
      "Level 1: Personalized drug-specific risk advisory sent to patient",
  },
  {
    key: "sos_agent",
    name: "Doctor & Guardian SOS Agent",
    agentName: "sos_agent",
    description:
      "Level 2: Urgent caregiver alert and care-team emergency escalation",
  },
]

export default function CareTeamPage() {
  const { patientId } = useParams()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [escalations, setEscalations] = useState<any[]>([])
  const [careTeam, setCareTeam] = useState<any[]>([])
  const [sparklineData, setSparklineData] = useState<Array<{
    date: string
    value: number
  }>>([])

  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(() =>
    CANONICAL_STAGE_DEFS.map((def, idx) => ({
      id: `stage-${def.key}`,
      name: def.name,
      agentName: def.agentName,
      description: def.description,
      status: idx === 0 ? "complete" : idx === 1 ? "complete" : "idle",
      lastRun: new Date().toISOString(),
      logs: [
        {
          id: `log-init-${def.key}`,
          timestamp: new Date().toISOString(),
          level: "info" as const,
          message: `${def.name} initialized for closed-loop monitoring.`,
        },
      ],
    })),
  )

  const [selectedStageKey, setSelectedStageKey] = useState<string>(
    "pattern_detection_agent",
  )
  const [evaluating, setEvaluating] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionNotes, setActionNotes] = useState("")
  const [activeActionModal, setActiveActionModal] = useState<{
    escId: string
    action: string
    label: string
  } | null>(null)

  const loadData = useCallback(() => {
    if (!patientId) return

    setLoading(true)
    setError("")

    Promise.all([
      api.patients.get(patientId).catch(() => null),
      api.escalations.list(patientId).catch(() => ({ escalations: [] })),
      api.careTeam.list().catch(() => ({ members: [] })),
      api.doctor.getPipeline(patientId).catch(() => null),
      api.patients.getAdherence(patientId).catch(() => null),
    ])
      .then(
        ([
          patientResult,
          escalationsResult,
          careTeamResult,
          pipelineResult,
          adherenceResult,
        ]) => {
          if (patientResult?.patient) {
            setPatient(patientResult.patient)
          }
          if (escalationsResult?.escalations) {
            setEscalations(escalationsResult.escalations)
          }
          if (careTeamResult?.members) {
            setCareTeam(careTeamResult.members)
          }
          if (adherenceResult?.sparklineData) {
            setSparklineData(adherenceResult.sparklineData)
          }

          if (pipelineResult && pipelineResult.stages) {
            const apiStages = pipelineResult.stages
            const mapped: PipelineStage[] = CANONICAL_STAGE_DEFS.map((def) => {
              const match = apiStages.find((s: any) => s.stageKey === def.key)
              if (match) {
                return {
                  id: match.id || `stage-${def.key}`,
                  name: def.name,
                  agentName: match.stageKey,
                  description: def.description,
                  status:
                    match.status === "retrying" ? "running" : match.status,
                  lastRun: match.updatedAt || match.completedAt,
                  logs: (match.logs || []).map((l: any) => ({
                    id: l.id,
                    timestamp: l.createdAt || new Date().toISOString(),
                    level: l.level as "info" | "warn" | "error",
                    message: l.message,
                    metadata:
                      l.metadata as Record<string, string | number | boolean> | undefined,
                  })),
                }
              }
              return {
                id: `stage-${def.key}`,
                name: def.name,
                agentName: def.agentName,
                description: def.description,
                status: "idle",
                logs: [],
              }
            })
            setPipelineStages(mapped)
          }
        },
      )
      .catch(() => setError("Failed to refresh care-team records."))
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Trigger End-of-Day Daily Evaluation
  const handleRunDailyCheck = async (options?: {
    mockConsecutiveSkips?: number
    mockAdherenceRate?: number
  }) => {
    setEvaluating(true)
    setError("")
    setSuccessMessage("")

    try {
      const targetId = patient?.id || patientId || "p-001"
      const result = await api.doctor.evaluateDailyPattern(targetId, {
        force: true,
        ...options,
      })

      if (result.success) {
        let msg = `Daily Evaluation Complete: 7-day adherence is ${result.adherenceScore}%, current streak is ${result.currentStreakDays}d.`
        if (result.level2Triggered) {
          msg = `CRITICAL SOS TRIGGERED: ${result.consecutiveSkips} consecutive skipped days. Urgent alert delivered to caregiver.`
        } else if (result.level1Triggered) {
          msg = `LEVEL 1 ADVISORY: 2 skips detected. Clinical warning delivered to patient.`
        }
        setSuccessMessage(msg)
        loadData()
      }
    } catch (err: any) {
      setError(err?.message || "Failed to execute daily pattern evaluation.")
    } finally {
      setEvaluating(false)
    }
  }

  // Handle 1-Click Clinical Action
  const handleConfirmAction = async () => {
    if (!activeActionModal) return
    const { escId, action } = activeActionModal
    setActionInProgress(escId)
    setError("")

    try {
      await api.doctor.respondToEscalation(
        escId,
        action as "telehealth" | "nurse_call" | "adjust_medication" | "acknowledge",
        actionNotes,
      )

      setSuccessMessage(
        `✓ Clinical action [${action.toUpperCase()}] executed and recorded in audit trail.`,
      )
      setActiveActionModal(null)
      setActionNotes("")
      loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to record clinical action.")
    } finally {
      setActionInProgress(null)
    }
  }

  const stageStatusColor: Record<string, string> = {
    idle: "bg-slate-100 text-slate-600 border border-slate-300",
    running: "bg-cyan-50 text-cyan-700 border border-cyan-300",
    complete: "bg-emerald-50 text-emerald-700 border border-emerald-300",
    error: "bg-rose-50 text-rose-700 border border-rose-300",
  }

  const selectedStage = pipelineStages.find(
    (s) => s.agentName === selectedStageKey,
  ) ||
    pipelineStages[1] ||
    pipelineStages[0] || {
      id: "stage-default",
      name: "Pipeline Stage",
      agentName: "pattern_detection_agent",
      description: "",
      status: "idle" as const,
      logs: [],
    }

  const patientDisplayName =
    patient?.name || (patient as any)?.full_name || "Patient"
  const patientIdDisplay = patient?.patientId || patient?.id || patientId

  return (
    <div className="p-6 max-w-6xl space-y-6 animate-fade-in">
      {/* Header */}
      {loading && (
        <p className="text-sm text-slate-500">Loading care-team data…</p>
      )}
      {error && (
        <div className="text-sm text-rose-800 bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-rose-600 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
      {successMessage && (
        <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between animate-fade-in">
          <span className="font-medium">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-emerald-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/doctor/patients/${patient?.id || patientId}`}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1"
            >
              ← Back to {patientDisplayName}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Care Team Command Center
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Patient ID:{" "}
            <span className="font-mono font-medium text-slate-700">
              {patientIdDisplay}
            </span>{" "}
            · 4-Stage Closed-Loop Adherence Pipeline
          </p>
        </div>

        {/* Daily Evaluation Trigger Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="primary"
            disabled={evaluating}
            onClick={() => handleRunDailyCheck()}
            className="shadow-sm font-semibold flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white"
          >
            {evaluating ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                Evaluating...
              </>
            ) : (
              <>⚡ Run Daily Check Now</>
            )}
          </Button>

          {/* Quick Demo Simulator Buttons */}
          <button
            onClick={() =>
              handleRunDailyCheck({
                mockConsecutiveSkips: 2,
                mockAdherenceRate: 70,
              })
            }
            disabled={evaluating}
            title="Simulate 2 consecutive skips (Level 1 warning)"
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1.5 rounded-lg font-medium transition"
          >
            Simulate 2 Skips (Level 1)
          </button>
          <button
            onClick={() =>
              handleRunDailyCheck({
                mockConsecutiveSkips: 3,
                mockAdherenceRate: 50,
              })
            }
            disabled={evaluating}
            title="Simulate 3 consecutive skips (Level 2 SOS)"
            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1.5 rounded-lg font-medium transition"
          >
            Simulate 3 Skips (SOS)
          </button>
        </div>
      </div>

      {/* Escalation Banners (including Level 2 Urgent Red SOS Alert) */}
      {escalations.map((esc) => {
        const isUrgentOrCritical =
          esc.severity === "urgent" || esc.severity === "critical"
        const isOpen = esc.status === "open"

        return (
          <div
            key={esc.id}
            className={`rounded-2xl border-2 p-5 transition-all shadow-sm animate-slide-in-up ${
              isUrgentOrCritical
                ? "bg-rose-50/80 border-rose-300"
                : esc.severity === "concerning" || esc.severity === "high"
                  ? "bg-amber-50/80 border-amber-300"
                  : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                    isUrgentOrCritical
                      ? "bg-rose-600 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width={22}
                    height={22}
                  >
                    <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`font-bold text-sm tracking-wide ${
                        isUrgentOrCritical ? "text-rose-900" : "text-amber-900"
                      }`}
                    >
                      {isUrgentOrCritical
                        ? "🚨 CRITICAL ADHERENCE FAILURE (LEVEL 2 SOS)"
                        : `AI CLINICAL ESCALATION — ${esc.severity?.toUpperCase()}`}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                        isOpen
                          ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {esc.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {esc.reasoning ||
                      esc.rootCause ||
                      "Severe adherence anomaly detected requiring doctor evaluation."}
                  </p>

                  {/* Guardian Emergency Contact Display for SOS */}
                  {((patient as any)?.guardian_name ||
                    (patient as any)?.guardian_email) && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-white/80 border border-rose-200 text-xs text-rose-950 flex items-center gap-2">
                      <span className="font-semibold text-rose-700">
                        Emergency Guardian:
                      </span>
                      <span>
                        {(patient as any)?.guardian_name || "Primary Caregiver"}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-rose-800 font-medium">
                        {(patient as any)?.guardian_email}
                      </span>
                      {(patient as any)?.guardian_phone && (
                        <>
                          <span>·</span>
                          <span>{(patient as any)?.guardian_phone}</span>
                        </>
                      )}
                      <span className="ml-auto text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold">
                        Alert Dispatched
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-500 flex-wrap">
                    <span>
                      Confidence:{" "}
                      <strong>
                        {Math.round((esc.confidence || 0.95) * 100)}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Model:{" "}
                      <strong className="font-mono">
                        {esc.modelVersion || esc.aiModelVersion || "mednova-v1"}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(
                        esc.createdAt || esc.created_at || Date.now(),
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1-Click Doctor Clinical Action Buttons */}
              {isOpen && (
                <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 mt-2 sm:mt-0">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={actionInProgress === esc.id}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs"
                    onClick={() =>
                      setActiveActionModal({
                        escId: esc.id,
                        action: "telehealth",
                        label: "Schedule Urgent Telehealth Consultation",
                      })
                    }
                  >
                    📞 Telehealth
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionInProgress === esc.id}
                    className="text-xs font-medium"
                    onClick={() =>
                      setActiveActionModal({
                        escId: esc.id,
                        action: "nurse_call",
                        label: "Assign Nurse Outreach",
                      })
                    }
                  >
                    👩‍⚕️ Nurse Outreach
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionInProgress === esc.id}
                    className="text-xs font-medium"
                    onClick={() =>
                      setActiveActionModal({
                        escId: esc.id,
                        action: "adjust_medication",
                        label: "Adjust Patient Prescriptions",
                      })
                    }
                  >
                    💊 Adjust Meds
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionInProgress === esc.id}
                    className="text-xs text-slate-600 hover:text-slate-900"
                    onClick={() =>
                      setActiveActionModal({
                        escId: esc.id,
                        action: "acknowledge",
                        label: "Acknowledge Escalation",
                      })
                    }
                  >
                    ✓ Acknowledge
                  </Button>
                </div>
              )}

              {!isOpen && (
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Clinical Action Logged ({esc.status})</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* 4-Tier Closed-Loop Adherence Pipeline Stepper */}
      <Card padding="md" className="border-slate-200 shadow-sm">
        <CardHeader>
          <div>
            <CardTitle>4-Tier Closed-Loop Adherence Pipeline</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Event-driven proactive monitoring, daily pattern detection, and
              autonomous tiered safety escalations
            </p>
          </div>
          <Badge variant="ai">Autonomous Multi-Agent Workflow</Badge>
        </CardHeader>

        {/* 4 Stages Visual Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4">
          {CANONICAL_STAGE_DEFS.map((def, idx) => {
            const currentStage: PipelineStage = pipelineStages.find(
              (s) => s.agentName === def.key,
            ) || {
              id: def.key,
              name: def.name,
              agentName: def.agentName,
              description: def.description,
              status: idx <= 1 ? "complete" : "idle",
              lastRun: undefined,
              logs: [],
            }
            const isSelected = selectedStageKey === def.key

            return (
              <div
                key={def.key}
                onClick={() => setSelectedStageKey(def.key)}
                className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-teal-500 bg-teal-50/40 shadow-sm ring-1 ring-teal-500/30"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        stageStatusColor[currentStage.status] ||
                        stageStatusColor.idle
                      }`}
                    >
                      {currentStage.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {def.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {def.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{(currentStage.logs || []).length} logs</span>
                  {currentStage.lastRun && (
                    <span>
                      {new Date(currentStage.lastRun).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Live Dark Terminal Console for Selected Stage */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Live Terminal Console: {selectedStage.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-mono text-slate-400">
                [{selectedStage.agentName}]
              </span>
              <span>·</span>
              <span>{(selectedStage.logs || []).length} recorded entries</span>
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs shadow-inner border border-slate-800 max-h-60 overflow-y-auto space-y-2">
            {(!selectedStage.logs || selectedStage.logs.length === 0) && (
              <p className="text-slate-600 italic">
                No stage execution logs available yet.
              </p>
            )}

            {(selectedStage.logs || []).map((log: AgentLog) => (
              <div
                key={log.id}
                className={`flex items-start gap-2.5 leading-relaxed ${
                  log.level === "error"
                    ? "text-rose-400"
                    : log.level === "warn"
                      ? "text-amber-300"
                      : "text-slate-300"
                }`}
              >
                <span className="text-slate-600 flex-shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase flex-shrink-0 px-1 py-0.2 rounded ${
                    log.level === "error"
                      ? "bg-rose-950/80 text-rose-400 border border-rose-800"
                      : log.level === "warn"
                        ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                        : "bg-slate-900 text-teal-400 border border-teal-800/60"
                  }`}
                >
                  [{log.level}]
                </span>
                <div className="flex-1">
                  <span>{log.message}</span>
                  {log.metadata && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Adherence Trend & Care Team Grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card padding="md">
          <CardHeader>
            <CardTitle>Adherence Reliability Trend</CardTitle>
          </CardHeader>
          <ScoreTrendChart data={sparklineData} height={160} />
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>Assigned Care Team</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {careTeam.map((m: any) => {
              const memberName =
                m.name || m.full_name || m.email || "Care Team Member"
              const initials =
                memberName
                  .split(" ")
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "CM"

              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-bold text-xs flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {memberName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.role || "Care Team"}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Action Notes Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {activeActionModal.label}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter clinical rationale or notes to be recorded in the patient
              audit trail.
            </p>

            <textarea
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. Discussed skipped doses with patient. Scheduled review for tomorrow 10:00 AM."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2.5 mt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveActionModal(null)
                  setActionNotes("")
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                onClick={handleConfirmAction}
              >
                Confirm Action
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
