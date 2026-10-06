import type { AIPrescriptionSuggestion } from "../../../lib/types";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Input from "../../ui/Input";

interface PrescriptionSuggestionCardProps {
  medications: AIPrescriptionSuggestion[];
  expandedCitations: Record<number, boolean>;
  onToggleCitations: (index: number) => void;
  onFieldChange: (
    index: number,
    field: keyof AIPrescriptionSuggestion,
    value: string | number,
  ) => void;
  onApprove: () => void;
}

export default function PrescriptionSuggestionCard({
  medications,
  expandedCitations,
  onToggleCitations,
  onFieldChange,
  onApprove,
}: PrescriptionSuggestionCardProps) {
  if (medications.length === 0) return null;

  return (
    <Card padding="md" className="border border-teal-200 bg-teal-50/30">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Prescription Suggestion</p>
          <p className="text-xs text-slate-500 mt-0.5">Edit fields inline before approving</p>
        </div>
        <Badge variant="warning">Requires doctor approval</Badge>
      </div>

      <div className="space-y-4">
        {medications.map((medication, index) => (
          <div key={`${medication.name}-${index}`} className="bg-white rounded-xl border border-teal-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Medicine</p>
                <p className="mt-1 inline-flex rounded-lg border border-teal-200 bg-teal-100 px-3 py-1.5 text-base font-bold text-teal-950 shadow-sm">
                  {medication.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">Generic: {medication.genericName}</p>
              </div>
              <Badge variant="ai">AI suggested</Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              {[
                { label: "Medicine name", field: "name" as const, type: "text" },
                { label: "Generic name", field: "genericName" as const, type: "text" },
                { label: "Strength", field: "strength" as const, type: "text" },
                { label: "Unit", field: "unit" as const, type: "text" },
                { label: "Frequency", field: "frequency" as const, type: "text" },
                { label: "Quantity (tablets)", field: "quantity" as const, type: "number" },
                { label: "Days", field: "days" as const, type: "number" },
              ].map(({ label, field, type }) => (
                <Input
                  key={field}
                  label={label}
                  type={type}
                  value={medication[field] as string | number}
                  onChange={(event) => onFieldChange(
                    index,
                    field,
                    type === "number" ? Number(event.target.value) : event.target.value,
                  )}
                />
              ))}
            </div>

            <div className="mb-3">
              <Input
                label="Instructions"
                type="text"
                value={medication.instructions}
                onChange={(event) => onFieldChange(index, "instructions", event.target.value)}
              />
            </div>

            <div className="bg-teal-50 rounded-lg px-3 py-2.5 border border-teal-100 text-xs text-teal-700 mb-3 leading-relaxed">
              <span className="font-semibold">AI Reasoning: </span>{medication.reasoning}
            </div>

            <Button variant="ghost" size="sm" onClick={() => onToggleCitations(index)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}>
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Evidence for this suggestion ({medication.citations.length})
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width={10}
                height={10}
                className={`transition-transform ${expandedCitations[index] ? "rotate-180" : ""}`}
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>

            {expandedCitations[index] && (
              <div className="mt-3 space-y-2 animate-fade-in">
                {medication.citations.map((citation) => (
                  <div key={citation.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-800">{citation.title}</p>
                      <Badge variant={citation.type === "guideline" ? "outline" : "default"}>
                        {citation.type === "guideline" ? "Guideline" : "Research"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{citation.publisher} · {citation.date}</p>
                    <p className="text-xs text-slate-600 italic mt-1">{citation.relevanceNote}</p>
                    {citation.evidenceId && (
                      <p className="text-xs font-mono text-cyan-700 mt-2">
                        Retrieved source: {citation.evidenceId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button variant="success" size="lg" fullWidth className="mt-4" onClick={onApprove}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={16} height={16}>
          <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Approve &amp; Prescribe
      </Button>
    </Card>
  );
}
