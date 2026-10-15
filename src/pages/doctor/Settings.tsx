import { useEffect, useState, useCallback } from "react"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { api, isBackendConfigured } from "../../lib/api/apiClient"
import type { DoctorProfilePreferences } from "../../lib/types"

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export default function DoctorSettings() {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(isBackendConfigured())
  const [serverError, setServerError] = useState("")

  const [profileEmail, setProfileEmail] = useState("s.chen@mednova.clinic")
  const [displayName, setDisplayName] = useState("Dr. Sarah Chen")
  const [specialty, setSpecialty] = useState("Internal Medicine")
  const [phone, setPhone] = useState("+1 (555) 234-5678")

  const [channels, setChannels] = useState<Array<"email" | "sms" | "push">>([
    "email",
    "push",
  ])
  const [quietHoursStart, setQuietHoursStart] = useState("22:00")
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00")

  // Field validation errors
  const [validationErrors, setValidationErrors] = useState<{
    displayName?: string
    channels?: string
    quietHoursStart?: string
    quietHoursEnd?: string
  }>({})

  // Original snapshot for cancel reset
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    displayName: string
    specialty: string
    phone: string
    channels: Array<"email" | "sms" | "push">
    quietHoursStart: string
    quietHoursEnd: string
  } | null>(null)

  const loadSettings = useCallback(() => {
    if (!isBackendConfigured()) {
      const snap = {
        displayName: "Dr. Sarah Chen",
        specialty: "Internal Medicine",
        phone: "+1 (555) 234-5678",
        channels: ["email", "push"] as Array<"email" | "sms" | "push">,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }
      setOriginalSnapshot(snap)
      return
    }

    setLoading(true)
    setServerError("")

    api.doctor
      .getSettings()
      .then((res) => {
        setProfileEmail(res.profile.email || "s.chen@mednova.clinic")
        const name = res.preferences.displayName || res.profile.fullName || "Dr. Sarah Chen"
        const spec = res.preferences.specialty || "Internal Medicine"
        const ph = res.preferences.phone || ""
        const ch = res.preferences.notification?.channels || ["email", "push"]
        const qStart = res.preferences.notification?.quietHoursStart || "22:00"
        const qEnd = res.preferences.notification?.quietHoursEnd || "07:00"

        setDisplayName(name)
        setSpecialty(spec)
        setPhone(ph)
        setChannels(ch)
        setQuietHoursStart(qStart)
        setQuietHoursEnd(qEnd)

        setOriginalSnapshot({
          displayName: name,
          specialty: spec,
          phone: ph,
          channels: ch,
          quietHoursStart: qStart,
          quietHoursEnd: qEnd,
        })
      })
      .catch((err) => {
        setServerError(err?.message || "Failed to load doctor settings. Please retry.")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const toggleChannel = (channel: "email" | "sms" | "push") => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    )
    setValidationErrors((prev) => ({ ...prev, channels: undefined }))
  }

  const validate = () => {
    const errors: typeof validationErrors = {}
    if (!displayName.trim()) {
      errors.displayName = "Display name cannot be empty"
    }
    if (channels.length === 0) {
      errors.channels = "Select at least one notification channel"
    }
    if (quietHoursStart && !TIME_REGEX.test(quietHoursStart)) {
      errors.quietHoursStart = "Format must be HH:MM (e.g. 22:00)"
    }
    if (quietHoursEnd && !TIME_REGEX.test(quietHoursEnd)) {
      errors.quietHoursEnd = "Format must be HH:MM (e.g. 07:00)"
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    setServerError("")
    if (!validate()) return

    const payload: Partial<DoctorProfilePreferences> = {
      displayName: displayName.trim(),
      specialty: specialty.trim(),
      phone: phone.trim(),
      notification: {
        channels,
        quietHoursStart: quietHoursStart.trim(),
        quietHoursEnd: quietHoursEnd.trim(),
      },
    }

    if (isBackendConfigured()) {
      try {
        const res = await api.doctor.updateSettings(payload)
        setDisplayName(res.preferences.displayName || displayName)
        setSpecialty(res.preferences.specialty || specialty)
        setPhone(res.preferences.phone || phone)
        setChannels(res.preferences.notification.channels)
        setQuietHoursStart(res.preferences.notification.quietHoursStart || "")
        setQuietHoursEnd(res.preferences.notification.quietHoursEnd || "")
        setOriginalSnapshot({
          displayName: res.preferences.displayName || displayName,
          specialty: res.preferences.specialty || specialty,
          phone: res.preferences.phone || phone,
          channels: res.preferences.notification.channels,
          quietHoursStart: res.preferences.notification.quietHoursStart || "",
          quietHoursEnd: res.preferences.notification.quietHoursEnd || "",
        })
      } catch (err: any) {
        setServerError(err?.message || "Failed to save settings. Please try again.")
        return
      }
    } else {
      setOriginalSnapshot({
        displayName,
        specialty,
        phone,
        channels,
        quietHoursStart,
        quietHoursEnd,
      })
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleCancel = () => {
    if (originalSnapshot) {
      setDisplayName(originalSnapshot.displayName)
      setSpecialty(originalSnapshot.specialty)
      setPhone(originalSnapshot.phone)
      setChannels(originalSnapshot.channels)
      setQuietHoursStart(originalSnapshot.quietHoursStart)
      setQuietHoursEnd(originalSnapshot.quietHoursEnd)
      setValidationErrors({})
      setServerError("")
    }
  }

  const doctorInitials =
    displayName
      .replace(/^Dr\.\s*/i, "")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") || "DR"

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your clinical profile, alert channels, and quiet-hour preferences.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading your profile preferences…</p>
      )}

      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center justify-between">
          <span>{serverError}</span>
          <Button size="sm" variant="danger" onClick={loadSettings}>
            Retry
          </Button>
        </div>
      )}

      {/* Profile Section */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Doctor Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xl">
            {doctorInitials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">
              {specialty} · MedNova Clinic
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setValidationErrors((prev) => ({ ...prev, displayName: undefined }))
              }}
              placeholder="Dr. Sarah Chen"
            />
            {validationErrors.displayName && (
              <p className="text-xs text-rose-600 mt-1">{validationErrors.displayName}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Email"
                type="email"
                value={profileEmail}
                disabled
              />
              <p className="text-[10px] text-slate-400 mt-1">Managed by clinic administrator</p>
            </div>
            <div>
              <Input
                label="Specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Internal Medicine"
              />
            </div>
          </div>

          <div>
            <Input
              label="Contact Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
            />
          </div>
        </div>
      </Card>

      {/* Notifications and Quiet Hours */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          Notification Preferences
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">
              Alert Delivery Channels
            </p>
            <div className="space-y-2">
              {[
                { key: "email" as const, label: "Email alerts", sub: "Clinical escalation summaries & daily digests" },
                { key: "sms" as const, label: "SMS text messages", sub: "Critical urgent patient escalations" },
                { key: "push" as const, label: "Push notifications", sub: "Real-time doctor portal alerts" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={channels.includes(item.key)}
                    onChange={() => toggleChannel(item.key)}
                    className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-800 block">
                      {item.label}
                    </span>
                    <span className="text-xs text-slate-400 block">{item.sub}</span>
                  </div>
                </label>
              ))}
            </div>
            {validationErrors.channels && (
              <p className="text-xs text-rose-600 mt-1.5">{validationErrors.channels}</p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-700 mb-1">
              Quiet Hours
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Non-urgent notifications will be queued and delivered after quiet hours end.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Quiet Hours Start"
                  value={quietHoursStart}
                  onChange={(e) => {
                    setQuietHoursStart(e.target.value)
                    setValidationErrors((prev) => ({ ...prev, quietHoursStart: undefined }))
                  }}
                  placeholder="22:00"
                />
                {validationErrors.quietHoursStart && (
                  <p className="text-xs text-rose-600 mt-1">{validationErrors.quietHoursStart}</p>
                )}
              </div>
              <div>
                <Input
                  label="Quiet Hours End"
                  value={quietHoursEnd}
                  onChange={(e) => {
                    setQuietHoursEnd(e.target.value)
                    setValidationErrors((prev) => ({ ...prev, quietHoursEnd: undefined }))
                  }}
                  placeholder="07:00"
                />
                {validationErrors.quietHoursEnd && (
                  <p className="text-xs text-rose-600 mt-1">{validationErrors.quietHoursEnd}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant={saved ? "success" : "primary"}>
          {saved ? "✓ Saved" : "Save Changes"}
        </Button>
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
