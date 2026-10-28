import { useEffect, useState } from "react"

import { useParams, useNavigate, Link } from "react-router-dom"

import type {
  AIAnalysis,
  AIPrescriptionSuggestion,
  Medication,
  Patient,
  PatientAdherenceSummary,
  PatientUploadedReport,
  Prescription,
  RagAnalysisResponse,
  Visit,
} from "../../lib/types"

import {
  formatFileSize,
  getPatientUploadedReports,
  markPatientReportReviewed,
  REPORT_CATEGORY_LABELS,
  REPORT_INDEXING_LABELS,
  setPatientReportIndexingStatus,
} from "../../lib/patientReports"

import { getRagService } from "../../lib/rag"

import {
  api,
  isBackendConfigured,
  normalizePatient,
} from "../../lib/api/apiClient"

import Card, { CardHeader, CardTitle } from "../../components/ui/Card"

import Badge from "../../components/ui/Badge"

import Button from "../../components/ui/Button"

import StatusPill from "../../components/ui/StatusPill"

import TrustBadge from "../../components/ui/TrustBadge"

import DoseHeatmap from "../../components/charts/DoseHeatmap"

import AdherenceRing from "../../components/charts/AdherenceRing"

import ScoreTrendChart from "../../components/charts/ScoreTrendChart"

import RagAssistantPanel from "../../components/doctor/rag/RagAssistantPanel"

import PrescriptionSuggestionCard from "../../components/doctor/rag/PrescriptionSuggestionCard"

import EditablePrescriptionCard, {
  type EditableMedicationField,
} from "../../components/doctor/EditablePrescriptionCard"

const TABS = [
  "Overview",
  "Visits",
  "Adherence",
  "Reports",
  "AI Assistant",
  "Prescription",
]

