import { useState } from "react";
import { DEMO_TRUST_COMPONENTS, DEMO_ADHERENCE } from "../../lib/mockData";
import Card, { CardHeader, CardTitle } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import AdherenceRing from "../../components/charts/AdherenceRing";

export default function Transparency() {
  const [consentMap, setConsentMap] = useState<Record<string, boolean>>({
    care_team: true,
    escalations: true,
    reports: true,
    ai_analysis: false,
  });

  const toggleConsent = (key: string) => {
    setConsentMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const weightedScore = Math.round(
    DEMO_TRUST_COMPONENTS.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
  );

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Data</h1>
        <p className="text-slate-500 text-sm">See what&apos;s tracked, what&apos;s shared, and manage your consent.</p>
      </div>

      {/* Trust score breakdown */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Your Adherence Trust Score</CardTitle>
          <Badge variant="success">84</Badge>
        </CardHeader>

        <div className="flex items-center gap-6 mb-5">
          <AdherenceRing score={weightedScore} size={90} label="Trust" />
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-3">
              Your trust score is calculated from four components. It&apos;s shown to your care team as a clinical signal — not a grade.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_TRUST_COMPONENTS.map((c) => (
            <div key={c.name}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-400 ml-2">weight {c.weight}%</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{c.score}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    c.score >= 85 ? "bg-emerald-500" : c.score >= 65 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* What's tracked */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>What&apos;s Tracked</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {[
            { label: "Dose timestamps", detail: "When you log each dose (method, time, status)" },
            { label: "Reminder delivery", detail: "Whether reminders were delivered, bounced, or failed" },
            { label: "Late logging patterns", detail: "If doses are consistently logged late vs. on time" },
            { label: "Reminder response time", detail: "How quickly you log a dose after a reminder" },
            { label: "Skip/miss history", detail: "Dates and any reasons you provided for skips" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Scheduled vs logged comparison */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Scheduled vs. Logged (Last 30 days)</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Scheduled", value: DEMO_ADHERENCE.taken + DEMO_ADHERENCE.late + DEMO_ADHERENCE.skipped + DEMO_ADHERENCE.missed },
            { label: "Logged", value: DEMO_ADHERENCE.taken + DEMO_ADHERENCE.late + DEMO_ADHERENCE.skipped },
            { label: "Delivery failures", value: DEMO_ADHERENCE.deliveryFailures, note: "Not counted as misses" },
            { label: "True misses", value: DEMO_ADHERENCE.missed, note: "Patient-attributable" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-3 border border-slate-100">
              <div className="text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs font-medium text-slate-600">{s.label}</div>
              {s.note && <div className="text-[10px] text-slate-400 mt-0.5">{s.note}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* Consent controls */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Consent & Sharing</CardTitle>
          <Badge variant="info">Manage</Badge>
        </CardHeader>
        <div className="space-y-3">
          {[
            { key: "care_team", label: "Share adherence data with care team", detail: "Required for clinical monitoring", required: true },
            { key: "escalations", label: "Allow escalation sharing with broader care team", detail: "Notifies nurse coordinator for urgent patterns", required: false },
            { key: "reports", label: "Receive weekly and monthly reports by email", detail: "Encouragement-focused adherence summaries", required: false },
            { key: "ai_analysis", label: "Allow AI diagnostic analysis for my visits", detail: "AI output is advisory only; doctor reviews before any action", required: false },
          ].map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
                {item.required && <p className="text-[10px] text-slate-400 mt-0.5">Required for care</p>}
              </div>
              <button
                onClick={() => !item.required && toggleConsent(item.key)}
                disabled={item.required}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  consentMap[item.key] ? "bg-teal-600" : "bg-slate-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${consentMap[item.key] ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Correction request */}
      <Card padding="md" className="border-dashed border-slate-300 bg-slate-50">
        <p className="text-sm font-medium text-slate-800 mb-1">Request a Data Correction</p>
        <p className="text-xs text-slate-500 mb-3">If you believe a dose log, adherence record, or AI classification is incorrect, you can request a review from your care team.</p>
        <button className="text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer transition-colors">
          Submit Correction Request →
        </button>
      </Card>
    </div>
  );
}
