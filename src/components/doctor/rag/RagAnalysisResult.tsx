import type { AIAnalysis } from "../../../lib/types";
import Badge from "../../ui/Badge";
import Card from "../../ui/Card";

export default function RagAnalysisResult({ analysis }: { analysis: AIAnalysis }) {
  const uncertain =
    analysis.evidenceStatus === "insufficient" ||
    analysis.evidenceStatus === "conflicting" ||
    analysis.evidenceStatus === "limited";

  return (
    <Card padding="md" className={uncertain ? "border-amber-200" : ""}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="ai">AI Analysis Complete</Badge>
            {uncertain && <Badge variant="warning">Uncertainty requires review</Badge>}
            <span className="text-xs text-slate-400">
              {new Date(analysis.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{analysis.hypothesis}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={uncertain ? "text-lg font-bold text-amber-700" : "text-lg font-bold text-teal-700"}>
            {Math.round(analysis.confidence * 100)}%
          </div>
          <div className="text-xs text-slate-400">Model confidence</div>
        </div>
      </div>

      {analysis.safetyFlags.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-rose-700 mb-1">Safety and uncertainty flags</p>
          {analysis.safetyFlags.map((flag) => (
            <p key={flag} className="text-xs text-rose-600">· {flag}</p>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reasoning</p>
        <p className="text-sm text-slate-700 leading-relaxed">{analysis.explanation}</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">
          Model {analysis.modelVersion}
          {analysis.promptVersion ? ` · Prompt ${analysis.promptVersion}` : ""}
        </p>
        {analysis.ragQueryId && (
          <p className="text-xs font-mono text-slate-400">Analysis {analysis.ragQueryId}</p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mt-3">
        Advisory only. Doctor review is required before any clinical action.
      </div>
    </Card>
  );
}
