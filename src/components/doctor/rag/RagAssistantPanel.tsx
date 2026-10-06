import { useEffect, useRef, useState } from "react";
import usePatientRagAnalysis from "../../../hooks/usePatientRagAnalysis";
import { getRagMode } from "../../../lib/rag";
import type { RagAnalysisResponse } from "../../../lib/types";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import { Textarea } from "../../ui/Input";
import RagAnalysisResult from "./RagAnalysisResult";
import RagErrorState from "./RagErrorState";
import RetrievedEvidence from "./RetrievedEvidence";

interface RagAssistantPanelProps {
  patientId: string;
  patientContext: string[];
  initialResponse: RagAnalysisResponse | null;
  onComplete: (response: RagAnalysisResponse) => void;
}

export default function RagAssistantPanel({
  patientId,
  patientContext,
  initialResponse,
  onComplete,
}: RagAssistantPanelProps) {
  const [query, setQuery] = useState("");
  const { response, error, runAnalysis, retry, isProcessing } =
    usePatientRagAnalysis(patientId, initialResponse);
  const completedId = useRef<string | null>(initialResponse?.status === "complete" ? initialResponse.id : null);
  const mode = getRagMode();

  useEffect(() => {
    if (response?.status === "complete" && response.analysis && completedId.current !== response.id) {
      completedId.current = response.id;
      onComplete(response);
    }
  }, [onComplete, response]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runAnalysis({ symptoms: "", question: query });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-semibold text-slate-900">Evidence-Grounded AI Assistant</p>
          <Badge variant="ai">Advisory clinical support</Badge>
          {mode === "mock" && <Badge variant="outline">Demo mode</Badge>}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Retrieves authorized patient context and approved clinical sources. Doctor review is required.
        </p>
      </div>

      <Card padding="md">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient context preview</p>
            <p className="text-xs text-slate-400 mt-0.5">The server selects the final authorized context.</p>
          </div>
          <Badge variant="success">Patient scoped</Badge>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {patientContext.map((tag) => (
            <span key={tag} className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            label="Ask AI with RAG"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Describe symptoms, observations, or ask a clinical question…"
            hint="This single prompt is used to retrieve authorized evidence and generate the advisory AI analysis."
            rows={4}
            disabled={isProcessing}
          />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-400">
              Patient notes and uploaded documents are treated as untrusted evidence.
            </p>
            <Button
              type="submit"
              loading={isProcessing}
              disabled={!query.trim()}
              className="w-full sm:w-auto"
            >
              Ask AI with RAG
            </Button>
          </div>
        </form>
      </Card>

      {response && (response.status === "pending" || response.status === "running") && (
        <Card padding="md" className="border-cyan-200 bg-cyan-50/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
              <span className="w-4 h-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {response.status === "pending" ? "Analysis request accepted" : "Evidence-grounded analysis in progress"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {response.status === "pending"
                  ? "Preparing an authorized patient-scoped request…"
                  : "Retrieving authorized evidence and generating an advisory analysis…"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {error && <RagErrorState error={error} onRetry={retry} />}

      {response?.status === "complete" && (
        <>
          <RetrievedEvidence
            evidence={response.evidence}
            status={response.evidenceStatus}
            demo={mode === "mock"}
          />
          {response.analysis && <RagAnalysisResult analysis={response.analysis} />}
        </>
      )}
    </div>
  );
}
