import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/patient", label: "Home", icon: HomeIcon, end: true },
  { to: "/patient/doses", label: "Doses", icon: PillIcon, end: false },
  { to: "/patient/visits", label: "Visits", icon: CalendarIcon, end: false },
  { to: "/patient/transparency", label: "My Data", icon: ShieldIcon, end: false },
  { to: "/patient/reports", label: "Reports", icon: ChartIcon, end: false },
];

export default function PatientShell() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden flex-col">
      {/* Top header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 lg:px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="fill-white" width={14} height={14}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">MedNova</div>
            <div className="text-[10px] text-teal-600 font-medium">Patient Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">Demo</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">MR</div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">Marcus Rivera</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-56 bg-white border-r border-slate-200 flex-col p-3 gap-0.5">
          <div className="px-3 py-1 mb-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Navigation</div>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
          <div className="mt-auto pt-3 border-t border-slate-100">
            <NavLink
              to="/patient/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <SettingsIcon />
              Settings
            </NavLink>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden bg-white border-t border-slate-200 flex h-16 flex-shrink-0">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
              }`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/patient/settings"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          <SettingsIcon />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}

function HomeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}

function PillIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" /><circle cx="18" cy="18" r="4" /><path d="m15.5 18 2 2 3-3" /></svg>;
}

function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}

function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}

function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}

function SettingsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}
