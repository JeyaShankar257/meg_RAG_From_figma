import type {
  Doctor,
  Patient,
  Visit,
  Medication,
  AdherenceData,
  HeatmapCell,
  AIAnalysis,
  Citation,
  Prescription,
  Escalation,
  CareTeamMember,
  PipelineStage,
  Report,
  TrustScoreComponent,
  SparklinePoint,
} from "./types";

export const DEMO_DOCTOR: Doctor = {
  id: "dr-001",
  name: "Dr. Jeya Shankar M",
  email: "s.chen@mednova.clinic",
  specialty: "Internal Medicine",
};

export const DEMO_CARE_TEAM: CareTeamMember[] = [
  { id: "ct-001", name: "Dr. Jeya Shankar M", role: "Attending Physician", email: "s.chen@mednova.clinic" },
  { id: "ct-002", name: "Priya Dharshini", role: "Care Coordinator", email: "p.nair@mednova.clinic" },
  { id: "ct-003", name: "Parvathi", role: "Pharmacist", email: "j.okafor@mednova.clinic" },
];

export const DEMO_PATIENTS: Patient[] = [
  {
    id: "p-001",
    patientId: "PT-00231",
    name: "Marcus Rivera",
    email: "m.rivera@email.com",
    dob: "1978-04-12",
    age: 46,
    gender: "Male",
    phone: "+1 (555) 204-3817",
    address: "142 Maple Street, Springfield, IL 62701",
    status: "active",
    assignedDoctor: "dr-001",
    careTeam: ["ct-001", "ct-002", "ct-003"],
    conditions: ["Type 2 Diabetes", "Hypertension"],
    adherenceScore: 84,
    trend: "up",
    hasEscalation: false,
    lastVisit: "2026-08-28",
  },
  {
    id: "p-002",
    patientId: "PT-00247",
    name: "Amara Osei",
    email: "a.osei@email.com",
    dob: "1965-11-03",
    age: 60,
    gender: "Female",
    phone: "+1 (555) 318-9204",
    address: "88 Birchwood Ave, Oak Park, IL 60301",
    status: "active",
    assignedDoctor: "dr-001",
    careTeam: ["ct-001", "ct-002"],
    conditions: ["Asthma", "Hypothyroidism"],
    adherenceScore: 92,
    trend: "stable",
    hasEscalation: false,
    lastVisit: "2026-09-05",
  },
  {
    id: "p-003",
    patientId: "PT-00253",
    name: "David Kowalski",
    email: "d.kowalski@email.com",
    dob: "1991-07-22",
    age: 35,
    gender: "Male",
    phone: "+1 (555) 741-0629",
    address: "35 Lakeshore Dr, Evanston, IL 60201",
    status: "active",
    assignedDoctor: "dr-001",
    careTeam: ["ct-001", "ct-002", "ct-003"],
    conditions: ["Major Depressive Disorder", "Insomnia"],
    adherenceScore: 41,
    trend: "down",
    hasEscalation: true,
    lastVisit: "2026-09-02",
  },
  {
    id: "p-004",
    patientId: "PT-00261",
    name: "Sofia Patel",
    email: "s.patel@email.com",
    dob: "1988-02-14",
    age: 38,
    gender: "Female",
    phone: "+1 (555) 523-8811",
    address: "210 Riverside Blvd, Chicago, IL 60614",
    status: "invited",
    assignedDoctor: "dr-001",
    careTeam: ["ct-001"],
    conditions: ["GERD", "Anxiety Disorder"],
    adherenceScore: 0,
    trend: "stable",
    hasEscalation: false,
    lastVisit: "2026-09-08",
  },
];

