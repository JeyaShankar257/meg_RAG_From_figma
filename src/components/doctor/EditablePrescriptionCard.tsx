import type { Medication, Prescription } from "../../lib/types";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input, { Textarea } from "../ui/Input";
import StatusPill from "../ui/StatusPill";

type EditableMedicationField =
  | "name"
  | "genericName"
  | "strength"
  | "unit"
  | "frequency"
  | "quantity"
  | "duration"
  | "instructions";

interface EditablePrescriptionCardProps {
  prescription: Prescription;
  isEditing: boolean;
  draft: Medication | null;
  reason: string;
  error: string;
  highlighted?: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onDraftChange: (field: EditableMedicationField, value: string | number) => void;
  onReasonChange: (reason: string) => void;
  onReviewChanges: () => void;
}

export default function EditablePrescriptionCard({
  prescription,
  isEditing,
  draft,
  reason,
  error,
  highlighted = false,
  onStartEditing,
  onCancelEditing,
  onDraftChange,
  onReasonChange,
  onReviewChanges,
}: EditablePrescriptionCardProps) {
  const medication = isEditing && draft ? draft : prescription.medication;

  return (
    <Card
      padding="md"
      className={`border-2 transition-all duration-700 ${
        highlighted ? "border-emerald-400 bg-emerald-50/30" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-slate-900">{medication.name}</p>
            <StatusPill status="active" />
            {prescription.suggestedBy === "ai" && <Badge variant="ai">AI Suggested</Badge>}
            {prescription.approvedBy && <Badge variant="success">Doctor Approved</Badge>}
            {highlighted && <Badge variant="success">Just approved</Badge>}
          </div>
          <p className="text-xs text-slate-500">
            {medication.genericName} · {medication.strength}{medication.unit} · {medication.frequency}
          </p>
        </div>
        {!isEditing && (
          <Button size="sm" variant="outline" onClick={onStartEditing}>
            Edit Prescription
          </Button>
        )}
      </div>

      {isEditing && draft ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-900">Edit prescription details</p>
                <p className="text-xs text-slate-500 mt-0.5">Changes are not saved until you review and confirm.</p>
              </div>
              <Badge variant="warning">Unsaved draft</Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Medicine name"
                value={draft.name}
                onChange={(event) => onDraftChange("name", event.target.value)}
              />
              <Input
                label="Generic name"
                value={draft.genericName}
                onChange={(event) => onDraftChange("genericName", event.target.value)}
              />
              <Input
                label="Strength"
                value={draft.strength}
                onChange={(event) => onDraftChange("strength", event.target.value)}
              />
              <Input
                label="Unit"
                value={draft.unit}
                onChange={(event) => onDraftChange("unit", event.target.value)}
              />
              <Input
                label="Frequency"
                value={draft.frequency}
                onChange={(event) => onDraftChange("frequency", event.target.value)}
              />
              <Input
                label="Quantity"
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(event) => onDraftChange("quantity", Number(event.target.value))}
              />
              <Input
                label="Duration"
                value={draft.duration}
                onChange={(event) => onDraftChange("duration", event.target.value)}
                placeholder="e.g. 90 days"
              />
              <Input
                label="Instructions"
                value={draft.instructions}
                onChange={(event) => onDraftChange("instructions", event.target.value)}
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Reason for change"
                required
                rows={2}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Document why this prescription is being changed"
              />
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={onCancelEditing}>Cancel</Button>
              <Button variant="success" onClick={onReviewChanges}>Review Changes</Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {[
              { label: "Quantity", value: `${medication.quantity} tablets` },
              { label: "Duration", value: medication.duration },
              { label: "Start", value: medication.startDate },
              { label: "End", value: medication.endDate },
            ].map((field) => (
              <div key={field.label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                <div className="text-xs text-slate-400 mb-0.5">{field.label}</div>
                <div className="text-sm font-medium text-slate-800">{field.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 mb-3">
            <div className="text-xs text-slate-400 mb-0.5">Instructions</div>
            <div className="text-sm text-slate-700">{medication.instructions}</div>
          </div>

          {prescription.citations.length > 0 && (
            <details className="border border-teal-100 rounded-xl overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer bg-teal-50 text-sm font-medium text-teal-700 flex items-center gap-2 list-none">
                Evidence for this suggestion ({prescription.citations.length})
              </summary>
              <div className="p-4 space-y-3">
                {prescription.citations.map((citation) => (
                  <div key={citation.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-800">{citation.title}</span>
                      <Badge variant={citation.type === "guideline" ? "outline" : "default"}>
                        {citation.type === "guideline" ? "Guideline" : "Research"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{citation.publisher} · {citation.date}</p>
                    <p className="text-xs text-slate-600 italic mt-1">{citation.relevanceNote}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {prescription.revisions.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Revision History</p>
              <div className="space-y-2">
                {prescription.revisions.map((revision) => (
                  <div key={revision.id} className="text-xs text-slate-500 flex items-start gap-2">
                    <span className="text-slate-300">·</span>
                    <span>
                      {new Date(revision.changedAt).toLocaleString()} — {revision.changedBy}: {revision.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export type { EditableMedicationField };
