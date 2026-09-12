import { DEMO_REPORTS } from "../../lib/mockData";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatusPill from "../../components/ui/StatusPill";
import AdherenceRing from "../../components/charts/AdherenceRing";

const TREND_EMOJIS: Record<string, string> = {
  improving: "↑",
  stable: "→",
  declining: "↓",
};

const ENCOURAGEMENTS: Record<string, string> = {
  improving: "You're making real progress. Keep building the habit!",
  stable: "Staying consistent — that's the foundation of good adherence.",
  declining: "This week was tougher, but tomorrow is a new start.",
};

export default function Reports() {
  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm">Your weekly and monthly adherence reports.</p>
      </div>

      {DEMO_REPORTS.map((report, i) => (
        <Card key={report.id} padding="md" className="animate-slide-in-up" style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={report.period === "monthly" ? "info" : "default"} size="sm">
                  {report.period === "weekly" ? "Weekly Report" : "Monthly Report"}
                </Badge>
                <StatusPill status={report.trend} />
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {report.startDate} → {report.endDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AdherenceRing score={report.adherencePercent} size={70} strokeWidth={8} animate={i === 0} />
            </div>
          </div>

          {/* Headline stat */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold text-teal-700">{report.adherencePercent}%</span>
                <span className="text-teal-500 ml-2 text-sm font-medium">{TREND_EMOJIS[report.trend]} {report.trend}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">{report.missedDays} missed day{report.missedDays !== 1 ? "s" : ""}</p>
                <p className="text-xs text-slate-500">this period</p>
              </div>
            </div>
            <p className="text-sm text-teal-700 mt-2 italic">{ENCOURAGEMENTS[report.trend]}</p>
          </div>

          {/* Insights */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Highlights</p>
            {report.insights.map((insight, j) => (
              <div key={j} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="text-teal-500 mt-0.5 flex-shrink-0">·</span>
                {insight}
              </div>
            ))}
          </div>

          {report.deliveredAt && (
            <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-50 pt-3">
              Delivered {new Date(report.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} via email
            </p>
          )}
        </Card>
      ))}

      {/* Empty state for future reports */}
      <Card padding="md" className="text-center bg-slate-50 border-dashed border-slate-200">
        <p className="text-sm text-slate-500 mb-1">Next weekly report</p>
        <p className="text-sm font-medium text-slate-700">September 15 — September 21, 2026</p>
        <p className="text-xs text-slate-400 mt-1">Will be delivered by email on Sep 22</p>
      </Card>
    </div>
  );
}
