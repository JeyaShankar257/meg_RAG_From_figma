import { useEffect, useState, useCallback } from "react"
import { useSession } from "../../lib/auth/SessionProvider"
import { api, type DoctorInvitation, type OrphanRecord } from "../../lib/api/apiClient"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"

export default function AdminDoctorManagement() {
  const { user } = useSession()
  const [invitations, setInvitations] = useState<DoctorInvitation[]>([])
  const [orphans, setOrphans] = useState<OrphanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteFullName, setInviteFullName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [useTempPassword, setUseTempPassword] = useState(false)
  const [tempPassword, setTempPassword] = useState("")
  const [sendEmail, setSendEmail] = useState(true)

  // Temp password modal state
  const [tempPasswordModalDoc, setTempPasswordModalDoc] = useState<DoctorInvitation | null>(null)
  const [newTempPassword, setNewTempPassword] = useState("")

  const isAdmin = user?.role === "admin"

  const loadData = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError("")
    try {
      const [invitesRes, orphansRes] = await Promise.allSettled([
        api.auth.doctorInvitations.list("all"),
        api.auth.orphans.list(),
      ])

      if (invitesRes.status === "fulfilled") {
        setInvitations(invitesRes.value.invitations || [])
      } else {
        setError("Unable to load doctor invitations.")
      }

      if (orphansRes.status === "fulfilled") {
        setOrphans(orphansRes.value.orphans || [])
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load account management data.")
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="mt-2 text-sm text-rose-600">
            Administrator privileges are required to view or manage doctor accounts.
          </p>
        </div>
      </div>
    )
  }

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
    if (!window.confirm("Are you sure you want to reject this doctor account?")) return
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
      setSuccessMessage(`Temporary password set for ${tempPasswordModalDoc.email}.`)
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
      await api.auth.doctorInvitations.create({
        fullName: inviteFullName.trim(),
        email: inviteEmail.trim(),
        temporaryPassword: useTempPassword ? tempPassword : undefined,
        sendInvitationEmail: sendEmail,
      })
      setSuccessMessage(`Doctor invitation created for ${inviteEmail.trim()}.`)
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
    if (!window.confirm(`Clean up orphan ${orphan.type} (${orphan.identifier})?`)) return
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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinical Account Administration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage physician provisioning, pending approvals, temporary credentials, and orphan reconciliations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
          <Button onClick={() => setShowInviteModal(true)}>
            + Invite Doctor
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
            ×
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Doctor Accounts Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Physicians & Care Team</h2>
          <span className="text-xs text-slate-500 font-medium">
            {invitations.length} account{invitations.length === 1 ? "" : "s"} registered
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading accounts...</div>
        ) : invitations.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No doctors found. Click "+ Invite Doctor" to provision a new account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Doctor</th>
                  <th className="px-6 py-3">Approval Status</th>
                  <th className="px-6 py-3">Password Security</th>
                  <th className="px-6 py-3">Workspace</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{inv.fullName || "Unnamed Doctor"}</div>
                      <div className="text-xs text-slate-500">{inv.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {inv.approvalStatus === "approved" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      ) : inv.approvalStatus === "rejected" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {inv.mustChangePassword ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Temporary Password
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Established</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {inv.workspaceId ? `${inv.workspaceId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {inv.approvalStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleApprove(inv.id)}
                            loading={actionLoading === inv.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(inv.id)}
                            loading={actionLoading === inv.id}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTempPasswordModalDoc(inv)
                          setNewTempPassword("")
                        }}
                      >
                        Set Temp Pwd
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResend(inv.id)}
                        loading={actionLoading === inv.id}
                      >
                        Resend
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orphan Reconciliations Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Orphan Reconciliations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifies unlinked Supabase Auth users, orphaned profiles, or unassociated patient records.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            {orphans.length} orphan{orphans.length === 1 ? "" : "s"} detected
          </span>
        </div>

        {orphans.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-lg text-center text-xs text-slate-500">
            ✓ Workspace data integrity verified. No orphaned users or records found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orphans.map((orphan) => (
              <div key={`${orphan.type}-${orphan.id}`} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    <span className="font-mono text-xs uppercase px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded mr-2">
                      {orphan.type}
                    </span>
                    {orphan.identifier}
                  </div>
                  <div className="text-xs text-slate-500">{orphan.details}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCleanupOrphan(orphan)}
                  loading={actionLoading === `orphan-${orphan.id}`}
                  className="text-rose-600 hover:text-rose-700"
                >
                  Clean Up
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Doctor Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900">Invite a Physician</h2>
            <p className="text-xs text-slate-500">
              Provision a doctor account. They will be created in pending approval status until confirmed by an admin.
            </p>
            <form onSubmit={handleCreateDoctor} className="space-y-4">
              <Input
                label="Doctor Full Name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Dr. Eleanor Vance"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.vance@mednova.clinic"
                required
              />

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTempPassword}
                    onChange={(e) => setUseTempPassword(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600"
                  />
                  <span>Provision with temporary password</span>
                </label>
                {useTempPassword && (
                  <Input
                    label="Temporary Password"
                    type="password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600"
                />
                <span>Send invitation email via Supabase Auth</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={actionLoading === "create"}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Temp Password Modal */}
      {tempPasswordModalDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900">Set Temporary Password</h2>
            <p className="text-xs text-slate-500">
              Assign a temporary password for{" "}
              <strong className="text-slate-700">{tempPasswordModalDoc.email}</strong>. The user will be required to change this password on their next login.
            </p>
            <form onSubmit={handleSetTempPassword} className="space-y-4">
              <Input
                label="New Temporary Password"
                type="password"
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTempPasswordModalDoc(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={actionLoading === tempPasswordModalDoc.id}>
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
