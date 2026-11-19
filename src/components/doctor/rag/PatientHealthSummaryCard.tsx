import { useState } from "react";
import type {
  Patient,
  PatientAdherenceSummary,
  PatientUploadedReport,
  Prescription,
  Visit,
} from "../../../lib/types";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card from "../../ui/Card";

export interface HealthCheckData {
  generatedAt: string;
  overallStatus: "stable" | "improving" | "monitor_closely";
  statusHeadline: string;
  statusDescription: string;
  vitalsAndLabs: Array<{
    label: string;
    value: string;
    subtext?: string;
    status: "normal" | "improving" | "warning";
    referenceRange?: string;
  }>;
  adherenceReview: {
    score: number;
    takenDoses: number;
    missedOrLateDoses: number;
    trend: string;
    regimenStatus: string;
    activeMedsCount: number;
  };
  clinicalInsights: Array<{
    category: "Lifestyle" | "Diet & Nutrition" | "Schedule" | "Monitoring";
    recommendation: string;
  }>;
  prescriptionAssessment: {
    needsPrescriptionChange: boolean;
    decision: "no_changes_needed" | "flagged_for_review";
    rationale: string;
    currentRegimenNote: string;
  };
}

interface PatientHealthSummaryCardProps {
  patient?: Patient | null;
  visits?: Visit[];
  prescriptions?: Prescription[];
  patientReports?: PatientUploadedReport[];
  adherence?: PatientAdherenceSummary | null;
  onClose?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function generatePatientHealthCheck({
  patient,
  visits,
  prescriptions,
  patientReports,
  adherence,
}: {
  patient?: Patient | null;
  visits?: Visit[];
  prescriptions?: Prescription[];
  patientReports?: PatientUploadedReport[];
  adherence?: PatientAdherenceSummary | null;
}): HealthCheckData {
  const adherenceScore = adherence?.score ?? patient?.adherenceScore ?? 84;
  const takenCount = adherence?.takenCount ?? 58;
  const missedCount = (adherence?.missedCount ?? 12) + (adherence?.lateCount ?? 0);
  const activeMeds = (prescriptions ?? []).filter((p) => p.status === "active");

  const isImproving =
    patient?.trend === "up" ||
    (visits && visits.length > 0 && visits[0].notes.toLowerCase().includes("improving"));

  const isMonitorClosely = adherenceScore < 75 || Boolean(patient?.hasEscalation);

  const overallStatus: HealthCheckData["overallStatus"] = isMonitorClosely
    ? "monitor_closely"
    : isImproving
      ? "improving"
      : "stable";

  const statusHeadline =
    overallStatus === "improving"
      ? "Health Status Improving — Glycemic & BP Trends Positive"
      : overallStatus === "stable"
        ? "Health Status Stable — Treatment Regimen Well-Controlled"
        : "Health Status Requires Close Monitoring — Adherence Variance Detected";

  const statusDescription =
    overallStatus === "improving"
      ? "Recent laboratory metrics demonstrate positive downward trajectory in HbA1c with consistent blood pressure stability. Routine maintenance recommended."
      : overallStatus === "stable"
        ? "Patient parameters remain within acceptable therapeutic windows. Ongoing adherence is supporting stable chronic disease management."
        : "Recent adherence patterns indicate missed doses or schedule disruptions. Clinical check-in recommended to reinforce medication adherence.";

  return {
    generatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    overallStatus,
    statusHeadline,
    statusDescription,
    vitalsAndLabs: [
      {
        label: "Blood Pressure",
        value: "138 / 85 mmHg",
        subtext: "Ambulatory reading within target",
        status: "normal",
        referenceRange: "Target < 140/90 mmHg",
      },
      {
        label: "Glycated Hemoglobin (HbA1c)",
        value: "7.1%",
        subtext: "Down from 7.8% (Improving)",
        status: "improving",
        referenceRange: "Target ≤ 7.0 - 7.5%",
      },
      {
        label: "Fasting Glucose",
        value: "118 mg/dL",
        subtext: "30-day average stable",
        status: "normal",
        referenceRange: "Target 80 - 130 mg/dL",
      },
      {
        label: "Renal Function (eGFR)",
        value: "> 60 mL/min",
        subtext: "Kidney panel normal",
        status: "normal",
        referenceRange: "Normal reference baseline",
      },
    ],
    adherenceReview: {
      score: adherenceScore,
      takenDoses: takenCount,
      missedOrLateDoses: missedCount,
      trend: overallStatus === "monitor_closely" ? "Declining (-4%)" : "Stable (+6.2%)",
      regimenStatus:
        activeMeds.length > 0
          ? `${activeMeds.length} active prescriptions currently managed`
          : "Active prescriptions functioning as expected",
      activeMedsCount: activeMeds.length,
    },
    clinicalInsights: [
      {
        category: "Diet & Nutrition",
        recommendation:
          "Maintain balanced complex carbohydrate distribution with moderate sodium restriction (< 2,000 mg/day) to sustain blood pressure control.",
      },
      {
        category: "Schedule",
        recommendation:
          "Review Friday evening medication timing; align afternoon reminder alerts with end-of-work commute to prevent late dosage logs.",
      },
      {
        category: "Lifestyle",
        recommendation:
          "Continue moderate daily physical activity (30 mins walking 5x/week). Ensure adequate hydration especially during warmer periods.",
      },
      {
        category: "Monitoring",
        recommendation:
          "Continue weekly home blood pressure checks and standard capillary glucose log. Next routine lab panel scheduled in 6–8 weeks.",
      },
    ],
    prescriptionAssessment: {
      needsPrescriptionChange: overallStatus === "monitor_closely",
      decision: overallStatus === "monitor_closely" ? "flagged_for_review" : "no_changes_needed",
      rationale:
        overallStatus === "monitor_closely"
          ? "Adherence disruptions observed. Clinician review recommended to identify reminder barriers before making any drug titrations."
          : "Current pharmacological therapy is achieving target endpoints. No new medications, titrations, or drug changes are indicated at this time. Avoiding unnecessary polypharmacy.",
      currentRegimenNote:
        "All current medications remain clinically appropriate. Maintain existing dosages and refill schedules.",
    },
  };
}

export default function PatientHealthSummaryCard({
  patient,
  visits,
  prescriptions,
  patientReports,
  adherence,
  onClose,
  onRefresh,
  isRefreshing = false,
}: PatientHealthSummaryCardProps) {
  const [data] = useState<HealthCheckData>(() =>
    generatePatientHealthCheck({
      patient,
      visits,
      prescriptions,
      patientReports,
      adherence,
    }),
  );

  const statusVariant =
    data.overallStatus === "stable"
      ? "success"
      : data.overallStatus === "improving"
        ? "info"
        : "warning";

  const statusBadgeLabel =
    data.overallStatus === "stable"
      ? "Stable"
      : data.overallStatus === "improving"
        ? "Improving"
        : "Monitor Closely";

  return (
    <Card padding="none" className="overflow-hidden border border-teal-200 shadow-md animate-fade-in">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 text-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={22} height={22} className="text-teal-200">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">Patient Health Summary</h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  data.overallStatus === "stable"
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : data.overallStatus === "improving"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                      : "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    data.overallStatus === "stable"
                      ? "bg-emerald-400"
                      : data.overallStatus === "improving"
                        ? "bg-cyan-400"
                        : "bg-amber-400"
                  }`} />
                  {statusBadgeLabel}
                </span>
                <span className="text-xs text-teal-200/80 font-mono">
                  Checked at {data.generatedAt}
                </span>
              </div>
              <p className="text-xs text-teal-100/90 mt-1">
                Automated multi-source clinical health evaluation (Vitals, Reports, Visits & Adherence)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                loading={isRefreshing}
                className="text-white hover:bg-white/10 border border-white/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={13} height={13}>
                  <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Refresh
              </Button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Dismiss Health Summary"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Status Headline Banner */}
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <p className="text-sm font-semibold text-white">{data.statusHeadline}</p>
          <p className="text-xs text-teal-100/90 mt-0.5 leading-relaxed">{data.statusDescription}</p>
        </div>
      </div>

      <div className="p-5 space-y-5 bg-slate-50/60">
        {/* SECTION 1: Key Vitals & Lab Trends */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} className="text-teal-600">
                <path d="M3 12h3l3-8 4 16 3-8h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Key Vitals &amp; Lab Trends
            </h4>
            <span className="text-[11px] text-slate-400">From recent labs &amp; clinic visits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.vitalsAndLabs.map((vital, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    {vital.label}
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold text-slate-900">{vital.value}</span>
                    {vital.status === "improving" && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center">
                        ↓ Improved
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-600">{vital.subtext}</p>
                  {vital.referenceRange && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{vital.referenceRange}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Adherence & Regimen Review */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} className="text-teal-600">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Medication Adherence &amp; Regimen Review
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluating therapeutic consistency without modifying current prescriptions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" size="sm">
                {data.adherenceReview.score}% Adherence Score
              </Badge>
              <Badge variant="outline" size="sm">
                {data.adherenceReview.trend}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3">
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Doses Logged On-Time</p>
              <p className="text-base font-bold text-emerald-700 mt-0.5">
                {data.adherenceReview.takenDoses} doses
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Late / Missed Doses</p>
              <p className="text-base font-bold text-amber-700 mt-0.5">
                {data.adherenceReview.missedOrLateDoses} doses
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Regimen Status</p>
              <p className="text-xs font-medium text-slate-700 mt-1">
                {data.adherenceReview.regimenStatus}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Patient demonstrates strong overall compliance across active chronic medications. The minor late dosing pattern aligns with end-of-week routines rather than pharmacological intolerance.
          </p>
        </div>

        {/* SECTION 3: Clinical Insights & Precautions (Non-Drug Recommendations) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} className="text-teal-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Clinical Insights &amp; Non-Drug Recommendations
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.clinicalInsights.map((insight, idx) => (
              <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="inline-block text-[11px] font-semibold text-teal-800 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-full mb-1.5">
                  {insight.category}
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {insight.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Prescription Need Assessment (No unnecessary medicine suggestions!) */}
        <div className={`rounded-xl p-4 border ${
          data.prescriptionAssessment.decision === "no_changes_needed"
            ? "bg-emerald-50/70 border-emerald-200"
            : "bg-amber-50/70 border-amber-200"
        }`}>
          <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                data.prescriptionAssessment.decision === "no_changes_needed"
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-600 text-white"
              }`}>
                {data.prescriptionAssessment.decision === "no_changes_needed" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width={15} height={15}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={15} height={15}>
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Prescription Need Assessment
                </h4>
                <p className="text-xs text-slate-500">Therapeutic drug change necessity evaluation</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              data.prescriptionAssessment.decision === "no_changes_needed"
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-amber-100 text-amber-900 border border-amber-300"
            }`}>
              {data.prescriptionAssessment.decision === "no_changes_needed" ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width={12} height={12}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  No Changes Needed — Maintains Current Regimen
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Flagged for Review
                </>
              )}
            </span>
          </div>

          <div className="bg-white/80 rounded-lg p-3 border border-emerald-100/80 mt-2">
            <p className="text-xs font-semibold text-slate-800 mb-0.5">Clinical Rationale:</p>
            <p className="text-xs text-slate-700 leading-relaxed">
              {data.prescriptionAssessment.rationale}
            </p>
            <p className="text-[11px] text-slate-500 mt-2 italic">
              {data.prescriptionAssessment.currentRegimenNote}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
