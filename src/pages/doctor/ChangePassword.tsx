import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { api } from "../../lib/api/apiClient"
import { useSession } from "../../lib/auth/SessionProvider"

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user, refresh } = useSession()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.mustChangePassword) navigate("/doctor", { replace: true })
  }, [navigate, user?.mustChangePassword])

  if (!user?.mustChangePassword) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmation) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      await api.auth.changePassword(password)
      await refresh()
      navigate("/doctor", { replace: true })
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Unable to change password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Change your password</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your administrator set a temporary password. Choose a private password before continuing.
      </p>
      {error && <p className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Input label="Confirm new password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
        <Button type="submit" fullWidth loading={loading}>Save new password</Button>
      </form>
    </div>
  )
}
