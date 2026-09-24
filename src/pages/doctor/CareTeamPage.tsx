import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { DEMO_PATIENTS, DEMO_ESCALATIONS, DEMO_PIPELINE_STAGES, DEMO_CARE_TEAM, DEMO_SPARKLINE } from "../../lib/mockData";
import type { PipelineStage } from "../../lib/types";
import Card, { CardHeader, CardTitle } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import ScoreTrendChart from "../../components/charts/ScoreTrendChart";

export default function CareTeamPage() {
  const { patientId } = useParams();
  const patient = DEMO_PATIENTS.find((p) => p.id === patientId) || DEMO_PATIENTS[2];
  const escalations = DEMO_ESCALATIONS.filter((e) => e.patientId === patient.id);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(DEMO_PIPELINE_STAGES);

  useEffect(() => {
    const triggered = sessionStorage.getItem("pipeline_triggered");
    if (!triggered) return;
    sessionStorage.removeItem("pipeline_triggered");

    const newLog1 = { id: "l-triggered-1", timestamp: new Date().toISOString(), level: "info" as const, message: "Dose schedule generated for new AI-approved prescription", metadata: { patientId: patient.patientId } };
    const newLog3 = { id: "l-triggered-3", timestamp: new Date().toISOString(), level: "info" as const, message: "Initial pattern eval: new prescription, no data yet, severity: none", metadata: { model: "gemini-2.0-flash-001" } };

    // Stage 1 (Reminder Agent): running → complete
    setPipelineStages((prev) => prev.map((s) => s.id === "stage-1" ? { ...s, status: "running" } : s));
    setTimeout(() => {
      setPipelineStages((prev) => prev.map((s) => s.id === "stage-1" ? { ...s, status: "complete", lastRun: new Date().toISOString(), logs: [newLog1, ...s.logs] } : s));
    }, 1500);

    // Stage 3 (Pattern Detection): running → complete
    setTimeout(() => {
      setPipelineStages((prev) => prev.map((s) => s.id === "stage-3" ? { ...s, status: "running" } : s));
    }, 2000);
    setTimeout(() => {
      setPipelineStages((prev) => prev.map((s) => s.id === "stage-3" ? { ...s, status: "complete", lastRun: new Date().toISOString(), logs: [newLog3, ...s.logs] } : s));
    }, 3500);
  }, [patient.patientId]);

  const stageStatusColor: Record<string, string> = {
    idle: "bg-slate-200 text-slate-600",
    running: "bg-cyan-100 text-cyan-700",
    complete: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="p-6 max-w-5xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/doctor/patients/${patient.id}`} className="text-sm text-teal-600 hover:text-teal-700 font-medium">
              ← {patient.name}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Care Team View</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patient.patientId} · Pipeline status and escalation management</p>
        </div>
      </div>

      {/* Escalation banners */}
      {escalations.map((esc) => (
        <div key={esc.id} className={`rounded-xl border p-5 animate-slide-in-up ${
          esc.severity === "urgent" ? "bg-rose-50 border-rose-200" :
          esc.severity === "concerning" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                esc.severity === "urgent" ? "bg-rose-100" : "bg-amber-100"
              }`}>
                <svg viewBox="0 0 24 24" className={esc.severity === "urgent" ? "fill-rose-600" : "fill-amber-600"} width={18} height={18}>
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`font-semibold text-sm ${esc.severity === "urgent" ? "text-rose-800" : "text-amber-800"}`}>
                    AI Escalation — {esc.severity.charAt(0).toUpperCase() + esc.severity.slice(1)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    esc.status === "open" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                  }`}>{esc.status}</span>
                </div>
                <p className={`text-sm font-medium ${esc.severity === "urgent" ? "text-rose-700" : "text-amber-700"}`}>{esc.rootCause}</p>
                <p className={`text-sm mt-1 leading-relaxed ${esc.severity === "urgent" ? "text-rose-700" : "text-amber-700"} opacity-80`}>{esc.explanation}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Confidence: <strong>{Math.round(esc.confidence * 100)}%</strong></span>
                  <span>·</span>
                  <span>Model: <strong className="font-mono">{esc.aiModelVersion}</strong></span>
                  <span>·</span>
                  <span>{new Date(esc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {esc.status === "open" && !acknowledged.has(esc.id) && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => {
                    const next = new Set(acknowledged);
                    next.add(esc.id);
                    setAcknowledged(next);
                  }}>
                    Acknowledge
                  </Button>
                  <Button size="sm" variant="primary">Respond</Button>
                </>
              )}
              {acknowledged.has(esc.id) && (
                <span className="text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  ✓ Acknowledged
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Pipeline stages */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Five-Agent Pipeline</CardTitle>
          <Badge variant="ai">Fully AI-driven pattern detection</Badge>
        </CardHeader>

        {/* Stage flow */}
        <div className="flex items-start gap-0 overflow-x-auto pb-4 mb-5">
          {pipelineStages.map((stage, i) => (
            <div key={stage.id} className="flex items-center flex-shrink-0">
              <div
                className={`flex flex-col items-center text-center cursor-pointer group w-32 ${
                  expandedLog === stage.id ? "opacity-100" : "opacity-80 hover:opacity-100"
                }`}
                onClick={() => setExpandedLog(expandedLog === stage.id ? null : stage.id)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mb-2 border-2 ${
                  stage.status === "complete" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                  stage.status === "running" ? "bg-cyan-50 border-cyan-300 text-cyan-700" :
                  stage.status === "error" ? "bg-rose-50 border-rose-300 text-rose-700" :
                  "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  {i + 1}
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-tight">{stage.name}</p>
                <span className={`mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stageStatusColor[stage.status]}`}>
                  {stage.status}
                </span>
                {stage.lastRun && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(stage.lastRun).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              {i < pipelineStages.length - 1 && (
                <div className="flex items-center mx-1 -mt-6">
                  <div className="w-6 h-0.5 bg-slate-200" />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12} className="text-slate-300">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agent logs */}
        {expandedLog && (() => {
          const stage = pipelineStages.find((s) => s.id === expandedLog);
          if (!stage) return null;
          return (
            <div className="border-t border-slate-100 pt-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">{stage.name} — Recent Logs</p>
                <span className="text-xs font-mono text-slate-400">{stage.agentName}</span>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
                {stage.logs.map((log) => (
                  <div key={log.id} className={`flex gap-2 ${
                    log.level === "error" ? "text-rose-400" :
                    log.level === "warn" ? "text-amber-400" : "text-slate-300"
                  }`}>
                    <span className="text-slate-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className={`uppercase text-[10px] font-bold flex-shrink-0 ${
                      log.level === "error" ? "text-rose-500" : log.level === "warn" ? "text-amber-500" : "text-teal-500"
                    }`}>[{log.level}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Adherence trend + care team */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card padding="md">
          <CardHeader>
            <CardTitle>Trust Score Trend</CardTitle>
          </CardHeader>
          <ScoreTrendChart data={DEMO_SPARKLINE} height={160} />
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>Care Team</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {DEMO_CARE_TEAM.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs flex-shrink-0">
                  {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