export const DEMO_VISITS: Visit[] = [
  {
    id: "v-001",
    patientId: "p-001",
    date: "2026-08-28",
    condition: "Type 2 Diabetes — Follow-up",
    symptoms: ["Fatigue", "Increased thirst", "Blurred vision"],
    notes: "Patient reports improved energy levels since last dose adjustment. HbA1c down to 7.1% from 7.8% at last visit. Fasting glucose averaging 118 mg/dL. Continuing current metformin regimen with minor titration.",
    proposedSolution: "Increase Metformin to 1000mg BID. Add Jardiance 10mg QD if glucose control doesn't improve in 8 weeks.",
    outcome: "HbA1c improving. Schedule next labs in 6 weeks. Patient advised on dietary modifications.",
    doctor: "Dr. Jeya Shankar M",
    relatedVisits: ["v-002"],
  },
  {
    id: "v-002",
    patientId: "p-001",
    date: "2026-06-15",
    condition: "Hypertension — Routine Review",
    symptoms: ["Headache", "Mild dizziness"],
    notes: "BP measured at 142/88 mmHg at clinic. Home readings averaging 138/85 mmHg over the past month. Patient reports occasional headaches in the morning. No visual disturbances. Kidney function normal.",
    proposedSolution: "Continue Lisinopril 10mg. Add Amlodipine 5mg QD to better control BP. Recommend sodium restriction.",
    outcome: "Combination therapy initiated. Follow-up in 4 weeks to assess BP response.",
    doctor: "Dr. Jeya Shankar M",
  },
  {
    id: "v-003",
    patientId: "p-001",
    date: "2026-04-02",
    condition: "Acute Upper Respiratory Infection",
    symptoms: ["Cough", "Sore throat", "Low-grade fever (37.8°C)", "Fatigue"],
    notes: "Viral URI, no bacterial indicators. Throat culture negative. Lungs clear on auscultation. Patient's diabetes management was stable through this episode — no significant glucose dysregulation.",
    proposedSolution: "Supportive care: rest, fluids, paracetamol PRN. No antibiotics indicated.",
    outcome: "Symptoms resolved within 7 days per follow-up call. No complications.",
    doctor: "Dr. Jeya Shankar M",
  },
  {
    id: "v-004",
    patientId: "p-001",
    date: "2026-01-20",
    condition: "Type 2 Diabetes — Annual Review",
    symptoms: ["Fatigue", "Tingling in feet"],
    notes: "Annual comprehensive diabetes review. HbA1c at 7.8% — above target of 7.0%. Signs of early peripheral neuropathy in bilateral feet. No retinopathy on fundus exam. Microalbuminuria borderline at 28 mg/g creatinine.",
    proposedSolution: "Intensify diabetes management. Consider addition of Jardiance for both glucose control and cardiovascular protection. Refer to podiatry for neuropathy assessment.",
    outcome: "Referred to podiatry. Metformin dose titrated upward. Patient counseled on foot care.",
    doctor: "Dr. Jeya Shankar M",
    relatedVisits: ["v-001"],
  },
  {
    id: "v-005",
    patientId: "p-001",
    date: "2025-10-14",
    condition: "Hypertension — Initial Diagnosis",
    symptoms: ["Persistent headache", "Elevated BP readings at home"],
    notes: "Patient self-referred after noting consistently elevated home BP readings (consistently above 135/85 over 3 weeks). Clinic BP 152/94 mmHg. ECG normal. No secondary causes identified on initial workup. Family history positive (father — hypertension, MI at 58).",
    proposedSolution: "Initiate antihypertensive therapy. Start Lisinopril 5mg QD. DASH diet counseling.",
    outcome: "Lisinopril initiated. BP diary started. Follow-up in 4 weeks.",
    doctor: "Dr. Jeya Shankar M",
    relatedVisits: ["v-002"],
  },
];

function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const statuses: Array<HeatmapCell["status"]> = ["taken", "taken", "taken", "late", "taken", "skipped", "missed"];
  const today = new Date("2026-09-12");
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const rand = Math.random();
    let status: HeatmapCell["status"];
    if (rand < 0.65) status = "taken";
    else if (rand < 0.78) status = "late";
    else if (rand < 0.88) status = "skipped";
    else status = "missed";
    cells.push({ date: dateStr, status, value: status === "taken" ? 1 : status === "late" ? 0.7 : status === "skipped" ? 0.3 : 0 });
  }
  return cells;
}

export const DEMO_ADHERENCE: AdherenceData = {
  score: 84,
  trend: 6.2,
  taken: 58,
  late: 11,
  skipped: 9,
  missed: 12,
  deliveryFailures: 2,
  logs: [],
  heatmapData: generateHeatmap(),
};

