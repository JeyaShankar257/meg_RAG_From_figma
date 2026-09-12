import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Landing() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 relative overflow-hidden">
      {/* Background mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-600/5 rounded-full blur-3xl" />

        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
            <svg viewBox="0 0 24 24" className="fill-white" width={18} height={18}>
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-4-4 1.4-1.4 2.6 2.6 5.6-5.6L19 10l-7 7z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">MedNova</span>
        </div>
        <span className="text-teal-400/70 text-xs font-medium border border-teal-500/20 px-3 py-1 rounded-full">
          Demo Environment
        </span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-16">
        {/* Animated medical cross */}
        <div className="relative mb-10 flex items-center justify-center">
          <div
            className={`w-20 h-20 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center transition-all duration-700 ${pulse ? "shadow-[0_0_30px_rgba(20,184,166,0.3)]" : "shadow-[0_0_10px_rgba(20,184,166,0.1)]"}`}
          >
            <svg viewBox="0 0 24 24" className="fill-teal-400" width={36} height={36}>
              <path d="M10.5 19.5h3v-6h6v-3h-6v-6h-3v6h-6v3h6z" />
            </svg>
          </div>
          <div className="absolute -inset-4 rounded-3xl border border-teal-500/10 animate-pulse" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white text-center mb-4 leading-tight tracking-tight">
          Medication Adherence
          <span className="block text-teal-400">Monitoring Platform</span>
        </h1>
        <p className="text-slate-400 text-center max-w-xl text-base leading-relaxed mb-12">
          AI-powered clinical decision support for doctors and patients. Track adherence, detect patterns, and deliver better care — together.
        </p>

        {/* Portal cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
          {/* Doctor card */}
          <button
            onClick={() => navigate("/doctor/login")}
            className="flex-1 group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/40 rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-xl hover:shadow-teal-900/30 hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-teal-500/30 transition-colors">
              <svg viewBox="0 0 24 24" className="fill-teal-400" width={24} height={24}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">Doctor Login</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Review patients, analyze adherence, run AI diagnostics, manage prescriptions, and respond to escalations.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Patient Records", "AI Assistant", "Prescriptions", "Escalations"].map((tag) => (
                <span key={tag} className="text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-teal-400 text-sm font-medium">
              Enter Doctor Portal
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} className="group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {/* Patient card */}
          <button
            onClick={() => navigate("/patient/login")}
            className="flex-1 group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-xl hover:shadow-cyan-900/30 hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-cyan-500/30 transition-colors">
              <svg viewBox="0 0 24 24" className="fill-cyan-400" width={24} height={24}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">Patient Login</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Log your doses, view visit history, track your adherence, and understand your care plan.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Dose Logging", "Visit History", "My Reports", "My Data"].map((tag) => (
                <span key={tag} className="text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-cyan-400 text-sm font-medium">
              Enter Patient Portal
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} className="group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        </div>

        {/* Safety notice */}
        <div className="mt-10 flex items-center gap-2 text-slate-500 text-xs border border-slate-700 rounded-full px-4 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={12} height={12}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          AI provides decision support only — no AI diagnoses or prescribes. Doctors remain in full clinical control.
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-6 text-slate-600 text-xs">
        © 2026 MedNova · Fictional demo data · Not for clinical use without authorization
      </footer>
    </div>
  );
}
