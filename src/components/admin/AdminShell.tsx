import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useSession } from "../../lib/auth/SessionProvider"

export default function AdminShell() {
  const navigate = useNavigate()
  const { user, signOut } = useSession()

  const handleSignOut = () => {
    void signOut().then(() => navigate("/admin/login"))
  }

  const adminName = user?.fullName || "System Administrator"
  const adminEmail = user?.email || "admin@mednova.clinic"
  const workspaceLabel = user?.workspaceId
    ? `Workspace: ${user.workspaceId.slice(0, 8)}…`
    : "Primary Workspace"

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
        {/* Logo & Portal Identity */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/30">
              <svg
                viewBox="0 0 24 24"
                className="fill-white"
                width={16}
                height={16}
              >
                <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight">
                MedNova
              </div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* Administrator Profile Card */}
        <div className="px-4 py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
              AD
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">
                {adminName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {workspaceLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Governance & Staff
          </p>

          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`
            }
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 3s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
            Physicians Roster
          </NavLink>

          <div className="pt-4">
            <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              System Links
            </p>
            <NavLink
              to="/doctor"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-teal-400 hover:bg-slate-900 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
              View Doctor Portal
            </NavLink>
            <NavLink
              to="/patient"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
              View Patient Portal
            </NavLink>
          </div>
        </nav>

        {/* Footer / Sign Out */}
        <div className="p-3 border-t border-slate-800/80">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <span className="truncate">{adminEmail}</span>
            <span className="font-semibold">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              MEDNOVA-ADMIN-CONSOLE
            </span>
          </div>
          <div className="text-xs text-slate-400">
            System Status:{" "}
            <span className="text-emerald-400 font-medium">
              ● Operating Normally
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