export const DEMO_AI_ANALYSIS: AIAnalysis = {
  id: "ai-001",
  type: "diagnostic",
  status: "complete",
  confidence: 0.87,
  severity: "mild",
  rootCause: "Reminder delivery gap + lifestyle timing mismatch",
  hypothesis: "The adherence pattern suggests a combination of two email delivery failures (Aug 14–15) coinciding with a shift in the patient's daily routine (vacation travel noted in patient log). The afternoon dose is consistently logged 45–90 minutes late on Fridays, suggesting a recurring schedule conflict.",
  explanation: "The AI pattern model analyzed 90 days of dose logs alongside reminder delivery outcomes. Two confirmed email delivery failures on Aug 14–15 account for those missed doses and should not be attributed to patient non-adherence. The remaining 10 late Friday doses correlate with the patient's reported end-of-work routine. No evidence of deliberate avoidance or systemic non-compliance. Root cause is classified as logistical rather than motivational.",
  safetyFlags: [],
  citations: [
    {
      id: "c-001",
      title: "Medication Adherence and Diabetes Outcomes: A Meta-Analysis",
      publisher: "Journal of Diabetes Care",
      date: "2025-03",
      relevanceNote: "Supports reminder-timing optimization as a first-line intervention for late-logging patterns in T2DM patients.",
      type: "research_study",
    },
    {
      id: "c-002",
      title: "ADA Standards of Medical Care in Diabetes 2026",
      publisher: "American Diabetes Association",
      date: "2026-01",
      relevanceNote: "Guideline recommends adherence support review before medication escalation when HbA1c is within 1% of target.",
      type: "guideline",
    },
  ],
  relatedVisits: ["v-001", "v-004"],
  modelVersion: "gemini-2.0-flash-001",
  createdAt: "2026-09-12T08:14:22Z",
  reviewed: false,
  suggestedMedications: [
    {
      name: "Jardiance",
      genericName: "Empagliflozin",
      strength: "10",
      unit: "mg",
      frequency: "Once daily (QD)",
      quantity: 30,
      days: 30,
      instructions: "Take in the morning, with or without food. Monitor for signs of UTI or genital yeast infection.",
      reasoning: "Patient has both T2DM and hypertension. SGLT2 inhibitors (empagliflozin) provide dual benefit: HbA1c reduction and demonstrated 24% reduction in major cardiovascular events per EMPA-REG OUTCOME trial. Current metformin regimen shows suboptimal glucose control at 7.1% HbA1c.",
      citations: [
        {
          id: "c-sug-001",
          title: "EMPA-REG OUTCOME: Empagliflozin, Cardiovascular Outcomes, and Mortality in T2DM",
          publisher: "New England Journal of Medicine",
          date: "2015-11",
          relevanceNote: "Demonstrated 24% reduction in cardiovascular death in T2DM patients with hypertension — matches patient profile.",
          type: "research_study",
        },
        {
          id: "c-sug-002",
          title: "ADA Standards of Medical Care in Diabetes 2026",
          publisher: "American Diabetes Association",
          date: "2026-01",
          relevanceNote: "Recommends SGLT2 inhibitor addition when HbA1c remains above 7.0% on metformin with concurrent cardiovascular risk factors.",
          type: "guideline",
        },
      ],
    },
    {
      name: "Vitamin D3",
      genericName: "Cholecalciferol",
      strength: "1000",
      unit: "IU",
      frequency: "Once daily (QD)",
      quantity: 30,
      days: 30,
      instructions: "Take with a meal containing fat for optimal absorption.",
      reasoning: "Vitamin D deficiency is prevalent in T2DM patients (>70% incidence in published cohorts) and correlates with insulin resistance. Patient's last labs did not include 25-OH vitamin D levels; supplementation is low-risk and commonly indicated pending formal testing.",
      citations: [
        {
          id: "c-sug-003",
          title: "Vitamin D Deficiency and Type 2 Diabetes: A Systematic Review",
          publisher: "Diabetes Care",
          date: "2024-06",
          relevanceNote: "Meta-analysis of 28 RCTs confirms prevalence >70% and modest benefit on insulin sensitivity when corrected.",
          type: "research_study",
        },
      ],
    },
  ],
};

