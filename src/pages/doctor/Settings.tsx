import { useEffect, useState } from "react"

import Card from "../../components/ui/Card"

import Button from "../../components/ui/Button"

import Input, { Select } from "../../components/ui/Input"

import { api, isBackendConfigured } from "../../lib/api/apiClient"

export default function DoctorSettings() {
  const [saved, setSaved] = useState(false)

  const [loading, setLoading] = useState(isBackendConfigured())

  const [error, setError] = useState("")

  const [preferences, setPreferences] = useState({
    timeZone: "America/Chicago",
    frequency: "immediate",
  })

  useEffect(() => {
    if (!isBackendConfigured()) return

    api.auth
      .getSettings()

      .then(({ settings }) => {
        const saved = settings as Record<string, unknown>

        setPreferences((current) => ({
          timeZone:
            typeof saved.timeZone === "string"
              ? saved.timeZone
              : current.timeZone,

          frequency:
            typeof saved.frequency === "string"
              ? saved.frequency
              : current.frequency,
        }))
      })

      .catch(() => setError("Settings could not be loaded. Retry to refresh."))

      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setError("")

    if (isBackendConfigured()) {
      try {
        await api.auth.updateSettings(preferences)
      } catch {
        setError("Settings could not be saved. Try again.")

        return
      }
    }

    setSaved(true)

    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your profile and preferences.
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
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xl">
            SC
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Dr. Jeya Shankar M
            </p>
            <p className="text-xs text-slate-500">
              Internal Medicine · MedNova Clinic
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="First Name" defaultValue="Sarah" />
          <Input label="Last Name" defaultValue="Chen" />
          <Input
            label="Email"
            type="email"
            defaultValue="s.chen@mednova.clinic"
          />
          <Input label="Specialty" defaultValue="Internal Medicine" />
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          Preferences
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Time Zone"
            value={preferences.timeZone}
            onChange={(event) =>
              setPreferences({ ...preferences, timeZone: event.target.value })
            }
            options={[
              { value: "America/Chicago", label: "Central Time (CT)" },

              { value: "America/New_York", label: "Eastern Time (ET)" },

              { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
            ]}
          />
          <Select
            label="Notification Frequency"
            value={preferences.frequency}
            onChange={(event) =>
              setPreferences({ ...preferences, frequency: event.target.value })
            }
            options={[
              { value: "immediate", label: "Immediately" },

              { value: "hourly", label: "Hourly digest" },

              { value: "daily", label: "Daily digest" },
            ]}
          />
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Notifications
        </h2>
        <div className="space-y-3">
          {[
            { label: "Escalation alerts", checked: true },

            { label: "Patient dose logs", checked: false },

            { label: "Weekly adherence reports", checked: true },

            { label: "AI analysis completions", checked: true },
          ].map((item) => (
            <label
              key={item.label}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-sm text-slate-700">{item.label}</span>
              <input
                type="checkbox"
                defaultChecked={item.checked}
                className="rounded border-slate-300 text-teal-600"
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant={saved ? "success" : "primary"}>
          {saved ? "✓ Saved" : "Save Changes"}
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </div>
  )
}
