import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { DEMO_ESCALATIONS } from "../../lib/mockData";

const navItems = [
  { to: "/doctor", label: "Dashboard", icon: HomeIcon, exact: true },
  { to: "/doctor/patients/p-001", label: "Patients", icon: UsersIcon, exact: false },
  { to: "/doctor/settings", label: "Settings", icon: SettingsIcon, exact: true },
];

export default function DoctorShell() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const openEscalations = DEMO_ESCALATIONS.filter((e) => e.status === "open");

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white fill-white" width={18} height={18}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">MedNova</div>
              <div className="text-[10px] text-teal-600 font-medium uppercase tracking-wide">Doctor Portal</div>
            </div>
          </div>
        </div>

        {/* Doctor info */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-teal-50">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">SC</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">Dr. Jeya Shankar M</div>
              <div className="text-xs text-slate-500">Internal Medicine</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLink
            to="/doctor"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <HomeIcon />
            Dashboard
          </NavLink>

          <div className="pt-2">
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Patients</p>
            {[
              { to: "/doctor/patients/p-001", label: "Marcus Rivera", id: "PT-00231", hasAlert: false },
              { to: "/doctor/patients/p-002", label: "Amara Osei", id: "PT-00247", hasAlert: false },
              { to: "/doctor/patients/p-003", label: "David Kowalski", id: "PT-00253", hasAlert: true },
              { to: "/doctor/patients/p-004", label: "Sofia Patel", id: "PT-00261", hasAlert: false },
            ].map((p) => (
              <NavLink
                key={p.to}
                to={p.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group ${
                    isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.hasAlert ? "bg-rose-500 animate-pulse-ring" : "bg-slate-300"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{p.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                </div>
              </NavLink>
            ))}
          </div>

          <div className="pt-2">
            <NavLink
              to="/doctor/patients/new"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-teal-600 hover:bg-teal-50 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Add New Patient
            </NavLink>
          </div>
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-slate-100 space-y-0.5">
          <NavLink
            to="/doctor/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <SettingsIcon />
            Settings
          </NavLink>
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-slate-400">Demo Workspace</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">Demo Data</span>
          </div>
          <div className="flex items-center gap-3">
            {openEscalations.length > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer hover:bg-rose-100 transition-colors"
                onClick={() => navigate("/doctor")}>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {openEscalations.length} Active Escalation{openEscalations.length > 1 ? "s" : ""}
              </div>
            )}
            <button
              className="relative w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <BellIcon />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
