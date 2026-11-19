import { useEffect, useState } from "react"

import Card from "../../components/ui/Card"

import Button from "../../components/ui/Button"

import Input, { Select } from "../../components/ui/Input"

import { api, getPatientId, isBackendConfigured } from "../../lib/api/apiClient"

import { useSession } from "../../lib/auth/SessionProvider"

export default function PatientSettings() {
  const { user } = useSession()

  const [saved, setSaved] = useState(false)

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(isBackendConfigured())
  const [phone, setPhone] = useState("")
  const [emailReminders, setEmailReminders] = useState(true)
  const [smsReminders, setSmsReminders] = useState(false)
  const [weeklyReports, setWeeklyReports] = useState(true)
  const [careTeamMessages, setCareTeamMessages] = useState(true)
  const [highContrast, setHighContrast] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const [preferences, setPreferences] = useState({
    channel: "email" as "email" | "sms" | "push",
    enabled: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
  })

  useEffect(() => {
    if (!isBackendConfigured() || !user) return

    const patientId = getPatientId(user)
    Promise.all([
      api.patients.getSettings(patientId).catch(() => ({ settings: [] })),
      api.patients.get(patientId).catch(() => null),
    ])
      .then(([{ settings }, patientRes]) => {
        const patientPhone =
          (patientRes?.patient as any)?.contact_phone ||
          patientRes?.patient?.phone
        if (patientPhone) {
          setPhone(patientPhone)
        }

        const setting = settings.find(
          (item) => typeof item === "object" && item !== null,
        ) as {
          channel?: "email" | "sms" | "push"
          enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
        } | undefined

        if (setting) {
          setPreferences((current) => ({
            channel: setting.channel ?? current.channel,
            enabled: setting.enabled ?? current.enabled,
            quietHoursStart:
              setting.quiet_hours_start?.slice(0, 5) ?? current.quietHoursStart,
            quietHoursEnd:
              setting.quiet_hours_end?.slice(0, 5) ?? current.quietHoursEnd,
          }))
          if (setting.channel === "sms") {
            setSmsReminders(setting.enabled ?? true)
          } else {
            setEmailReminders(setting.enabled ?? true)
          }
        }
      })
      .catch(() => setError("Settings could not be loaded. Retry to refresh."))
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = async () => {
    setError("")

    if (isBackendConfigured() && user) {
      try {
        await api.patients.updateSettings(getPatientId(user), {
          ...preferences,
          phone,
          enabled: emailReminders || smsReminders,
          channel: smsReminders ? "sms" : "email",
          emailDoseReminders: emailReminders,
          smsDoseReminders: smsReminders,
          weeklyReportEmail: weeklyReports,
        })
      } catch {
        setError("Settings could not be saved. Try again.")
        return
      }
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const displayName = user?.fullName || "Patient"
  const initials = displayName
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("") || "PT"
  const patientDisplayId = user?.patientId?.toUpperCase().startsWith("P-")
    ? `PT-${user.patientId.slice(2)}`
    : (user?.patientId || "PT-—")

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">
          Manage your preferences and contact details.
        </p>
      </div>
      {loading && (
        <p className="text-sm text-slate-500">Loading your preferences…</p>
      )}
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 font-mono">{patientDisplayId}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={user?.email ?? ""}
            disabled
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter contact phone"
          />
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          Reminder Preferences
        </h2>
        <div className="space-y-4">
          <Select
            label="Time Zone"
            defaultValue="America/Chicago"
            options={[
              { value: "America/Chicago", label: "Central Time (CT)" },

              { value: "America/New_York", label: "Eastern Time (ET)" },

              { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
            ]}
          />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Quiet Hours
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start"
                type="time"
                value={preferences.quietHoursStart}
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    quietHoursStart: event.target.value,
                  })
                }
              />
              <Input
                label="End"
                type="time"
                value={preferences.quietHoursEnd}
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    quietHoursEnd: event.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Communication
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">Email dose reminders</span>
            <input
              type="checkbox"
              checked={emailReminders}
              onChange={(e) => setEmailReminders(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">SMS dose reminders</span>
            <input
              type="checkbox"
              checked={smsReminders}
              onChange={(e) => setSmsReminders(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">Weekly report emails</span>
            <input
              type="checkbox"
              checked={weeklyReports}
              onChange={(e) => setWeeklyReports(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">Care team messages</span>
            <input
              type="checkbox"
              checked={careTeamMessages}
              onChange={(e) => setCareTeamMessages(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Accessibility
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">High contrast mode</span>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">Large text mode</span>
            <input
              type="checkbox"
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-700">Reduced motion</span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={handleSave} variant={saved ? "success" : "primary"}>
          {saved ? "✓ Saved" : "Save Changes"}
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </div>
  )
}