export const DEMO_PRESCRIPTIONS: Prescription[] = [
  {
    id: "rx-001",
    status: "active",
    suggestedBy: "doctor",
    approvedBy: "Dr. Jeya Shankar M",
    approvedAt: "2026-08-28T10:30:00Z",
    citations: [],
    revisions: [],
    medication: {
      id: "med-001",
      name: "Metformin",
      genericName: "Metformin HCl",
      strength: "1000",
      unit: "mg",
      frequency: "Twice daily (BID)",
      quantity: 60,
      duration: "90 days",
      instructions: "Take with meals to reduce GI side effects. Do not crush or chew extended-release tablets.",
      startDate: "2026-08-28",
      endDate: "2026-11-26",
      status: "active",
      prescribedBy: "Dr. Jeya Shankar M",
      nextDose: "Today, 7:00 PM",
    },
  },
  {
    id: "rx-002",
    status: "active",
    suggestedBy: "ai",
    approvedBy: "Dr. Jeya Shankar M",
    approvedAt: "2026-06-15T09:00:00Z",
    citations: [
      {
        id: "c-003",
        title: "Cardiovascular Benefits of SGLT2 Inhibitors in T2DM Patients with Hypertension",
        publisher: "New England Journal of Medicine",
        date: "2024-09",
        relevanceNote: "Demonstrates 24% reduction in major cardiovascular events in patients with both T2DM and hypertension, matching this patient's profile.",
        type: "research_study",
      },
    ],
    revisions: [
      {
        id: "rev-001",
        changedBy: "Dr. Jeya Shankar M",
        changedAt: "2026-06-15T09:15:00Z",
        changes: { strength: { from: "5", to: "10" } },
        reason: "Dose corrected after pharmacist review; 5mg was insufficient for this patient's weight.",
      },
    ],
    medication: {
      id: "med-002",
      name: "Amlodipine",
      genericName: "Amlodipine Besylate",
      strength: "5",
      unit: "mg",
      frequency: "Once daily (QD)",
      quantity: 30,
      duration: "90 days",
      instructions: "Take at the same time each day. May take with or without food.",
      startDate: "2026-06-15",
      endDate: "2026-09-15",
      status: "active",
      prescribedBy: "Dr. Jeya Shankar M",
      nextDose: "Today, 8:00 AM",
    },
  },
];

export const DEMO_ESCALATIONS: Escalation[] = [
  {
    id: "esc-001",
    patientId: "p-003",
    patientName: "David Kowalski",
    severity: "urgent",
    rootCause: "Sustained non-adherence to antidepressant therapy",
    confidence: 0.91,
    explanation: "Pattern model identified 18 consecutive missed doses of Sertraline over 21 days, with no corresponding delivery failures. Prior escalation history suggests this patient has difficulty maintaining consistency during depressive episodes. Severity classified as urgent given medication class and risk of withdrawal effects.",
    createdAt: "2026-09-10T06:00:00Z",
    status: "open",
    aiModelVersion: "gemini-2.0-flash-001",
  },
];

