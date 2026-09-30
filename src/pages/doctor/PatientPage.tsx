import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { AIPrescriptionSuggestion } from "../../lib/types";
import {
  DEMO_PATIENTS,
  DEMO_VISITS,
  DEMO_ADHERENCE,
  DEMO_AI_ANALYSIS,
  DEMO_PRESCRIPTIONS,
  DEMO_CARE_TEAM,
  DEMO_SPARKLINE,
} from "../../lib/mockData";
import Card, { CardHeader, CardTitle } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import TrustBadge from "../../components/ui/TrustBadge";
import DoseHeatmap from "../../components/charts/DoseHeatmap";
import AdherenceRing from "../../components/charts/AdherenceRing";
import ScoreTrendChart from "../../components/charts/ScoreTrendChart";

const TABS = ["Overview", "Visits", "Adherence", "AI Assistant", "Prescription"];

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [expandedVisit, setExpandedVisit] = useState<string | null>("v-001");
  const [expandedCitation, setExpandedCitation] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [aiResult, setAiResult] = useState<typeof DEMO_AI_ANALYSIS | null>(DEMO_AI_ANALYSIS);
  const [prescriptionEdit, setPrescriptionEdit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // AI prescription suggestion state
  const [editedMeds, setEditedMeds] = useState<AIPrescriptionSuggestion[]>(
    DEMO_AI_ANALYSIS.suggestedMedications ?? []
  );
  const [expandedMedCitation, setExpandedMedCitation] = useState<Record<number, boolean>>({});
  const [showApprovePreview, setShowApprovePreview] = useState(false);
  const [approvedPrescriptions, setApprovedPrescriptions] = useState<AIPrescriptionSuggestion[]>([]);
  const [approveToast, setApproveToast] = useState(false);
  const [justApprovedIds, setJustApprovedIds] = useState<Set<string>>(new Set());

  const patient = DEMO_PATIENTS.find((p) => p.id === patientId) || DEMO_PATIENTS[0];
  const visits = DEMO_VISITS.filter((v) => v.patientId === patient.id);

  const handleRunAI = () => {
    if (!symptoms.trim()) return;
    setAiRunning(true);
    setAiResult(null);
    setTimeout(() => {
      setAiRunning(false);
      setAiResult(DEMO_AI_ANALYSIS);
      setEditedMeds(DEMO_AI_ANALYSIS.suggestedMedications ?? []);
    }, 2500);
  };

  const handleMedFieldChange = (idx: number, field: keyof AIPrescriptionSuggestion, value: string | number) => {
    setEditedMeds((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleConfirmApprove = () => {
    setShowApprovePreview(false);
    setApprovedPrescriptions((prev) => [...editedMeds, ...prev]);
    const newIds = new Set(editedMeds.map((m) => m.name));
    setJustApprovedIds(newIds);
    sessionStorage.setItem("pipeline_triggered", "true");
    setApproveToast(true);
    setTimeout(() => setApproveToast(false), 4000);
    setTimeout(() => setJustApprovedIds(new Set()), 3500);
    setActiveTab("Prescription");
  };

  return (
    <div className="animate-fade-in">
      {/* Patient header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg flex-shrink-0">
              {patient.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
                <span className="text-sm font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{patient.patientId}</span>
                <StatusPill status={patient.status} />
                {patient.hasEscalation && (
                  <Badge variant="error" dot>Escalation Active</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                <span>{patient.age}y · {patient.gender}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{patient.conditions.join(" · ")}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>Last visit {patient.lastVisit}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TrustBadge score={patient.adherenceScore} trend={patient.trend} size="md" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/doctor/patients/${patient.id}/care-team`)}
            >
              Care Team View
            </Button>
          </div>
        </div>

        {/* Care team chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-slate-400">Care team:</span>
          {DEMO_CARE_TEAM.map((m) => (
            <span key={m.id} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
              {m.name} · <span className="text-slate-400">{m.role}</span>
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 -mb-5 border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
                <AdherenceRing score={patient.adherenceScore} size={100} />
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Taken", count: DEMO_ADHERENCE.taken, color: "text-emerald-600" },
                    { label: "Late", count: DEMO_ADHERENCE.late, color: "text-amber-600" },
                    { label: "Skipped", count: DEMO_ADHERENCE.skipped, color: "text-slate-500" },
                    { label: "Missed", count: DEMO_ADHERENCE.missed, color: "text-rose-600" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-6">
                      <span className="text-slate-500">{s.label}</span>
                      <span className={`font-semibold ${s.color}`}>{s.count}</span>
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
                {DEMO_PRESCRIPTIONS.filter((p) => p.status === "active").map((rx) => (
                  <div key={rx.id} className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{rx.medication.name} {rx.medication.strength}{rx.medication.unit}</div>
                      <div className="text-xs text-slate-400">{rx.medication.frequency}</div>
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
                    <p className="text-slate-700 text-xs mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Score trend */}
            <div className="lg:col-span-3">
              <Card padding="md">
                <CardHeader>
                  <CardTitle>Adherence Score Trend (3 months)</CardTitle>
                  <Badge variant="success">+{DEMO_ADHERENCE.trend}% vs last period</Badge>
                </CardHeader>
                <ScoreTrendChart data={DEMO_SPARKLINE} height={200} />
              </Card>
            </div>
          </div>
        )}

        {/* VISITS TAB */}
        {activeTab === "Visits" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Visit Timeline</h2>
              <Badge variant="default">{visits.length} visits</Badge>
            </div>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

              <div className="space-y-3">
                {visits.map((visit, i) => (
                  <div key={visit.id} className="relative pl-14 animate-slide-in-up" style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}>
                    {/* Timeline dot */}
                    <div className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 z-10 ${i === 0 ? "bg-teal-500 border-teal-500" : "bg-white border-slate-300"}`} />

                    <Card
                      hover
                      onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-slate-400">{visit.date}</span>
                            {i === 0 && <Badge variant="success" size="sm">Latest</Badge>}
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{visit.condition}</h3>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {visit.symptoms.map((s) => (
                              <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                          </div>
                        </div>
                        <svg
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}
                          className={`text-slate-400 transition-transform flex-shrink-0 mt-1 ${expandedVisit === visit.id ? "rotate-180" : ""}`}
                        >
                          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      {expandedVisit === visit.id && (
                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 animate-fade-in">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clinical Notes</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{visit.notes}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Proposed Solution</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{visit.proposedSolution}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Outcome</p>
                            <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">{visit.outcome}</p>
                          </div>
                          {visit.relatedVisits && visit.relatedVisits.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" /></svg>
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
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { label: "Taken on time", value: DEMO_ADHERENCE.taken, color: "emerald" },
                { label: "Taken late", value: DEMO_ADHERENCE.late, color: "amber" },
                { label: "Skipped", value: DEMO_ADHERENCE.skipped, color: "slate" },
                { label: "Missed", value: DEMO_ADHERENCE.missed, color: "rose" },
              ].map((s) => (
                <Card key={s.label} padding="md">
                  <div className={`text-2xl font-bold text-${s.color}-600 mb-0.5`}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className="text-xs text-slate-400 mt-1">Last 90 days</div>
                </Card>
              ))}
            </div>

            <Card padding="md">
              <CardHeader>
                <CardTitle>90-Day Dose Heatmap</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {DEMO_ADHERENCE.deliveryFailures} delivery failures excluded from miss count
                </div>
              </CardHeader>
              <DoseHeatmap data={DEMO_ADHERENCE.heatmapData} />
            </Card>

            <Card padding="md">
              <CardHeader>
                <CardTitle>AI Root-Cause Classification</CardTitle>
                <Badge variant="ai">
                  <svg viewBox="0 0 24 24" className="fill-cyan-600" width={10} height={10}><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
                  Research prototype
                </Badge>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    DEMO_AI_ANALYSIS.severity === "urgent" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    DEMO_AI_ANALYSIS.severity === "concerning" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    Severity: {DEMO_AI_ANALYSIS.severity}
                  </div>
                  <div className="text-sm text-slate-600">
                    Confidence: <span className="font-semibold text-slate-900">{Math.round(DEMO_AI_ANALYSIS.confidence * 100)}%</span>
                  </div>
                  <Badge variant="default">{DEMO_AI_ANALYSIS.rootCause}</Badge>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Explanation</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{DEMO_AI_ANALYSIS.explanation}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                  <svg viewBox="0 0 24 24" className="fill-amber-500 flex-shrink-0" width={12} height={12}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                  AI output requires doctor review before clinical action. Model: {DEMO_AI_ANALYSIS.modelVersion}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* AI ASSISTANT TAB */}
        {activeTab === "AI Assistant" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">AI Diagnostic Assistant</h2>
              <Badge variant="ai">Research prototype · Not a diagnosis</Badge>
            </div>

            <Card padding="md">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Patient Context (auto-loaded)</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {["Type 2 Diabetes", "Hypertension", "Metformin 1000mg BID", "Amlodipine 5mg", "84% adherence (last 30d)"].map((tag) => (
                  <span key={tag} className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe current symptoms or clinical question for AI analysis…"
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none placeholder-slate-400 text-slate-900"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-slate-400">AI will analyze symptoms against patient history, current medications, and adherence context.</p>
                <Button onClick={handleRunAI} loading={aiRunning} disabled={!symptoms.trim()}>
                  Run Analysis
                </Button>
              </div>
            </Card>

            {/* Typing indicator */}
            {aiRunning && (
              <Card padding="md" className="animate-fade-in">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 dot-1" />
                    <span className="w-2 h-2 rounded-full bg-teal-500 dot-2" />
                    <span className="w-2 h-2 rounded-full bg-teal-500 dot-3" />
                  </div>
                  <span className="text-sm">AI is analyzing patient context…</span>
                </div>
              </Card>
            )}

            {/* AI result */}
            {aiResult && !aiRunning && (
              <div className="space-y-4 animate-fade-in">
                <Card padding="md">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="ai">AI Analysis Complete</Badge>
                        <span className="text-xs text-slate-400">{new Date(aiResult.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{aiResult.hypothesis}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-teal-700">{Math.round(aiResult.confidence * 100)}%</div>
                      <div className="text-xs text-slate-400">Confidence</div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full mb-4">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-700"
                      style={{ width: `${aiResult.confidence * 100}%` }}
                    />
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reasoning</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiResult.explanation}</p>
                  </div>

                  {aiResult.safetyFlags.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
                      <p className="text-xs font-semibold text-rose-700 mb-1">Safety Flags</p>
                      {aiResult.safetyFlags.map((flag) => (
                        <p key={flag} className="text-xs text-rose-600">{flag}</p>
                      ))}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                    Doctor review required before any clinical action. AI output is advisory only. Model: {aiResult.modelVersion}
                  </div>
                </Card>

                {/* AI Prescription Suggestion */}
                {aiResult.suggestedMedications && aiResult.suggestedMedications.length > 0 && (
                  <Card padding="md" className="border border-teal-200 bg-teal-50/30">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">AI Prescription Suggestion</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Edit fields inline before approving</p>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
                        Requires doctor approval
                      </span>
                    </div>

                    <div className="space-y-4">
                      {editedMeds.map((med, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-teal-100 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Medicine</p>
                              <p className="mt-1 inline-flex rounded-lg border border-teal-200 bg-teal-100 px-3 py-1.5 text-base font-bold text-teal-950 shadow-sm">
                                {med.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Generic: {med.genericName}</p>
                            </div>
                            <Badge variant="ai">AI suggested</Badge>
                          </div>

                          {/* Inline-editable fields */}
                          <div className="grid sm:grid-cols-2 gap-3 mb-3">
                            {[
                              { label: "Strength", field: "strength" as const, suffix: med.unit, type: "text" },
                              { label: "Frequency", field: "frequency" as const, suffix: "", type: "text" },
                              { label: "Quantity (tablets)", field: "quantity" as const, suffix: "", type: "number" },
                              { label: "Days", field: "days" as const, suffix: "", type: "number" },
                            ].map(({ label, field, suffix, type }) => (
                              <div key={field} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                <div className="text-xs text-slate-400 mb-1">{label}</div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type={type}
                                    value={med[field] as string | number}
                                    onChange={(e) => handleMedFieldChange(idx, field, type === "number" ? Number(e.target.value) : e.target.value)}
                                    className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-teal-500 min-w-0"
                                  />
                                  {suffix && <span className="text-xs text-slate-400 flex-shrink-0">{suffix}</span>}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 mb-3">
                            <div className="text-xs text-slate-400 mb-1">Instructions</div>
                            <input
                              type="text"
                              value={med.instructions}
                              onChange={(e) => handleMedFieldChange(idx, "instructions", e.target.value)}
                              className="w-full text-sm text-slate-700 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-teal-500"
                            />
                          </div>

                          <div className="bg-teal-50 rounded-lg px-3 py-2.5 border border-teal-100 text-xs text-teal-700 mb-3 leading-relaxed">
                            <span className="font-semibold">AI Reasoning: </span>{med.reasoning}
                          </div>

                          <button
                            onClick={() => setExpandedMedCitation((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            className="text-xs text-teal-600 font-medium flex items-center gap-1 hover:text-teal-800 cursor-pointer"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {med.citations.length} supporting citation{med.citations.length !== 1 ? "s" : ""}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={10} height={10}
                              className={`transition-transform ${expandedMedCitation[idx] ? "rotate-180" : ""}`}>
                              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          {expandedMedCitation[idx] && (
                            <div className="mt-3 space-y-2 animate-fade-in">
                              {med.citations.map((c) => (
                                <div key={c.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium text-slate-800">{c.title}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                      c.type === "guideline" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-600"
                                    }`}>{c.type === "guideline" ? "Guideline" : "Research"}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{c.publisher} · {c.date}</p>
                                  <p className="text-[10px] text-slate-600 italic mt-1">{c.relevanceNote}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowApprovePreview(true)}
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={16} height={16}>
                        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Approve &amp; Prescribe
                    </button>
                  </Card>
                )}

                {/* Citations */}
                <Card padding="md">
                  <button
                    onClick={() => setExpandedCitation(!expandedCitation)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">Research Citations</p>
                      <Badge variant="default">{aiResult.citations.length}</Badge>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}
                      className={`text-slate-400 transition-transform ${expandedCitation ? "rotate-180" : ""}`}>
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {expandedCitation && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      {aiResult.citations.map((c) => (
                        <div key={c.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{c.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{c.publisher} · {c.date}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              c.type === "guideline" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}>
                              {c.type === "guideline" ? "Guideline" : "Research"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2 italic">{c.relevanceNote}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* PRESCRIPTION TAB */}
        {activeTab === "Prescription" && (
          <div className="space-y-5 animate-fade-in">
            {/* AI-approved prescriptions appear at the top */}
            {approvedPrescriptions.map((med) => (
              <Card key={`approved-${med.name}`} padding="md" className={`border-2 transition-all duration-700 ${justApprovedIds.has(med.name) ? "border-emerald-400 bg-emerald-50/30" : "border-transparent"}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-slate-900">{med.name}</h3>
                      <StatusPill status="active" />
                      <Badge variant="ai">AI Suggested</Badge>
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">Doctor Approved</span>
                      {justApprovedIds.has(med.name) && (
                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium animate-fade-in">Just approved ✓</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{med.genericName} · {med.strength}{med.unit} · {med.frequency}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Quantity", value: `${med.quantity} tablets` },
                    { label: "Duration", value: `${med.days} days` },
                    { label: "Prescribed by", value: "Dr. Sarah Chen" },
                    { label: "Approved at", value: new Date().toLocaleDateString() },
                  ].map((f) => (
                    <div key={f.label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <div className="text-xs text-slate-400 mb-0.5">{f.label}</div>
                      <div className="text-sm font-medium text-slate-800">{f.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                  <div className="text-xs text-slate-400 mb-0.5">Instructions</div>
                  <div className="text-sm text-slate-700">{med.instructions}</div>
                </div>
              </Card>
            ))}

            {DEMO_PRESCRIPTIONS.map((rx) => (
              <Card key={rx.id} padding="md">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-slate-900">{rx.medication.name}</h3>
                      <StatusPill status="active" />
                      {rx.suggestedBy === "ai" && <Badge variant="ai">AI suggested</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">{rx.medication.genericName} · {rx.medication.strength}{rx.medication.unit} · {rx.medication.frequency}</p>
                  </div>
                  <Button size="sm" variant={prescriptionEdit ? "success" : "outline"} onClick={() => {
                    if (prescriptionEdit) setShowConfirm(true);
                    else setPrescriptionEdit(true);
                  }}>
                    {prescriptionEdit ? "Save Changes" : "Edit"}
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Quantity", value: `${rx.medication.quantity} tablets` },
                    { label: "Duration", value: rx.medication.duration },
                    { label: "Start", value: rx.medication.startDate },
                    { label: "End", value: rx.medication.endDate },
                  ].map((f) => (
                    <div key={f.label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <div className="text-xs text-slate-400 mb-0.5">{f.label}</div>
                      <div className="text-sm font-medium text-slate-800">{f.value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 mb-3">
                  <div className="text-xs text-slate-400 mb-0.5">Instructions</div>
                  <div className="text-sm text-slate-700">{rx.medication.instructions}</div>
                </div>

                {/* Evidence section */}
                {rx.citations.length > 0 && (
                  <details className="border border-teal-100 rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer bg-teal-50 text-sm font-medium text-teal-700 flex items-center gap-2 list-none">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Evidence for this suggestion ({rx.citations.length} citation{rx.citations.length > 1 ? "s" : ""})
                    </summary>
                    <div className="p-4 space-y-3">
                      {rx.citations.map((c) => (
                        <div key={c.id} className="text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-800">{c.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              c.type === "guideline" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-600"
                            }`}>{c.type === "guideline" ? "Guideline" : "Research"}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{c.publisher} · {c.date}</p>
                          <p className="text-xs text-slate-600 italic mt-1">{c.relevanceNote}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Revisions */}
                {rx.revisions.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Revision History</p>
                    {rx.revisions.map((r) => (
                      <div key={r.id} className="text-xs text-slate-500 flex items-start gap-2">
                        <span className="text-slate-300">·</span>
                        <span>{r.changedAt} — {r.changedBy}: {r.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}

            {/* Confirm modal */}
            {showConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-slide-in-up">
                  <h3 className="text-base font-semibold text-slate-900 mb-2">Confirm Prescription Change</h3>
                  <p className="text-sm text-slate-600 mb-5">Review and confirm the changes before saving. This action will create a revision record.</p>
                  <div className="flex gap-3">
                    <Button fullWidth variant="secondary" onClick={() => { setShowConfirm(false); setPrescriptionEdit(false); }}>Cancel</Button>
                    <Button fullWidth onClick={() => { setShowConfirm(false); setPrescriptionEdit(false); }}>Confirm & Save</Button>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18} className="text-emerald-600">
                  <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Prescription Preview</h3>
                <p className="text-xs text-slate-500">Review before approving. This will generate dose schedules and activate reminders.</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {editedMeds.map((med, idx) => (
                <div key={idx} className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Medicine</p>
                      <p className="mt-1 inline-flex rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-base font-bold text-teal-950 shadow-sm">
                        {med.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Generic: {med.genericName}</p>
                    </div>
                    <Badge variant="ai">AI suggested</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Strength</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{med.strength}{med.unit}</p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Frequency</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{med.frequency}</p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Quantity</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{med.quantity} tablets</p>
                    </div>
                    <div className="bg-white rounded-lg px-2.5 py-1.5 border border-teal-100">
                      <span className="text-slate-400">Days</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{med.days} days</p>
                    </div>
                  </div>
                  <p className="text-xs text-teal-700 mt-2 italic">{med.instructions}</p>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-5 flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="fill-amber-500 flex-shrink-0 mt-0.5" width={12} height={12}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
              Approving will save {editedMeds.length} prescription{editedMeds.length !== 1 ? "s" : ""}, generate dose schedule slots via the Reminder Agent, and activate the care team pipeline.
            </div>

            <div className="flex gap-3">
              <Button fullWidth variant="secondary" onClick={() => setShowApprovePreview(false)}>Cancel</Button>
              <Button fullWidth onClick={handleConfirmApprove}>Confirm &amp; Approve</Button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {approveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-slide-in-up">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={16} height={16}>
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Prescription approved. Dose schedule generation triggered.
        </div>
      )}
    </div>
  );
}
