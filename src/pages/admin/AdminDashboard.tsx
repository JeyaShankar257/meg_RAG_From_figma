import { useEffect, useState, useCallback } from "react"
import { useSession } from "../../lib/auth/SessionProvider"
import {
  api,
  type DoctorInvitation,
  type OrphanRecord,
} from "../../lib/api/apiClient"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"

interface PracticeCredential {
  id: string
  email: string
  password: string
  role: string
  created_at: string
  updated_at: string
}

export default function AdminDashboard() {
  const { user } = useSession()
  const [invitations, setInvitations] = useState<DoctorInvitation[]>([])
  const [orphans, setOrphans] = useState<OrphanRecord[]>([])
  const [credentials, setCredentials] = useState<PracticeCredential[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [activeTab, setActiveTab] = useState<
    "doctors" | "orphans" | "credentials"
  >("doctors")

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteFullName, setInviteFullName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [useTempPassword, setUseTempPassword] = useState(false)
  const [tempPassword, setTempPassword] = useState("")
  const [sendEmail, setSendEmail] = useState(true)

  // Temp password modal state
  const [tempPasswordModalDoc, setTempPasswordModalDoc] =
    useState<DoctorInvitation | null>(null)
  const [newTempPassword, setNewTempPassword] = useState("")

  const isAdmin = user?.role === "admin"

  const loadData = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError("")
    try {
      const [invitesRes, orphansRes, credsRes] = await Promise.allSettled([
        api.auth.doctorInvitations.list("all"),
        api.auth.orphans.list(),
        api.auth.practiceCredentials.list(),
      ])

      if (invitesRes.status === "fulfilled") {
        setInvitations(invitesRes.value.invitations || [])
      } else {
        setError("Unable to load doctor accounts roster.")
      }

      if (orphansRes.status === "fulfilled") {
        setOrphans(orphansRes.value.orphans || [])
      }

      if (credsRes.status === "fulfilled") {
        setCredentials(credsRes.value.credentials || [])
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load admin roster.")
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    setError("")
    setSuccessMessage("")
    try {
      await api.auth.doctorInvitations.approve(id)
      setSuccessMessage("Doctor account approved successfully.")
      await loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to approve doctor.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this doctor account?"))
      return
    setActionLoading(id)
    setError("")
    setSuccessMessage("")
    try {
      await api.auth.doctorInvitations.reject(id)
      setSuccessMessage("Doctor account marked as rejected.")
      await loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to reject doctor.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleResend = async (id: string) => {
    setActionLoading(id)
    setError("")
    setSuccessMessage("")
    try {
      await api.auth.doctorInvitations.resend(id)
      setSuccessMessage("Invitation email resent successfully.")
    } catch (err: any) {
      setError(err?.message || "Failed to resend invitation email.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleSetTempPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempPasswordModalDoc) return
    if (newTempPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.")
      return
    }

    setActionLoading(tempPasswordModalDoc.id)
    setError("")
    try {
      await api.auth.doctorInvitations.setTemporaryPassword(
        tempPasswordModalDoc.id,
        newTempPassword,
      )
      setSuccessMessage(
        `Temporary password set for ${tempPasswordModalDoc.email}.`,
      )
      setTempPasswordModalDoc(null)
      setNewTempPassword("")
      await loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to set temporary password.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteFullName.trim() || !inviteEmail.trim()) {
      setError("Full name and email are required.")
      return
    }
    if (useTempPassword && tempPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.")
      return
    }

    setActionLoading("create")
    setError("")
    setSuccessMessage("")
    try {
      const res = await api.auth.doctorInvitations.create({
        workspaceId: user?.workspaceId,
        fullName: inviteFullName.trim(),
        email: inviteEmail.trim(),
        temporaryPassword: useTempPassword ? tempPassword : undefined,
        sendInvitationEmail: sendEmail,
      })
      setSuccessMessage(res.message || `Doctor invitation processed for ${inviteEmail.trim()}.`)
      setShowInviteModal(false)
      setInviteFullName("")
      setInviteEmail("")
      setTempPassword("")
      setUseTempPassword(false)
      await loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to invite doctor.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCleanupOrphan = async (orphan: OrphanRecord) => {
    if (
      !window.confirm(`Clean up orphan ${orphan.type} (${orphan.identifier})?`)
    )
      return
    setActionLoading(`orphan-${orphan.id}`)
    setError("")
    try {
      await api.auth.orphans.cleanup(orphan.id, orphan.type)
      setSuccessMessage(`Orphan record ${orphan.identifier} reconciled.`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || "Failed to clean up orphan record.")
    } finally {
      setActionLoading(null)
    }
  }

  const approvedDoctors = invitations.filter(
    (i) => i.approvalStatus === "approved",
  )
  const pendingDoctors = invitations.filter(
    (i) => i.approvalStatus === "pending",
  )

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Physicians Roster & Account Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Oversee active doctor accounts, approve new clinical staff, and
            reconcile database orphans.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void loadData()}
            loading={loading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Refresh
          </Button>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
          >
            + Invite Doctor
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-rose-400 hover:text-white font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-emerald-400 hover:text-white font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Working Doctors
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">
            {approvedDoctors.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Licensed clinical practitioners
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Pending Approvals
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">
            {pendingDoctors.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Awaiting administrator verification
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Database Orphans
          </div>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">
            {orphans.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Unlinked clinical entities
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("doctors")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "doctors"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Doctors Roster ({invitations.length})
        </button>
        <button
          onClick={() => setActiveTab("orphans")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "orphans"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Data Integrity & Orphans ({orphans.length})
        </button>
        <button
          onClick={() => setActiveTab("credentials")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "credentials"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Practice Credentials ({credentials.length})
        </button>
      </div>

      {/* Tab Content: Doctors */}
      {activeTab === "doctors" && (
        <div className="space-y-6">
          {/* Pending Approvals Callout (if any) */}
          {pendingDoctors.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
              <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3">
                Action Required: {pendingDoctors.length} Pending Doctor Account
                {pendingDoctors.length > 1 ? "s" : ""}
              </h2>
              <div className="space-y-3">
                {pendingDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-950/80 rounded-lg border border-amber-500/20 gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {doc.fullName}
                      </div>
                      <div className="text-xs text-slate-400">{doc.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleApprove(doc.id)}
                        loading={actionLoading === doc.id}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        Approve Doctor
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleReject(doc.id)}
                        loading={actionLoading === doc.id}
                        className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Working & Registered Doctors Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Working & Registered Physicians
              </h2>
              <span className="text-xs text-slate-400">
                {invitations.length} Total Registered
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Loading roster...
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No doctors registered yet. Click "+ Invite Doctor" to onboard
                staff.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Doctor Name & Identity</th>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Temporary Password</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invitations.map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">
                            {doc.fullName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {doc.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {doc.email}
                        </td>
                        <td className="px-6 py-4">
                          {doc.approvalStatus === "approved" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Approved
                            </span>
                          ) : doc.approvalStatus === "pending" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pending Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {doc.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Active (Unchanged)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Regular Password
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.approvalStatus === "pending" && (
                              <button
                                onClick={() => void handleApprove(doc.id)}
                                disabled={actionLoading === doc.id}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => void handleResend(doc.id)}
                              disabled={actionLoading === doc.id}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                              Resend Invite
                            </button>
                            <button
                              onClick={() => {
                                setTempPasswordModalDoc(doc)
                                setNewTempPassword("")
                              }}
                              className="text-xs text-slate-400 hover:text-slate-200 font-semibold"
                            >
                              Set Temp Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Orphans */}
      {activeTab === "orphans" && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Database Orphan Scanner
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically detects unlinked patient records, dangling auth
                users, and inconsistent profiles.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadData()}
              loading={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Re-Scan Database
            </Button>
          </div>

          {orphans.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                ✓
              </div>
              No orphaned records found in this workspace. All patient profiles
              and clinical entities are properly linked.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Identifier</th>
                    <th className="px-6 py-3.5">Diagnostic Issue Details</th>
                    <th className="px-6 py-3.5 text-right">Remediation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orphans.map((orphan) => (
                    <tr
                      key={`${orphan.type}-${orphan.id}`}
                      className="hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs uppercase text-indigo-400">
                        {orphan.type}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {orphan.identifier}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-md">
                        {orphan.details}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCleanupOrphan(orphan)}
                          loading={actionLoading === `orphan-${orphan.id}`}
                          className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs"
                        >
                          Clean Up
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Practice Credentials */}
      {activeTab === "credentials" && (
        <div className="space-y-6">
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">
                Practice Credentials Store
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                These credentials are kept unencrypted in the practice_credentials database table for local testing, practice logins, and developer reference.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 self-start sm:self-auto">
              Practice Mode Enabled
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Registered Practice Accounts
              </h2>
              <span className="text-xs text-slate-400">
                {credentials.length} Saved Credentials
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Loading practice credentials...
              </div>
            ) : credentials.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No practice credentials saved yet. Set a temporary or initial password on any account to save it here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Role</th>
                      <th className="px-6 py-3.5">Password (Cleartext)</th>
                      <th className="px-6 py-3.5">Last Updated</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {credentials.map((cred) => (
                      <tr
                        key={cred.id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-6 py-4 font-semibold text-white">
                          {cred.email}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              cred.role === "admin"
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                : cred.role === "doctor"
                                ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            }`}
                          >
                            {cred.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-emerald-400 bg-slate-900/40">
                          {cred.password}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(cred.updated_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(cred.password)
                              setCopiedId(cred.id)
                              setTimeout(() => setCopiedId(null), 2000)
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            {copiedId === cred.id ? "Copied!" : "Copy Password"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Doctor Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">
                Invite & Provision Doctor
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Doctor Full Name
                </label>
                <Input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Dr. Emily Watson, MD"
                  required
                  variant="dark"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.watson@mednova.clinic"
                  required
                  variant="dark"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Send invitation & activation email via Supabase</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTempPassword}
                    onChange={(e) => setUseTempPassword(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Set initial temporary password manually</span>
                </label>
                {useTempPassword && (
                  <div className="mt-2.5 pl-6">
                    <Input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Min 8 characters (e.g. MedNova!2026)"
                      required={useTempPassword}
                      variant="dark"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Doctor will be required to change this upon first login.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                <strong>Practice Tip:</strong> Setting an initial password saves it to the Practice Credentials tab, confirms the email, and activates the doctor for immediate sign-in. If the email is already registered, it updates their password smoothly.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={actionLoading === "create"}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  Create & Provision
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Temporary Password Modal */}
      {tempPasswordModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Set Temporary Password
              </h3>
              <button
                onClick={() => setTempPasswordModalDoc(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Set a temporary password for{" "}
              <strong className="text-white">
                {tempPasswordModalDoc.fullName}
              </strong>{" "}
              ({tempPasswordModalDoc.email}). They will be forced to rotate it
              on login.
            </p>

            <form onSubmit={handleSetTempPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Temporary Password
                </label>
                <Input
                  type="text"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  autoFocus
                  variant="dark"
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTempPasswordModalDoc(null)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={actionLoading === tempPasswordModalDoc.id}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
