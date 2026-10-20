import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { useSession } from "../../lib/auth/SessionProvider"

export default function AdminLogin() {
  const navigate = useNavigate()
  const { signIn } = useSession()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    void signIn(email, password, "admin")
      .then(() => navigate("/admin"))
      .catch((loginError: Error) =>
        setError(loginError.message || "Invalid administrative credentials."),
      )
      .finally(() => setLoading(false))
  }

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex w-[440px] bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 flex-col justify-between p-10 border-r border-slate-800 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg
              viewBox="0 0 24 24"
              className="fill-white"
              width={16}
              height={16}
            >
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
            </svg>
          </div>
          <span className="text-white font-semibold tracking-tight">
            MedNova Admin
          </span>
        </Link>

        <div>
          <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-6">
            <svg
              viewBox="0 0 24 24"
              className="fill-indigo-400"
              width={28}
              height={28}
            >
              <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold mb-3">
            System Administration
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Restricted access for system administrators. Manage physician
            provisioning, approval queues, credential governance, and orphan
            reconciliations.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Physician directory & roster management",
              "Doctor invitation & temporary passwords",
              "Pending approval gate & credentials",
              "Database orphan reconciliation & integrity",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5 text-slate-300 text-sm"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width={10}
                    height={10}
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          MedNova Enterprise Security · Audit Level 3
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 max-w-md mx-auto w-full">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            Security Clearance Required
          </div>
          <h2 className="text-2xl font-bold text-white">
            Administrator Sign In
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Enter your authorized administrative credentials.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300 flex items-start gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Admin Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mednova.clinic"
              required
              autoFocus
              variant="dark"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              variant="dark"
            />
          </div>

          <Button
            type="submit"
            className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
            loading={loading}
          >
            {loading ? "Authenticating..." : "Sign In to Admin Portal"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Portal Selection
          </Link>
        </div>
      </div>
    </div>
  )
}
