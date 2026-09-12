import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_PATIENTS, DEMO_ESCALATIONS } from "../../lib/mockData";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import TrustBadge from "../../components/ui/TrustBadge";
import TrendSparkline from "../../components/charts/TrendSparkline";

const recentActivity = [
  { time: "09:32", text: "Marcus Rivera logged morning Metformin dose — on time", type: "success" },
  { time: "08:14", text: "Pattern detection run completed for all active patients", type: "info" },
  { time: "07:00", text: "Morning reminders sent to 3 patients (2 delivered, 1 retry)", type: "info" },
  { time: "Yesterday", text: "David Kowalski escalation created — urgent, 18 missed doses", type: "error" },
  { time: "Yesterday", text: "Sofia Patel invitation email sent — awaiting activation", type: "info" },
];

const sparkData = [
  [{ date: "d1", value: 71 }, { date: "d2", value: 75 }, { date: "d3", value: 79 }, { date: "d4", value: 84 }],
  [{ date: "d1", value: 88 }, { date: "d2", value: 90 }, { date: "d3", value: 91 }, { date: "d4", value: 92 }],
  [{ date: "d1", value: 58 }, { date: "d2", value: 52 }, { date: "d3", value: 47 }, { date: "d4", value: 41 }],
  [{ date: "d1", value: 0 }, { date: "d2", value: 0 }, { date: "d3", value: 0 }, { date: "d4", value: 0 }],
];

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchId, setSearchId] = useState("");

  const filtered = DEMO_PATIENTS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEscalations = DEMO_ESCALATIONS.filter((e) => e.status === "open");

  return (
    <div className="p-6 max-w-7xl space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Saturday, September 12, 2026</p>
        </div>
        <Button onClick={() => navigate("/doctor/patients/new")} icon={<PlusIcon />}>
          Add New Patient
        </Button>
      </div>

      {/* Escalation banner */}
      {openEscalations.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 animate-slide-in-up">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse-ring">
                <svg viewBox="0 0 24 24" className="fill-rose-600" width={16} height={16}>
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-rose-800">
                  {openEscalations.length} Active Escalation{openEscalations.length > 1 ? "s" : ""} Requiring Attention
                </div>
                {openEscalations.map((esc) => (
                  <div key={esc.id} className="mt-1.5 text-sm text-rose-700">
                    <span className="font-medium">{esc.patientName}</span> — {esc.rootCause}
                    <span className="ml-2 bg-rose-100 text-rose-700 text-xs px-1.5 py-0.5 rounded-full font-medium border border-rose-200">
                      {esc.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => navigate("/doctor/patients/p-003/care-team")}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Patients", value: "4", sub: "3 active, 1 invited", color: "teal" },
          { label: "Avg Adherence", value: "72%", sub: "3 monitored patients", color: "teal" },
          { label: "Open Escalations", value: String(openEscalations.length), sub: "Requires review", color: "rose" },
          { label: "Reminders Sent", value: "12", sub: "Today, 2 retried", color: "slate" },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <div className={`text-2xl font-bold mb-0.5 ${stat.color === "rose" ? "text-rose-600" : "text-slate-900"}`}>
              {stat.value}
            </div>
            <div className="text-sm font-medium text-slate-700">{stat.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{stat.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Assigned Patients</h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or ID…"
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((patient, i) => (
              <Card
                key={patient.id}
                hover
                onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                className="animate-slide-in-up"
                style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                    {patient.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{patient.name}</span>
                      <span className="text-xs font-mono text-slate-400">{patient.patientId}</span>
                      <StatusPill status={patient.status} />
                      {patient.hasEscalation && (
                        <Badge variant="error" dot>Escalation</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {patient.conditions.join(" · ")} · Last visit {patient.lastVisit}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {patient.status === "active" && (
                      <>
                        <TrustBadge score={patient.adherenceScore} trend={patient.trend} size="sm" />
                        <div className="w-20 h-8">
                          <TrendSparkline
                            data={sparkData[i] || sparkData[0]}
                            color={patient.trend === "down" ? "#e11d48" : "#0d9488"}
                          />
                        </div>
                      </>
                    )}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} className="text-slate-400 flex-shrink-0">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Patient ID lookup */}
          <Card padding="md" className="border-dashed border-2 border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Look up by Patient ID (PT-XXXXX)…"
                className="flex-1 text-sm bg-transparent border-0 outline-none text-slate-700 placeholder-slate-400 font-mono"
              />
              <Button size="sm" variant="outline">Look Up</Button>
            </div>
          </Card>
        </div>

        {/* Activity feed */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <Card padding="none">
            <div className="divide-y divide-slate-100">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex gap-3 p-4">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    item.type === "error" ? "bg-rose-500" :
                    item.type === "success" ? "bg-emerald-500" : "bg-slate-300"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">{item.text}</p>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick add card */}
          <Card padding="md" className="bg-teal-50 border-teal-100">
            <h3 className="text-sm font-semibold text-teal-800 mb-1">Add New Patient</h3>
            <p className="text-xs text-teal-700 mb-3">Register a new patient and send them an activation email.</p>
            <Button variant="outline" size="sm" fullWidth onClick={() => navigate("/doctor/patients/new")}>
              Start Registration
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
