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
  const safeEvidence = Array.isArray(evidence) ? evidence : [];
  const [expanded, setExpanded] = useState(false);
  const content = STATUS_CONTENT[status] ?? STATUS_CONTENT.insufficient;
  const clinicalCount = safeEvidence.filter((item) =>
    ["guideline", "research", "medication_reference"].includes(item.sourceType)
  ).length;
  const patientCount = safeEvidence.length - clinicalCount;

  return (
    <Card padding="none" className="overflow-hidden border-cyan-200">
      <div className="p-5 bg-gradient-to-r from-cyan-50 to-teal-50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900">Retrieved Evidence</p>
              <Badge variant="info">{safeEvidence.length} source{safeEvidence.length === 1 ? "" : "s"}</Badge>
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
          {safeEvidence.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-sm font-medium text-slate-700">No eligible evidence retrieved</p>
              <p className="text-xs text-slate-500 mt-1">Review the patient record or request additional information.</p>
            </div>
          ) : safeEvidence.map((item, index) => {
            const isExternalMcp = item.sourceTier === "external_mcp" || ["guideline", "research", "medication_reference"].includes(item.sourceType);
            return (
              <div
                key={`${item.sourceId}-${item.chunkId ?? index}`}
                className={`rounded-xl border p-4 ${
                  isExternalMcp ? "border-purple-200 bg-purple-50/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {isExternalMcp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={10} height={10}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          External Literature (MCP)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={10} height={10}>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                          </svg>
                          Patient Record
                        </span>
                      )}
                      <Badge variant="outline">
                        {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
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
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 hover:underline font-medium mt-1"
                      >
                        <span>View authoritative publication</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={11} height={11}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400">Source {index + 1}</span>
                </div>

                <div className={`mt-3 rounded-lg border-l-4 px-3 py-2.5 ${
                  isExternalMcp ? "border-purple-400 bg-purple-50/50" : "border-cyan-300 bg-slate-50"
                }`}>
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
            );
          })}
        </div>
      )}
    </Card>
  );
}
