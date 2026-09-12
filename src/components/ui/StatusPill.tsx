type PillStatus = "active" | "invited" | "pending" | "open" | "acknowledged" | "resolved" | "taken" | "late" | "skipped" | "missed" | "improving" | "stable" | "declining";

const config: Record<PillStatus, { label: string; classes: string; dot: string }> = {
  active: { label: "Active", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  invited: { label: "Invited", classes: "bg-cyan-50 text-cyan-700 border border-cyan-200", dot: "bg-cyan-500" },
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  open: { label: "Open", classes: "bg-rose-50 text-rose-700 border border-rose-200", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", classes: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  resolved: { label: "Resolved", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  taken: { label: "Taken", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  late: { label: "Late", classes: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  skipped: { label: "Skipped", classes: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" },
  missed: { label: "Missed", classes: "bg-rose-50 text-rose-700 border border-rose-200", dot: "bg-rose-500" },
  improving: { label: "Improving", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  stable: { label: "Stable", classes: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" },
  declining: { label: "Declining", classes: "bg-rose-50 text-rose-700 border border-rose-200", dot: "bg-rose-500" },
};

export default function StatusPill({ status, className = "" }: { status: PillStatus; className?: string }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${c.classes} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
