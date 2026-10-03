import { useState } from "react";
import type { RagEvidenceStatus, RetrievedEvidence as Evidence } from "../../../lib/types";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card from "../../ui/Card";

const SOURCE_LABELS: Record<Evidence["sourceType"], string> = {
  guideline: "Guideline",
  research: "Research",
  patient_visit: "Prior visit",
  patient_report: "Patient report",
  medication_reference: "Medication reference",
};

const STATUS_CONTENT: Record<
  RagEvidenceStatus,
  { label: string; variant: "success" | "warning" | "error"; message?: string }
> = {
  sufficient: { label: "Evidence available", variant: "success" },
  limited: {
    label: "Limited evidence",
    variant: "warning",
    message: "The available sources provide limited support. Interpret the analysis with caution.",
  },
  insufficient: {
    label: "Insufficient evidence",
    variant: "error",
    message: "No sources met the retrieval threshold. The analysis should not be treated as a supported recommendation.",
  },
  conflicting: {
    label: "Conflicting evidence",
    variant: "warning",
    message: "Retrieved sources do not fully agree. Review each source before making a clinical decision.",
  },
};

interface RetrievedEvidenceProps {
  evidence: Evidence[];
  status?: RagEvidenceStatus;
  demo?: boolean;
}

export default function RetrievedEvidence({
  evidence,
  status = evidence.length > 0 ? "sufficient" : "insufficient",
  demo = false,
}: RetrievedEvidenceProps) {
  const [expanded, setExpanded] = useState(false);
  const content = STATUS_CONTENT[status];
  const clinicalCount = evidence.filter((item) =>
    ["guideline", "research", "medication_reference"].includes(item.sourceType)
  ).length;
  const patientCount = evidence.length - clinicalCount;

  return (
    <Card padding="none" className="overflow-hidden border-cyan-200">
      <div className="p-5 bg-gradient-to-r from-cyan-50 to-teal-50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900">Retrieved Evidence</p>
              <Badge variant="info">{evidence.length} source{evidence.length === 1 ? "" : "s"}</Badge>
              <Badge variant={content.variant}>{content.label}</Badge>
              {demo && <Badge variant="outline">Demo evidence</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {clinicalCount} clinical · {patientCount} patient record{patientCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide evidence" : "Review evidence"}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width={14}
              height={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>

        {content.message && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            status === "insufficient"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {content.message}
          </div>
        )}
      </div>

      {expanded && (
        <div className="p-5 space-y-3 animate-fade-in">
          {evidence.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-sm font-medium text-slate-700">No eligible evidence retrieved</p>
              <p className="text-xs text-slate-500 mt-1">Review the patient record or request additional information.</p>
            </div>
          ) : evidence.map((item, index) => (
            <div key={`${item.sourceId}-${item.chunkId ?? index}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={item.sourceType.startsWith("patient_") ? "info" : "outline"}>
                      {SOURCE_LABELS[item.sourceType]}
                    </Badge>
                    {typeof item.similarityScore === "number" && (
                      <span className="text-xs text-slate-400">
                        Retrieval match {Math.round(item.similarityScore * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {(item.publisher || item.date) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[item.publisher, item.date].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-400">Source {index + 1}</span>
              </div>

              <div className="mt-3 rounded-lg border-l-4 border-cyan-300 bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Retrieved excerpt</p>
                <p className="text-sm leading-relaxed text-slate-700">{item.excerpt}</p>
              </div>

              {item.relevanceNote && (
                <p className="mt-2 text-xs text-teal-700">
                  <span className="font-semibold">Why it is relevant: </span>
                  {item.relevanceNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
