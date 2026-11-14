import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Card from "../../components/ui/Card"
import Badge from "../../components/ui/Badge"
import Button from "../../components/ui/Button"
import AdherenceRing from "../../components/charts/AdherenceRing"
import TrendSparkline from "../../components/charts/TrendSparkline"
import { api, getPatientId } from "../../lib/api/apiClient"
import { useSession } from "../../lib/auth/SessionProvider"

type PatientMedication = {
  id: string

  medication: {
    name: string

    strength: string

    unit: string

    frequency: string

    nextDose: string

    startDate?: string

    endDate?: string

    durationDays?: number
  }
}

type AdherenceSummary = {
  score: number

  trend: "up" | "down" | "stable"

  taken: number

  skipped: number

  missed: number

  currentStreakDays: number
}

export default function PatientDashboard() {
  const { user } = useSession()

  const navigate = useNavigate()

  const [activeMeds, setActiveMeds] = useState<PatientMedication[]>([])

  const [nextScheduledDose, setNextScheduledDose] =
    useState<string>("See dose schedule")

  const [adherence, setAdherence] = useState<AdherenceSummary>({
    score: 0,

    trend: "stable",

    taken: 0,

    skipped: 0,

    missed: 0,

    currentStreakDays: 0,
  })

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [latestDoctorNote, setLatestDoctorNote] = useState<{
    doctorName: string
    initials: string
    message: string
  } | null>(null)

  const [sparklinePoints, setSparklinePoints] = useState<number[]>([])

  useEffect(() => {
    if (!user) return

    const patientId = getPatientId(user)

    if (!patientId) {
      setLoading(false)

      return
    }

    setLoading(true)

    setError("")

    Promise.all([
      api.patients.getMedications(patientId),

      api.patients.getAdherence(patientId),

      api.patients.getDoseSchedules(patientId),

      api.patients.getVisits(patientId).catch(() => ({ visits: [] })),
    ])

      .then(([medicationResult, adherenceResult, scheduleResult, visitsResult]) => {
        const schedules = scheduleResult.schedules || []

        setActiveMeds(
          medicationResult.medications.map((medication: any) => {
            const medName = String(medication.name ?? "Medication")
            const upcomingSchedule = schedules.find(
              (s: any) =>
                (s.status === "scheduled" ||
                  s.status === "pending" ||
                  (!s.loggedAt && s.status === "missed")) &&
                s.medicationName?.trim().toLowerCase() ===
                  medName.trim().toLowerCase(),
            )
            const takenToday = schedules.some(
              (s: any) =>
                s.status === "taken" &&
                s.medicationName?.trim().toLowerCase() ===
                  medName.trim().toLowerCase(),
            )

            const nextDoseText = upcomingSchedule
              ? upcomingSchedule.status === "missed" && !upcomingSchedule.loggedAt
                ? `Due now (was ${upcomingSchedule.scheduledTime})`
                : `Today at ${upcomingSchedule.scheduledTime}`
              : takenToday
                ? "Completed today"
                : "No doses today"

            return {
              id: String(medication.id),
              medication: {
                name: medName,
                strength: String(medication.dosage ?? ""),
                unit: "",
                frequency: String(medication.form ?? ""),
                nextDose: nextDoseText,
                startDate: medication.startDate,
                endDate: medication.endDate,
                durationDays: medication.durationDays,
              },
            }
          }),
        )

        const pending = schedules.find(
          (s: any) =>
            s.status === "scheduled" ||
            s.status === "pending" ||
            (!s.loggedAt && s.status === "missed"),
        )

        if (pending) {
          const doseStr = pending.dosage ? ` ${pending.dosage}` : ""
          const isOverdue = pending.status === "missed" && !pending.loggedAt
          setNextScheduledDose(
            isOverdue
              ? `${pending.medicationName}${doseStr} (Due now · was ${pending.scheduledTime})`
              : `${pending.medicationName}${doseStr} at ${pending.scheduledTime}`,
          )
        } else if (
          schedules.length > 0 &&
          schedules.every(
            (s: any) =>
              s.status === "taken" ||
              s.status === "skipped" ||
              Boolean(s.loggedAt),
          )
        ) {
          setNextScheduledDose("All doses completed for today! 🎉")
        } else {
          setNextScheduledDose("No upcoming doses scheduled")
        }

        setAdherence({
          score: adherenceResult.score,
          trend: adherenceResult.trend,
          taken: adherenceResult.takenCount + (adherenceResult.lateCount ?? 0),
          skipped: adherenceResult.skippedCount ?? 0,
          missed: adherenceResult.missedCount,
          currentStreakDays: adherenceResult.currentStreakDays,
        })

        if (Array.isArray(adherenceResult.sparklineData) && adherenceResult.sparklineData.length > 0) {
          setSparklinePoints(adherenceResult.sparklineData.map((pt: any) => pt.value))
        }

        const visits = visitsResult.visits || []
        if (visits.length > 0) {
          const v = visits[0]
          const docName = (v as any).doctorName || v.doctor || (v as any).profiles?.full_name || "Care Team Doctor"
          const initials = docName
            .split(" ")
            .filter(Boolean)
            .map((p: string) => p[0].toUpperCase())
            .slice(0, 2)
            .join("") || "DR"

          setLatestDoctorNote({
            doctorName: docName,
            initials,
            message: v.notes || v.proposedSolution || "Continue taking your prescribed medications on schedule.",
          })
        } else {
          setLatestDoctorNote(null)
        }
      })

      .catch(() => setError("Dashboard data could not be loaded."))

      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Your care summary</h1>
        <p className="text-slate-500 text-sm">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-slate-200/70 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-slate-200/70 rounded-xl" />
            <div className="h-20 bg-slate-200/70 rounded-xl" />
          </div>
          <div className="h-36 bg-slate-200/70 rounded-xl" />
          <div className="h-24 bg-slate-200/70 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Next dose countdown */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg shadow-teal-600/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-200 text-sm font-medium mb-1">
                  Next Dose Due
                </p>
                <p className="text-2xl font-bold">{nextScheduledDose}</p>
                <p className="text-teal-200 text-sm mt-0.5">
                  Streak: {adherence.currentStreakDays}{" "}
                  {adherence.currentStreakDays === 1 ? "day" : "days"} on track
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold">
                  {adherence.currentStreakDays}d
                </div>
                <div className="text-teal-200 text-xs">active streak</div>
              </div>
            </div>
            <Button
              className="mt-4 bg-white text-teal-700 hover:bg-teal-50 border-0 shadow-none"
              size="sm"
              onClick={() => navigate("/patient/doses")}
            >
              View All Doses
            </Button>
          </div>

          {/* Stats row - Clean Binary Adherence */}
          <div className="grid grid-cols-2 gap-3">
            <Card padding="sm">
              <div className="text-2xl font-bold text-emerald-600">
                {adherence.taken}
              </div>
              <div className="text-xs font-medium text-slate-700 mt-0.5">
                Doses Taken
              </div>
              <div className="text-[10px] text-slate-400">Last 30 days</div>
            </Card>
            <Card padding="sm">
              <div className="text-2xl font-bold text-rose-500">
                {adherence.missed + adherence.skipped}
              </div>
              <div className="text-xs font-medium text-slate-700 mt-0.5">
                Missed / Skipped
              </div>
              <div className="text-[10px] text-slate-400">Last 30 days</div>
            </Card>
          </div>

          {/* Adherence ring + trend */}
          <Card padding="md">
            <div className="flex items-center gap-5">
              <AdherenceRing score={adherence.score} size={100} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Overall Adherence
                  </h3>
                  <Badge
                    variant={
                      adherence.trend === "up"
                        ? "success"
                        : adherence.trend === "down"
                          ? "warning"
                          : "default"
                    }
                  >
                    {adherence.trend === "up"
                      ? "↑ Positive"
                      : adherence.trend === "down"
                        ? "↓ Attention"
                        : "→ Stable"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {adherence.score === 0
                    ? "Your score will calculate as doses are taken."
                    : adherence.trend === "up"
                      ? "Your adherence is trending up. Keep it up!"
                      : adherence.trend === "down"
                        ? "Your adherence needs attention. Try not to skip scheduled doses."
                        : "Your adherence is steady and consistent."}
                </p>
                <div className="h-10">
                  {sparklinePoints.length > 0 ? (
                    <TrendSparkline
                      data={sparklinePoints.map((val, idx) => ({
                        date: `W${idx + 1}`,
                        value: val,
                      }))}
                      color={
                        adherence.trend === "up"
                          ? "#10b981"
                          : adherence.trend === "down"
                            ? "#f59e0b"
                            : "#0d9488"
                      }
                      height={40}
                    />
                  ) : (
                    <p className="text-xs text-slate-400">
                      Trend data will appear as adherence is recorded.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Current medications */}
          <div>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Current Medications
            </h2>
            {activeMeds.length === 0 ? (
              <Card
                padding="md"
                className="text-center border-dashed border-slate-200 bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-700">
                  No active medications prescribed yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Your care team will add prescribed medications following your
                  clinical consultation.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeMeds.map((rx) => (
                  <Card
                    key={rx.id}
                    padding="md"
                    hover
                    onClick={() => navigate("/patient/doses")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            className="fill-teal-600"
                            width={18}
                            height={18}
                          >
                            <path d="M10.5 19.5h3v-6h6v-3h-6v-6h-3v6h-6v3h6z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {rx.medication.name} {rx.medication.strength}
                            {rx.medication.unit}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span>{rx.medication.frequency}</span>
                            {rx.medication.endDate && (
                              <>
                                <span>·</span>
                                <span className="text-teal-700 font-medium">
                                  Ends{" "}
                                  {new Date(
                                    rx.medication.endDate,
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 mb-0.5">Next dose</p>
                        <p className="text-xs font-medium text-teal-700">
                          {rx.medication.nextDose}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Care team message */}
          {latestDoctorNote && (
            <Card padding="md" className="bg-cyan-50 border-cyan-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-200 flex items-center justify-center text-cyan-700 font-bold text-xs flex-shrink-0">
                  {latestDoctorNote.initials}
                </div>
                <div>
                  <p className="text-xs text-cyan-600 font-medium mb-1">
                    {latestDoctorNote.doctorName} · Care Team Consultation
                  </p>
                  <p className="text-sm text-cyan-900">
                    {latestDoctorNote.message}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