export default function PatientPage() {
  const { patientId } = useParams()

  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState("Overview")

  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)

  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null)

  const [ragResponse, setRagResponse] = useState<RagAnalysisResponse | null>(
    null,
  )

  const [showConfirm, setShowConfirm] = useState(false)

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])

  const [editingPrescriptionId, setEditingPrescriptionId] =
    useState<string | null>(null)

  const [prescriptionDraft, setPrescriptionDraft] = useState<Medication | null>(
    null,
  )

  const [prescriptionReason, setPrescriptionReason] = useState("")

  const [prescriptionEditError, setPrescriptionEditError] = useState("")

  const [pendingChanges, setPendingChanges] = useState<Record<string, {
    from: string | number
    to: string | number
  }>>({})

  // AI prescription suggestion state

  const [editedMeds, setEditedMeds] = useState<AIPrescriptionSuggestion[]>([])

  const [expandedMedCitation, setExpandedMedCitation] =
    useState<Record<number, boolean>>({})

  const [showApprovePreview, setShowApprovePreview] = useState(false)

  const [approveToast, setApproveToast] = useState(false)

  const [justApprovedIds, setJustApprovedIds] = useState<Set<string>>(new Set())

  const [patient, setPatient] = useState<Patient | null>(null)

  const [visits, setVisits] = useState<Visit[]>([])

  const [patientReports, setPatientReports] = useState<PatientUploadedReport[]>(
    [],
  )

  const [adherence, setAdherence] = useState<PatientAdherenceSummary | null>(
    null,
  )

  const [escalation, setEscalation] = useState<any>(null)

  const [careTeam, setCareTeam] = useState<Array<{
    id: string
    name: string
    role: string
    email?: string
  }>>([])

  const [loadingData, setLoadingData] = useState(true)

  const [dataError, setDataError] = useState("")

  const [reindexingReportId, setReindexingReportId] = useState<string | null>(
    null,
  )
  const [resendingInvite, setResendingInvite] = useState(false)
  const [inviteBanner, setInviteBanner] = useState<string | null>(null)

  useEffect(() => {
    if (!isBackendConfigured() || !patientId) return

    setLoadingData(true)

    setDataError("")

    Promise.allSettled([
      api.patients.get(patientId),

      api.patients.getVisits(patientId),

      api.reports.list(patientId),

      api.patients.getPrescriptions(patientId),

      api.patients.getAdherence(patientId),

      api.escalations.list(patientId),

      api.careTeam.list(),
    ])
      .then(
        ([
          patientRes,
          visitsRes,
          reportsRes,
          prescriptionsRes,
          adherenceRes,
          escalationsRes,
          careTeamRes,
        ]) => {
          let patientLoaded = false

          if (patientRes.status === "fulfilled" && patientRes.value?.patient) {
            setPatient(patientRes.value.patient)

            patientLoaded = true
          }

          if (
            visitsRes.status === "fulfilled" &&
            Array.isArray(visitsRes.value?.visits)
          ) {
            setVisits(visitsRes.value.visits)
          }

          if (
            reportsRes.status === "fulfilled" &&
            Array.isArray(reportsRes.value?.reports)
          ) {
            setPatientReports(
              reportsRes.value.reports as PatientUploadedReport[],
            )
          }

          if (
            prescriptionsRes.status === "fulfilled" &&
            Array.isArray(prescriptionsRes.value?.prescriptions)
          ) {
            setPrescriptions(
              prescriptionsRes.value.prescriptions as Prescription[],
            )
          }

          if (adherenceRes.status === "fulfilled" && adherenceRes.value) {
            setAdherence(adherenceRes.value)
          }

          if (
            escalationsRes.status === "fulfilled" &&
            escalationsRes.value?.escalations?.length > 0
          ) {
            setEscalation(escalationsRes.value.escalations[0])
          }

          if (
            careTeamRes.status === "fulfilled" &&
            careTeamRes.value?.members?.length > 0
          ) {
            setCareTeam(careTeamRes.value.members)
          }

          if (!patientLoaded) {
            const errorReason =
              patientRes.status === "rejected"
                ? patientRes.reason?.message || ""
                : ""

            setDataError(
              errorReason ||
                "Patient record could not be loaded. Please verify your doctor assignment or retry.",
            )
          }
        },
      )
      .catch((err) => {
        setDataError(
          err?.message || "Patient data could not be loaded. Retry to refresh.",
        )
      })
      .finally(() => {
        setLoadingData(false)
      })
  }, [patientId])

  useEffect(() => {
    setRagResponse(null)

    setAiResult(null)

    setEditedMeds([])

    setExpandedMedCitation({})
  }, [patient?.id])

  const handleMedFieldChange = (
    idx: number,
    field: keyof AIPrescriptionSuggestion,
    value: string | number,
  ) => {
    setEditedMeds((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    )
  }

  const [approving, setApproving] = useState(false)

  const [approveError, setApproveError] = useState("")

  const handleConfirmApprove = async () => {
    if (!patient) return

    setShowApprovePreview(false)

    setApproving(true)

    setApproveError("")

    const approvedAt = new Date()

    if (isBackendConfigured()) {
      try {
        const approvedList: Prescription[] = []

        const createdVisits: Visit[] = []

        for (let index = 0; index < editedMeds.length; index++) {
          const medication = editedMeds[index]

          const idempotencyKey = `idem-${patient.id}-${Date.now()}-${index}`

          const res = await api.prescriptions.approve(
            (medication as any).prescriptionId ||
              `rx-ai-${patient.id}-${index}`,

            {
              patientId: patient.id,

              idempotencyKey,

              suggestion: medication,

              editedValues: {
                name: medication.name,

                dosage: medication.strength,

                frequency: medication.frequency,

                quantity: medication.quantity,

                days: medication.days,

                instructions: medication.instructions,
              },

              reason: "Doctor approved AI suggestion",

              visit: {
                condition:
                  aiResult?.hypothesis ||
                  patient.conditions?.[0] ||
                  `Prescription: ${medication.name}`,

                symptoms:
                  patient.conditions && patient.conditions.length > 0
                    ? patient.conditions
                    : [medication.name],

                notes:
                  `Clinical evaluation and medication review. Doctor approved ${medication.name} ${medication.strength} (${medication.frequency}). ${medication.reasoning || ""}`.trim(),

                proposedSolution:
                  `Initiated ${medication.name} ${medication.strength} (${medication.frequency}) for ${medication.days} days. ${medication.instructions || ""}`.trim(),

                outcome:
                  "Prescription approved and dose schedule generated. Active adherence monitoring initiated.",
              },
            },
          )

          if (res.prescription) {
            approvedList.push(res.prescription)
          }

          if (res.visit) {
            createdVisits.push(res.visit)
          }
        }

        setPrescriptions((previous) => [...approvedList, ...previous])

        if (createdVisits.length > 0) {
          setVisits((prev) => [
            ...createdVisits,
            ...prev.filter((v) => !createdVisits.some((cv) => cv.id === v.id)),
          ])
        }

        setPatient((prev: Patient | null) =>
          prev
            ? { ...prev, lastVisit: approvedAt.toISOString().slice(0, 10) }
            : prev,
        )

        const newIds = new Set(editedMeds.map((m) => m.name))

        setJustApprovedIds(newIds)

        setApproveToast(true)

        setTimeout(() => setApproveToast(false), 4000)

        setTimeout(() => setJustApprovedIds(new Set()), 3500)

        setActiveTab("Prescription")

        // Background sync to ensure full joined DB records

        void api.patients.getPrescriptions(patient.id).then((fresh) => {
          if (
            Array.isArray(fresh?.prescriptions) &&
            fresh.prescriptions.length > 0
          ) {
            setPrescriptions(fresh.prescriptions as Prescription[])
          }
        })

        void api.patients.getVisits(patient.id).then((fresh) => {
          if (Array.isArray(fresh?.visits) && fresh.visits.length > 0) {
            setVisits(fresh.visits)
          }
        })
      } catch (err: any) {
        // Clinical safety: failed approval leaves local prescriptions unchanged!

        setApproveError(
          err?.message ||
            "Failed to approve prescription on server. Please try again.",
        )
      } finally {
        setApproving(false)
      }

      return
    }

    // Development demo mode simulation

    const newPrescriptions: Prescription[] = editedMeds.map(
      (medication, index) => {
        const endDate = new Date(approvedAt)

        endDate.setDate(endDate.getDate() + medication.days)

        return {
          id: `rx-ai-${approvedAt.getTime()}-${index}`,

          status: "active",

          suggestedBy: "ai",

          approvedBy: "Dr. Jeya Shankar M",

          approvedAt: approvedAt.toISOString(),

          citations: medication.citations,

          revisions: [],

          medication: {
            id: `med-ai-${approvedAt.getTime()}-${index}`,

            name: medication.name,

            genericName: medication.genericName,

            strength: medication.strength,

            unit: medication.unit,

            frequency: medication.frequency,

            quantity: medication.quantity,

            duration: `${medication.days} days`,

            instructions: medication.instructions,

            startDate: approvedAt.toISOString().slice(0, 10),

            endDate: endDate.toISOString().slice(0, 10),

            status: "active",

            prescribedBy: "Dr. Jeya Shankar M",
          },
        }
      },
    )

    const newDemoVisits: Visit[] = editedMeds.map((medication, index) => ({
      id: `v-demo-${approvedAt.getTime()}-${index}`,

      patientId: patient.id,

      date: approvedAt.toISOString().slice(0, 10),

      condition:
        aiResult?.hypothesis ||
        patient.conditions?.[0] ||
        `Prescription: ${medication.name}`,

      symptoms:
        patient.conditions && patient.conditions.length > 0
          ? patient.conditions
          : [medication.name],

      notes:
        `Clinical evaluation and prescribing. Doctor approved ${medication.name} ${medication.strength} (${medication.frequency}). ${medication.reasoning || ""}`.trim(),

      proposedSolution:
        `Initiated ${medication.name} ${medication.strength} (${medication.frequency}) for ${medication.days} days. ${medication.instructions || ""}`.trim(),

      outcome:
        "Prescription approved and dose schedule generated. Active adherence monitoring initiated.",

      doctor: "Dr. Jeya Shankar M",

      prescriptionId: `rx-ai-${approvedAt.getTime()}-${index}`,
    }))

    setPrescriptions((previous) => [...newPrescriptions, ...previous])

    setVisits((previous) => [...newDemoVisits, ...previous])

    setPatient((prev: Patient | null) =>
      prev
        ? { ...prev, lastVisit: approvedAt.toISOString().slice(0, 10) }
        : prev,
    )

    const newIds = new Set(editedMeds.map((m) => m.name))

    setJustApprovedIds(newIds)

    sessionStorage.setItem("pipeline_triggered", "true")

    setApproveToast(true)

    setTimeout(() => setApproveToast(false), 4000)

    setTimeout(() => setJustApprovedIds(new Set()), 3500)

    setActiveTab("Prescription")

    setApproving(false)
  }

  const handleStartPrescriptionEdit = (prescription: Prescription) => {
    setEditingPrescriptionId(prescription.id)

    setPrescriptionDraft({ ...prescription.medication })

    setPrescriptionReason("")

    setPrescriptionEditError("")

    setPendingChanges({})
  }

  const handleCancelPrescriptionEdit = () => {
    setEditingPrescriptionId(null)

    setPrescriptionDraft(null)

    setPrescriptionReason("")

    setPrescriptionEditError("")

    setPendingChanges({})

    setShowConfirm(false)
  }

  const handlePrescriptionDraftChange = (
    field: EditableMedicationField,

    value: string | number,
  ) => {
    setPrescriptionDraft((previous) =>
      previous ? { ...previous, [field]: value } : previous,
    )

    setPrescriptionEditError("")
  }

  const handleReviewPrescriptionChanges = () => {
    const original = prescriptions.find(
      (prescription) => prescription.id === editingPrescriptionId,
    )

    if (!original || !prescriptionDraft) return

    if (
      !prescriptionDraft.name.trim() ||
      !prescriptionDraft.genericName.trim() ||
      !prescriptionDraft.strength.trim() ||
      !prescriptionDraft.unit.trim() ||
      !prescriptionDraft.frequency.trim() ||
      prescriptionDraft.quantity < 1 ||
      !prescriptionDraft.duration.trim() ||
      !prescriptionDraft.instructions.trim()
    ) {
      setPrescriptionEditError(
        "Complete every prescription field before continuing.",
      )

      return
    }

    if (!prescriptionReason.trim()) {
      setPrescriptionEditError(
        "Document a reason for this prescription change.",
      )

      return
    }

    const fields: EditableMedicationField[] = [
      "name",

      "genericName",

      "strength",

      "unit",

      "frequency",

      "quantity",

      "duration",

      "instructions",
    ]

    const changes = fields.reduce<Record<string, {
      from: string | number
      to: string | number
    }>>(
      (result, field) => {
        if (original.medication[field] !== prescriptionDraft[field]) {
          result[field] = {
            from: original.medication[field],

            to: prescriptionDraft[field],
          }
        }

        return result
      },

      {},
    )

    if (Object.keys(changes).length === 0) {
      setPrescriptionEditError(
        "Change at least one prescription field before continuing.",
      )

      return
    }

    setPendingChanges(changes)

    setShowConfirm(true)
  }

  const handleConfirmPrescriptionChanges = async () => {
    if (!editingPrescriptionId || !prescriptionDraft) return

    if (isBackendConfigured()) {
      try {
        const result = await api.prescriptions.approve(editingPrescriptionId, {
          medication: prescriptionDraft as unknown as Record<string, unknown>,

          reason: prescriptionReason.trim(),
        })

        setPrescriptions((previous) =>
          previous.map((prescription) =>
            prescription.id === editingPrescriptionId
              ? result.prescription as Prescription
              : prescription,
          ),
        )
      } catch {
        setDataError("Prescription approval could not be saved.")

        return
      }

      handleCancelPrescriptionEdit()

      return
    }

    const changedAt = new Date().toISOString()

    setPrescriptions((previous) =>
      previous.map((prescription) =>
        prescription.id === editingPrescriptionId
          ? {
              ...prescription,

              medication: { ...prescriptionDraft },

              revisions: [
                ...prescription.revisions,

                {
                  id: `revision-${Date.now()}`,

                  changedBy: "Dr. Jeya Shankar M",

                  changedAt,

                  changes: pendingChanges,

                  reason: prescriptionReason.trim(),
                },
              ],
            }
          : prescription,
      ),
    )

    handleCancelPrescriptionEdit()
  }

  const handleViewReport = async (report: PatientUploadedReport) => {
    try {
      const url = isBackendConfigured()
        ? (await api.reports.getViewUrl(report.id)).signedUrl
        : report.fileDataUrl

      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } catch {
      setDataError("This report could not be opened.")
    }
  }

  const handleMarkReportReviewed = async (reportId: string) => {
    if (isBackendConfigured()) {
      try {
        const { report } = await api.reports.review(reportId)

        setPatientReports((current) =>
          current.map((item) =>
            item.id === reportId ? report as PatientUploadedReport : item,
          ),
        )
      } catch {
        setDataError("Report review could not be saved.")
      }

      return
    }

    const activePid = patient?.id || patientId

    const reports = markPatientReportReviewed(reportId)

    setPatientReports(
      reports.filter((report) => report.patientId === activePid),
    )
  }

  const handleRetryReportIndexing = async (reportId: string) => {
    const activePid = patient?.id || patientId

    setReindexingReportId(reportId)

    try {
      await getRagService().reindexReport(reportId)

      if (isBackendConfigured()) {
        setPatientReports((current) =>
          current.map((item) =>
            item.id === reportId
              ? {
                  ...item,
                  indexingStatus: "indexing",
                  indexingError: undefined,
                }
              : item,
          ),
        )
      } else {
        const reports = setPatientReportIndexingStatus(reportId, "indexing")

        setPatientReports(
          reports.filter((report) => report.patientId === activePid),
        )
      }
    } catch {
      if (isBackendConfigured()) {
        setPatientReports((current) =>
          current.map((item) =>
            item.id === reportId
              ? {
                  ...item,

                  indexingStatus: "failed",

                  indexingError: "Indexing retry could not be started.",
                }
              : item,
          ),
        )
      } else {
        const reports = setPatientReportIndexingStatus(
          reportId,

          "failed",

          "Indexing retry could not be started.",
        )

        setPatientReports(
          reports.filter((report) => report.patientId === activePid),
        )
      }
    } finally {
      setReindexingReportId(null)
    }
  }

  const handleTabChange = (tab: string) => {
    if (tab === "Reports") {
      const activePid = patientId || patient?.id || ""

      if (isBackendConfigured() && activePid) {
        api.reports

          .list(activePid)

          .then(({ reports }) =>
            setPatientReports(reports as PatientUploadedReport[]),
          )

          .catch(() => setDataError("Failed to refresh reports"))
      } else if (activePid) {
        setPatientReports(getPatientUploadedReports(activePid))
      }
    }

    setActiveTab(tab)
  }

  if (loadingData && !patient) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        <span className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full inline-block animate-spin mr-2" />
        Loading patient record…
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        <p className="font-semibold text-slate-700">Patient not found</p>
        <p className="text-xs text-slate-400 mt-1">
          {dataError || "Unable to locate patient profile."}
        </p>
        <Button className="mt-4" size="sm" onClick={() => navigate("/doctor")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const handleResendInvite = async () => {
    if (!patient?.id) return
    setResendingInvite(true)
    try {
      const res = await api.patients.resendInvite(patient.id)
      setInviteBanner(res.message || "Activation email sent successfully.")
      setTimeout(() => setInviteBanner(null), 6000)
    } catch (err: any) {
      alert(err?.message || "Failed to resend invitation email.")
    } finally {
      setResendingInvite(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {inviteBanner && (
        <div className="mx-6 mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
          <span>✅ {inviteBanner}</span>
          <button
            onClick={() => setInviteBanner(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
      {loadingData && (
        <div className="mx-6 mt-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
          Loading patient data…
        </div>
      )}
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {dataError}
        </div>
      )}
      {/* Patient header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg flex-shrink-0">
              {patient.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {patient.name}
                </h1>
                <span className="text-sm font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {patient.patientId}
                </span>
                <StatusPill status={patient.status} />
                {patient.hasEscalation && (
                  <Badge variant="error" dot>
                    Escalation Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                <span>
                  {patient.age}y · {patient.gender}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{patient.conditions.join(" · ")}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>Last visit {patient.lastVisit}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {patient.status !== "active" && (
              <Button
                variant="outline"
                size="sm"
                loading={resendingInvite}
                onClick={handleResendInvite}
              >
                Resend Activation Link
              </Button>
            )}
            <TrustBadge
              score={adherence?.score ?? patient.adherenceScore}
              trend={adherence?.trend ?? patient.trend}
              size="md"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/doctor/patients/${patient.id}/care-team`)
              }
            >
              Care Team View
            </Button>
          </div>
        </div>

        {/* Care team chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-slate-400">Care team:</span>
          {careTeam.length > 0 ? (
            careTeam.map((m) => (
              <span
                key={m.id}
                className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200"
              >
                {m.name} · <span className="text-slate-400">{m.role}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">
              No care team members assigned
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 -mb-5 border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 space-y-5 max-w-5xl">
        {/* OVERVIEW TAB */}
        {activeTab === "Overview" && (
          <div className="grid lg:grid-cols-3 gap-5 animate-fade-in">
            {/* Adherence summary */}
            <Card padding="md">
              <CardHeader>
                <CardTitle>Adherence Score</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-4">
                <AdherenceRing
                  score={adherence?.score ?? patient.adherenceScore}
                  size={100}
                />
                <div className="space-y-2 text-sm">
                  {[
                    {
                      label: "Taken",

                      count: adherence ? adherence.takenCount : 0,

                      color: "text-emerald-600",
                    },

                    {
                      label: "Missed",

                      count: adherence ? adherence.missedCount : 0,

                      color: "text-rose-600",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-6"
                    >
                      <span className="text-slate-500">{s.label}</span>
                      <span className={`font-semibold ${s.color}`}>
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Current medications */}
            <Card padding="md">
              <CardHeader>
                <CardTitle>Active Medications</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {prescriptions
                  .filter((prescription) => prescription.status === "active")
                  .map((rx) => (
                    <div key={rx.id} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {rx.medication.name} {rx.medication.strength}
                          {rx.medication.unit}
                        </div>
                        <div className="text-xs text-slate-400">
                          {rx.medication.frequency}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Patient demographics */}
            <Card padding="md">
              <CardHeader>
                <CardTitle>Demographics</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Date of Birth", value: patient.dob },

                  { label: "Phone", value: patient.phone },

                  { label: "Email", value: patient.email },

                  { label: "Address", value: patient.address },
                ].map((item) => (
                  <div key={item.label}>
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <p className="text-slate-700 text-xs mt-0.5">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Score trend */}
            <div className="lg:col-span-3">
              <Card padding="md">
                <CardHeader>
                  <CardTitle>Adherence Score Trend (3 months)</CardTitle>
                  <Badge
                    variant={
                      adherence?.trend === "up"
                        ? "success"
                        : adherence?.trend === "down"
                          ? "error"
                          : "default"
                    }
                  >
                    {adherence?.trend === "up"
                      ? "Improving"
                      : adherence?.trend === "down"
                        ? "Declining"
                        : "Stable"}{" "}
                    trend
                  </Badge>
                </CardHeader>
                <ScoreTrendChart
                  data={adherence?.sparklineData || []}
                  height={200}
                />
              </Card>
            </div>
          </div>
        )}

        {/* VISITS TAB */}
        {activeTab === "Visits" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Visit Timeline
              </h2>
              <Badge variant="default">{visits.length} visits</Badge>
            </div>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

              <div className="space-y-3">
                {visits.map((visit, i) => (
                  <div
                    key={visit.id}
                    className="relative pl-14 animate-slide-in-up"
                    style={
                      { animationDelay: `${i * 80}ms` } as React.CSSProperties
                    }
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 z-10 ${
                        i === 0
                          ? "bg-teal-500 border-teal-500"
                          : "bg-white border-slate-300"
                      }`}
                    />

                    <Card
                      hover
                      onClick={() =>
                        setExpandedVisit(
                          expandedVisit === visit.id ? null : visit.id,
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-slate-400">
                              {visit.date}
                            </span>
                            {i === 0 && (
                              <Badge variant="success" size="sm">
                                Latest
                              </Badge>
                            )}
                            {(visit.prescriptionId ||
                              visit.proposedSolution
                                ?.toLowerCase()
                                .includes("prescrib") ||
                              visit.proposedSolution
                                ?.toLowerCase()
                                .includes("initiat")) && (
                              <Badge variant="ai" size="sm">
                                💊 Prescription Encounter
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
                            {visit.condition}
                          </h3>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {(visit.symptoms ?? []).map((s) => (
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
                          className={`text-slate-400 transition-transform flex-shrink-0 mt-1 ${
                            expandedVisit === visit.id ? "rotate-180" : ""
                          }`}
                        >
                          <path
                            d="M19 9l-7 7-7-7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {expandedVisit === visit.id && (
                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 animate-fade-in">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                              Clinical Notes
                            </p>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {visit.notes}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                              Proposed Solution
                            </p>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {visit.proposedSolution}
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
                          {visit.relatedVisits &&
                            visit.relatedVisits.length > 0 && (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  width={12}
                                  height={12}
                                >
                                  <path
                                    d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                                    strokeLinecap="round"
                                  />
                                </svg>
                                Related visits: {visit.relatedVisits.join(", ")}
                              </div>
                            )}
                        </div>
                      )}
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ADHERENCE TAB */}
        {activeTab === "Adherence" && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  label: "Taken",

                  value: adherence ? adherence.takenCount : 0,

                  color: "emerald",
                },

                {
                  label: "Missed",

                  value: adherence ? adherence.missedCount : 0,

                  color: "rose",
                },
              ].map((s) => (
                <Card key={s.label} padding="md">
                  <div
                    className={`text-2xl font-bold text-${s.color}-600 mb-0.5`}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Last 90 days
                  </div>
                </Card>
              ))}
            </div>

            <Card padding="md">
              <CardHeader>
                <CardTitle>90-Day Dose Heatmap</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width={12}
                    height={12}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Binary dose logs: Taken vs. Missed
                </div>
              </CardHeader>
              <DoseHeatmap data={adherence?.heatmapData || []} />
            </Card>

            <Card padding="md">
              <CardHeader>
                <CardTitle>AI Root-Cause Classification</CardTitle>
                <Badge variant="ai">
                  <svg
                    viewBox="0 0 24 24"
                    className="fill-cyan-600"
                    width={10}
                    height={10}
                  >
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                  </svg>
                  Pattern Detection Agent
                </Badge>
              </CardHeader>
              {escalation ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${
                        escalation.severity === "urgent"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : escalation.severity === "concerning"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      Severity: {escalation.severity}
                    </div>
                    <div className="text-sm text-slate-600">
                      Confidence:{" "}
                      <span className="font-semibold text-slate-900">
                        {Math.round((escalation.confidence ?? 0.85) * 100)}%
                      </span>
                    </div>
                    <Badge variant="default">
                      {escalation.rootCause || "Adherence Anomaly"}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      AI Explanation
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {escalation.explanation ||
                        "Closed-loop monitoring detected skipped doses."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                    <svg
                      viewBox="0 0 24 24"
                      className="fill-amber-500 flex-shrink-0"
                      width={12}
                      height={12}
                    >
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                    AI output requires doctor review before clinical action.
                    Model:{" "}
                    {escalation.aiModelVersion ||
                      escalation.modelVersion ||
                      "MedNova Pattern Agent"}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-sm text-slate-500 border border-slate-100">
                  No active clinical escalation. Patient adherence is within
                  monitored thresholds.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* PATIENT-UPLOADED REPORTS TAB */}
        {activeTab === "Reports" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Patient-Uploaded Reports
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Medical documents shared directly by {patient.name}.
                </p>
              </div>
              <Badge
                variant={
                  patientReports.some((report) => report.status === "shared")
                    ? "warning"
                    : "default"
                }
              >
                {
                  patientReports.filter((report) => report.status === "shared")
                    .length
                }{" "}
                awaiting review
              </Badge>
            </div>

            {patientReports.length === 0 ? (
              <Card
                padding="lg"
                className="border-dashed border-slate-200 bg-slate-50 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width={20}
                    height={20}
                  >
                    <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                    <path d="M14 3v5h5M10 13h5M10 17h5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  No patient-uploaded reports
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Reports uploaded from the patient portal will appear here.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {patientReports.map((report) => (
                  <Card
                    key={report.id}
                    padding="md"
                    className={
                      report.status === "shared"
                        ? "border-cyan-200 bg-cyan-50/30"
                        : ""
                    }
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width={20}
                            height={20}
                          >
                            <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                            <path
                              d="M14 3v5h5M10 13h5M10 17h5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {report.title}
                            </h3>
                            <Badge
                              variant={
                                report.status === "reviewed"
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {report.status === "reviewed"
                                ? "Reviewed"
                                : "New patient upload"}
                            </Badge>
                            <Badge
                              variant={
                                report.indexingStatus === "ready"
                                  ? "success"
                                  : report.indexingStatus === "failed"
                                    ? "error"
                                    : report.indexingStatus === "indexing"
                                      ? "warning"
                                      : "default"
                              }
                            >
                              {
                                REPORT_INDEXING_LABELS[
                                  report.indexingStatus ?? "not_indexed"
                                ]
                              }
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {REPORT_CATEGORY_LABELS[report.category]} · Report
                            date{" "}
                            {new Date(
                              `${report.reportDate}T00:00:00`,
                            ).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Uploaded{" "}
                            {new Date(report.uploadedAt).toLocaleString()} ·{" "}
                            {report.fileName} ·{" "}
                            {formatFileSize(report.fileSize)}
                          </p>
                          {report.indexingStatus === "failed" &&
                            report.indexingError && (
                              <p className="text-xs text-rose-600 mt-1">
                                {report.indexingError}
                              </p>
                            )}
                          {report.note && (
                            <div className="mt-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                              <p className="text-xs font-semibold text-slate-500 mb-1">
                                Patient note
                              </p>
                              <p className="text-sm text-slate-700">
                                {report.note}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewReport(report)}
                        >
                          View Report
                        </Button>
                        {report.status !== "reviewed" && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleMarkReportReviewed(report.id)}
                          >
                            Mark as Reviewed
                          </Button>
                        )}
                        {report.indexingStatus === "failed" && (
                          <Button
                            size="sm"
                            loading={reindexingReportId === report.id}
                            onClick={() =>
                              void handleRetryReportIndexing(report.id)
                            }
                          >
                            Retry Indexing
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Patient-uploaded documents must be clinically verified before
              being used for treatment decisions.
            </div>
          </div>
        )}

        {/* AI ASSISTANT TAB */}
        {activeTab === "AI Assistant" && (
          <div className="space-y-5 animate-fade-in">
            <RagAssistantPanel
              patientId={patient.id}
              patientContext={[
                ...patient.conditions,

                ...prescriptions

                  .filter((prescription) => prescription.status === "active")

                  .slice(0, 2)

                  .map(
                    (prescription) =>
                      `${prescription.medication.name} ${prescription.medication.strength}${prescription.medication.unit}`,
                  ),

                `${adherence?.score ?? patient.adherenceScore}% adherence (${adherence?.takenCount ?? 0} taken, ${adherence?.missedCount ?? 0} missed)`,

                `${patientReports.filter((report) => report.indexingStatus === "ready").length} searchable reports`,
              ]}
              initialResponse={ragResponse}
              onComplete={(response) => {
                setRagResponse(response)

                setAiResult(response.analysis ?? null)

                setEditedMeds(response.analysis?.suggestedMedications ?? [])

                setExpandedMedCitation({})
              }}
            />

            {aiResult?.suggestedMedications &&
              aiResult.suggestedMedications.length > 0 && (
                <PrescriptionSuggestionCard
                  medications={editedMeds}
                  expandedCitations={expandedMedCitation}
                  onToggleCitations={(index) =>
                    setExpandedMedCitation((previous) => ({
                      ...previous,

                      [index]: !previous[index],
                    }))
                  }
                  onFieldChange={handleMedFieldChange}
                  onApprove={() => setShowApprovePreview(true)}
                />
              )}
          </div>
        )}

        {/* PRESCRIPTION TAB */}
        {activeTab === "Prescription" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  Active Prescriptions
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Edit one prescription at a time. Every confirmed change
                  creates a revision record.
                </p>
              </div>
              <Badge variant="default">
                {prescriptions.length} prescriptions
              </Badge>
            </div>

            {prescriptions.map((prescription) => (
              <EditablePrescriptionCard
                key={prescription.id}
                prescription={prescription}
                isEditing={editingPrescriptionId === prescription.id}
                draft={
                  editingPrescriptionId === prescription.id
                    ? prescriptionDraft
                    : null
                }
                reason={
                  editingPrescriptionId === prescription.id
                    ? prescriptionReason
                    : ""
                }
                error={
                  editingPrescriptionId === prescription.id
                    ? prescriptionEditError
                    : ""
                }
                highlighted={justApprovedIds.has(prescription.medication.name)}
                onStartEditing={() => handleStartPrescriptionEdit(prescription)}
                onCancelEditing={handleCancelPrescriptionEdit}
                onDraftChange={handlePrescriptionDraftChange}
                onReasonChange={(reason) => {
                  setPrescriptionReason(reason)

                  setPrescriptionEditError("")
                }}
                onReviewChanges={handleReviewPrescriptionChanges}
              />
            ))}

            {showConfirm && prescriptionDraft && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full animate-slide-in-up max-h-[90vh] overflow-y-auto">
                  <p className="text-base font-semibold text-slate-900">
                    Confirm Prescription Change
                  </p>
                  <p className="text-sm text-slate-600 mt-1 mb-4">
                    Review the updated values before saving. The original
                    prescription will remain in revision history.
                  </p>

                  <div className="space-y-2 mb-4">
                    {Object.entries(pendingChanges).map(([field, change]) => (
                      <div
                        key={field}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {field.replace(/([A-Z])/g, " $1")}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-1 text-sm">
                          <div>
                            <span className="text-xs text-slate-400">
                              Previous
                            </span>
                            <p className="text-slate-600 line-through">
                              {change.from}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">
                              Updated
                            </span>
                            <p className="font-semibold text-teal-700">
                              {change.to}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 mb-5">
                    <p className="text-xs font-semibold text-amber-700">
                      Reason for change
                    </p>
                    <p className="text-sm text-amber-800 mt-0.5">
                      {prescriptionReason}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={() => setShowConfirm(false)}
                    >
                      Back to Editing
                    </Button>
                    <Button
                      fullWidth
                      variant="success"
                      onClick={handleConfirmPrescriptionChanges}
                    >
                      Confirm &amp; Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Approve & Prescribe — preview modal */}
      {showApprovePreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full animate-slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width={18}
                  height={18}
                  className="text-emerald-600"
                >
                  <path
                    d="M9 11l3 3L22 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Prescription Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Review before approving. This will generate dose schedules and
                  activate reminders.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {editedMeds.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-teal-50 border border-teal-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        Medicine
                      </p>
                      <p className="mt-1 inline-flex rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-base font-bold text-teal-950 shadow-sm">
                        {med.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Generic: {med.genericName}
                      </p>
                    </div>
                    <Badge variant="ai">AI suggested</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Strength</span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {med.strength}
                        {med.unit}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Frequency</span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {med.frequency}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Quantity</span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {med.quantity} tablets
                      </p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Days</span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {med.days} days
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-teal-700 mt-2 italic">
                    {med.instructions}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-5 flex items-start gap-2">
              <svg
                viewBox="0 0 24 24"
                className="fill-amber-500 flex-shrink-0 mt-0.5"
                width={12}
                height={12}
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>
                Approving will save {editedMeds.length} prescription
                {editedMeds.length !== 1 ? "s" : ""},{" "}
                <strong>
                  automatically record a clinical encounter in the Visit
                  Timeline
                </strong>
                , generate dose schedule slots via the Reminder Agent, and
                activate the care team pipeline.
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                fullWidth
                variant="secondary"
                onClick={() => setShowApprovePreview(false)}
              >
                Cancel
              </Button>
              <Button fullWidth onClick={handleConfirmApprove}>
                Confirm &amp; Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {approveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-slide-in-up">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            width={16}
            height={16}
          >
            <path
              d="M9 11l3 3L22 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Prescription approved &amp; Visit encounter recorded.
        </div>
      )}

      {/* Error toast */}
      {approveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-700 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-slide-in-up">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            width={16}
            height={16}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{approveError}</span>
          <button
            onClick={() => setApproveError("")}
            className="text-rose-200 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