export const DEMO_PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "stage-1",
    name: "Reminder Agent",
    agentName: "reminder-agent-v2",
    description: "Generates and sends dose reminders based on schedule",
    status: "complete",
    lastRun: "2026-09-12T07:00:00Z",
    logs: [
      { id: "l-01", timestamp: "2026-09-12T07:00:12Z", level: "info", message: "Sent reminder for PT-00231 — Metformin 1000mg PM dose", metadata: { patientId: "PT-00231", deliveryStatus: "accepted" } },
      { id: "l-02", timestamp: "2026-09-12T07:00:15Z", level: "info", message: "Sent reminder for PT-00247 — Levothyroxine AM dose", metadata: { patientId: "PT-00247", deliveryStatus: "accepted" } },
      { id: "l-03", timestamp: "2026-09-12T07:00:17Z", level: "warn", message: "Email delivery retry for PT-00253 — bounce on first attempt", metadata: { patientId: "PT-00253", attempt: 2 } },
    ],
  },
  {
    id: "stage-2",
    name: "Dose Logging Agent",
    agentName: "dose-log-agent-v1",
    description: "Validates and records patient dose submissions",
    status: "idle",
    lastRun: "2026-09-12T09:32:44Z",
    logs: [
      { id: "l-04", timestamp: "2026-09-12T09:32:44Z", level: "info", message: "Logged dose: PT-00231 Metformin AM — taken on-time", metadata: { latencyMs: 120 } },
    ],
  },
  {
    id: "stage-3",
    name: "Pattern Detection Agent",
    agentName: "pattern-ai-v3",
    description: "AI-driven adherence pattern analysis (fully AI-driven, no rule floor)",
    status: "complete",
    lastRun: "2026-09-12T09:32:48Z",
    logs: [
      { id: "l-05", timestamp: "2026-09-12T09:32:48Z", level: "info", message: "Pattern eval: PT-00231 — severity: none, confidence: 0.89", metadata: { model: "gemini-2.0-flash-001" } },
      { id: "l-06", timestamp: "2026-09-10T06:00:02Z", level: "warn", message: "Pattern eval: PT-00253 — severity: urgent, confidence: 0.91 → Escalation triggered", metadata: { model: "gemini-2.0-flash-001" } },
    ],
  },
  {
    id: "stage-4",
    name: "Escalation Agent",
    agentName: "escalation-agent-v2",
    description: "Creates escalations and notifies care team based on AI severity judgment",
    status: "complete",
    lastRun: "2026-09-10T06:00:04Z",
    logs: [
      { id: "l-07", timestamp: "2026-09-10T06:00:04Z", level: "warn", message: "Escalation created: esc-001 — PT-00253 urgent", metadata: { notified: "dr-001,ct-002" } },
    ],
  },
  {
    id: "stage-5",
    name: "Care Team Interaction Agent",
    agentName: "careteam-agent-v1",
    description: "Coordinates escalation outreach and generates reports",
    status: "complete",
    lastRun: "2026-09-08T08:00:00Z",
    logs: [
      { id: "l-08", timestamp: "2026-09-08T08:00:12Z", level: "info", message: "Weekly report delivered: PT-00231", metadata: { period: "2026-09-01/2026-09-07" } },
      { id: "l-09", timestamp: "2026-09-08T08:00:18Z", level: "info", message: "Weekly report delivered: PT-00247", metadata: { period: "2026-09-01/2026-09-07" } },
    ],
  },
];

export const DEMO_REPORTS: Report[] = [
  {
    id: "rep-001",
    period: "weekly",
    startDate: "2026-09-01",
    endDate: "2026-09-07",
    adherencePercent: 86,
    missedDays: 1,
    trend: "improving",
    insights: [
      "You took 12 out of 14 scheduled doses — great consistency this week.",
      "Your afternoon Metformin was logged on time every day this week.",
      "One missed dose on Wednesday — no worries, your overall trend is improving.",
    ],
    deliveredAt: "2026-09-08T08:00:12Z",
  },
  {
    id: "rep-002",
    period: "weekly",
    startDate: "2026-08-25",
    endDate: "2026-08-31",
    adherencePercent: 79,
    missedDays: 3,
    trend: "stable",
    insights: [
      "You took 11 out of 14 doses. A solid week overall.",
      "Two reminder delivery issues were flagged on Aug 26–27 — those missed doses are noted.",
      "Keep it up — you're trending in the right direction.",
    ],
    deliveredAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "rep-003",
    period: "monthly",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    adherencePercent: 82,
    missedDays: 8,
    trend: "improving",
    insights: [
      "August was a strong month — 82% adherence is above your 3-month average of 76%.",
      "You improved your on-time logging rate by 18% compared to July.",
      "Your care team sees your progress. Keep building the routine.",
    ],
    deliveredAt: "2026-09-01T08:01:00Z",
  },
];

export const DEMO_TRUST_COMPONENTS: TrustScoreComponent[] = [
  { name: "Dose Taking Rate", score: 87, weight: 40, description: "Percentage of scheduled doses actually taken" },
  { name: "Timing Consistency", score: 74, weight: 30, description: "How consistently doses are taken at the scheduled time" },
  { name: "Reminder Responsiveness", score: 91, weight: 20, description: "Response rate to dose reminders" },
  { name: "Escalation History", score: 100, weight: 10, description: "Absence of prior urgent escalations (higher is better)" },
];

export const DEMO_SPARKLINE: SparklinePoint[] = [
  { date: "2026-06-01", value: 71 },
  { date: "2026-06-15", value: 69 },
  { date: "2026-07-01", value: 74 },
  { date: "2026-07-15", value: 77 },
  { date: "2026-08-01", value: 79 },
  { date: "2026-08-15", value: 81 },
  { date: "2026-09-01", value: 84 },
  { date: "2026-09-12", value: 84 },
];
