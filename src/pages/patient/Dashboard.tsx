import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AdherenceRing from "../../components/charts/AdherenceRing";
import TrendSparkline from "../../components/charts/TrendSparkline";
import { api, getPatientId, isBackendConfigured } from "../../lib/api/apiClient";
import { useSession } from "../../lib/auth/SessionProvider";

type PatientMedication = {
  id: string;
  medication: {
    name: string;
    strength: string;
    unit: string;
    frequency: string;
    nextDose: string;
  };
};

type AdherenceSummary = {
  score: number;
  trend: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  deliveryFailures: number;
};

function summarizeAdherence(logs: Array<{ status?: string }>): AdherenceSummary {
  const summary: AdherenceSummary = {
    score: 0,
    trend: 0,
    taken: 0,
    late: 0,
    skipped: 0,
    missed: 0,
    deliveryFailures: 0,
  };
  summary.taken = logs.filter((log) => log.status === "taken").length;
  summary.late = logs.filter((log) => log.status === "late").length;
  summary.missed = logs.filter((log) => log.status === "missed").length;
  summary.skipped = logs.filter((log) => log.status === "skipped").length;
  const completed = summary.taken + summary.late + summary.missed + summary.skipped;
  summary.score = completed
    ? Math.round(((summary.taken + summary.late) / completed) * 100)
    : 0;
  return summary;
}

function useCountdown(targetTime: string) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const [h, m] = targetTime.split(":").map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const diff = target.getTime() - now.getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${hours}h ${mins}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [targetTime]);
  return remaining;
}

export default function PatientDashboard() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [activeMeds, setActiveMeds] = useState<PatientMedication[]>([]);
  const [adherence, setAdherence] = useState<AdherenceSummary>(() => summarizeAdherence([]));
  const [loading, setLoading] = useState(isBackendConfigured());
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isBackendConfigured() || !user) return;
    Promise.all([
      api.patients.getMedications(getPatientId(user)),
      api.patients.getAdherence(getPatientId(user)),
    ])
      .then(([medicationResult, adherenceResult]) => {
        setActiveMeds(
          medicationResult.medications.map((medication) => ({
            id: String(medication.id),
            medication: {
              name: String(medication.name ?? "Medication"),
              strength: String(medication.dosage ?? ""),
              unit: "",
              frequency: String(medication.form ?? ""),
              nextDose: "See dose schedule",
            },
          })),
        );
        setAdherence(summarizeAdherence(adherenceResult.logs));
      })
      .catch(() => setError("Dashboard data could not be loaded."))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Your care summary</h1>
        <p className="text-slate-500 text-sm">{new Date().toLocaleDateString()}</p>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading your care summary…</p>}
      {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>}

      {/* Next dose countdown */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg shadow-teal-600/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-200 text-sm font-medium mb-1">Next Dose Due</p>
            <p className="text-2xl font-bold">
              {activeMeds[0]
                ? `${activeMeds[0].medication.name} ${activeMeds[0].medication.strength}${activeMeds[0].medication.unit}`
                : "No upcoming dose"}
            </p>
            <p className="text-teal-200 text-sm mt-0.5">
              {activeMeds[0]?.medication.frequency || "Your schedule will appear here"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">—</div>
            <div className="text-teal-200 text-xs">live schedule</div>
          </div>
        </div>
        <Button
          className="mt-4 bg-white text-teal-700 hover:bg-teal-50 border-0 shadow-none"
          size="sm"
          onClick={() => navigate("/patient/doses")}
        >
          View All Doses
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm">
          <div className="text-lg font-bold text-emerald-600">{adherence.taken}</div>
          <div className="text-xs text-slate-500 mt-0.5">Taken</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
        <Card padding="sm">
          <div className="text-lg font-bold text-amber-500">{adherence.late}</div>
          <div className="text-xs text-slate-500 mt-0.5">Late</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
        <Card padding="sm">
          <div className="text-lg font-bold text-rose-500">{adherence.missed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Missed</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
      </div>

      {/* Adherence ring + trend */}
      <Card padding="md">
        <div className="flex items-center gap-5">
          <AdherenceRing score={adherence.score} size={100} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-slate-900">Overall Adherence</h3>
              <Badge variant={adherence.trend >= 0 ? "success" : "warning"}>
                {adherence.trend >= 0 ? "↑" : "↓"} {Math.abs(adherence.trend)}%
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mb-3">Your score has improved over the last 3 months. Keep it up!</p>
            <div className="h-10">
              <p className="text-xs text-slate-400">Trend data will appear as adherence is recorded.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Current medications */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Current Medications</h2>
        <div className="space-y-2">
          {activeMeds.map((rx) => (
            <Card key={rx.id} padding="md" hover onClick={() => navigate("/patient/doses")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="fill-teal-600" width={18} height={18}>
                      <path d="M10.5 19.5h3v-6h6v-3h-6v-6h-3v6h-6v3h6z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{rx.medication.name} {rx.medication.strength}{rx.medication.unit}</p>
                    <p className="text-xs text-slate-500">{rx.medication.frequency}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">Next dose</p>
                  <p className="text-xs font-medium text-teal-700">{rx.medication.nextDose}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Care team message */}
      <Card padding="md" className="bg-cyan-50 border-cyan-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-200 flex items-center justify-center text-cyan-700 font-bold text-xs flex-shrink-0">SC</div>
          <div>
            <p className="text-xs text-cyan-600 font-medium mb-1">Dr. Jeya Shankar M · Care Team Message</p>
            <p className="text-sm text-cyan-900">Your HbA1c is trending down — great progress with your medication routine. Keep logging your afternoon dose on time!</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
