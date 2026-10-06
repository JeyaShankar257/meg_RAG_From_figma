import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_PRESCRIPTIONS, DEMO_ADHERENCE, DEMO_SPARKLINE } from "../../lib/mockData";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AdherenceRing from "../../components/charts/AdherenceRing";
import TrendSparkline from "../../components/charts/TrendSparkline";

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
  const navigate = useNavigate();
  const nextDose = useCountdown("19:00");
  const activeMeds = DEMO_PRESCRIPTIONS.filter((rx) => rx.status === "active");

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Good morning, Marcus</h1>
        <p className="text-slate-500 text-sm">Saturday, September 12, 2026 · PT-00231</p>
      </div>

      {/* Next dose countdown */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg shadow-teal-600/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-200 text-sm font-medium mb-1">Next Dose Due</p>
            <p className="text-2xl font-bold">Metformin 1000mg</p>
            <p className="text-teal-200 text-sm mt-0.5">Today, 7:00 PM · with dinner</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">{nextDose}</div>
            <div className="text-teal-200 text-xs">remaining</div>
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
          <div className="text-lg font-bold text-emerald-600">{DEMO_ADHERENCE.taken}</div>
          <div className="text-xs text-slate-500 mt-0.5">Taken</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
        <Card padding="sm">
          <div className="text-lg font-bold text-amber-500">{DEMO_ADHERENCE.late}</div>
          <div className="text-xs text-slate-500 mt-0.5">Late</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
        <Card padding="sm">
          <div className="text-lg font-bold text-rose-500">{DEMO_ADHERENCE.missed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Missed</div>
          <div className="text-[10px] text-slate-400">Last 30 days</div>
        </Card>
      </div>

      {/* Adherence ring + trend */}
      <Card padding="md">
        <div className="flex items-center gap-5">
          <AdherenceRing score={84} size={100} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-slate-900">Overall Adherence</h3>
              <Badge variant="success">↑ +6.2%</Badge>
            </div>
            <p className="text-xs text-slate-500 mb-3">Your score has improved over the last 3 months. Keep it up!</p>
            <div className="h-10">
              <TrendSparkline data={DEMO_SPARKLINE} color="#0d9488" />
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
