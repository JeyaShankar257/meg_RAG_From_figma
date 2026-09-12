import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function PatientLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("m.rivera@email.com");
  const [password, setPassword] = useState("demo-password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (email && password) {
        navigate("/patient");
      } else {
        setError("Please enter your credentials.");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex w-[420px] bg-gradient-to-b from-cyan-800 to-cyan-900 flex-col justify-between p-10 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="fill-white" width={16} height={16}>
              <path d="M10.5 19.5h3v-6h6v-3h-6v-6h-3v6h-6v3h6z" />
            </svg>
          </div>
          <span className="text-white font-semibold">MedNova</span>
        </Link>

        <div>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" className="fill-white" width={28} height={28}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold mb-3">Patient Portal</h1>
          <p className="text-cyan-200 text-sm leading-relaxed">
            Track your medication adherence, log doses, view visit history, and understand your care plan.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Log doses and track adherence",
              "View visit history and notes",
              "Read weekly and monthly reports",
              "See what your care team tracks",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-cyan-200 text-sm">
                <div className="w-4 h-4 rounded-full bg-cyan-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="currentColor" width={10} height={10}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="text-cyan-300/60 text-xs">Your data is private and shared only with your authorized care team.</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <Link to="/" className="flex items-center gap-2 mb-8 text-slate-500 hover:text-slate-700 text-sm transition-colors lg:hidden">
            ← Back to portal selection
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Patient Login</h2>
            <p className="text-slate-500 text-sm">Sign in with the email your doctor registered.</p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-teal-600" defaultChecked />
                Remember me
              </label>
              <button type="button" className="text-cyan-600 hover:text-cyan-700 font-medium cursor-pointer">
                Forgot password?
              </button>
            </div>

            <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2 bg-cyan-600 hover:bg-cyan-700">
              Sign In to Patient Portal
            </Button>
          </form>

          <div className="mt-6 p-4 bg-cyan-50 border border-cyan-100 rounded-lg">
            <p className="text-xs text-cyan-700 font-medium mb-1">Demo credentials pre-filled</p>
            <p className="text-xs text-cyan-600">Logged in as Marcus Rivera (PT-00231). Demo environment with fictional data.</p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Are you a doctor?{" "}
            <Link to="/doctor/login" className="text-teal-600 hover:text-teal-700 font-medium">
              Go to Doctor Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
