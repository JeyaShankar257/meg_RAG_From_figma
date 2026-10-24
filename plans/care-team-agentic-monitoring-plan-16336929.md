Here is the complete, end-to-end workflow of the updated **Care Team Page** ([`CareTeamPage.tsx`](file:///d:/meg_RAG_From_figma/src/pages/doctor/CareTeamPage.tsx)), showing how the 4 agents cooperate from morning to night, how risks escalate, and how clinicians interact with the system.

---

### 1. The Daily Closed-Loop Timeline

```
[ MORNING / DOSE TIMES ]
   │
   ▼
[ 1. Dose Reminder Agent ]
• Fires at scheduled dose time (e.g., 8:00 AM)
• Dispatches Email 1 to Patient: "Time for your Metformin 1000mg"
• Patient opens portal and taps "Take Dose" or "Skip Dose"
   │
   ▼
[ THROUGHOUT THE DAY ]
• Patient logs doses in the Dose Center with zero agent lag.
   │
   ▼
[ END OF DAY (9:00 PM) ]
   │
   ▼
[ 2. Pattern Detection Agent (Daily Evaluator) ]
• Reviews the completed day: How many doses were taken vs skipped vs missed?
• Computes the rolling 7-day adherence score & consecutive skip streak.
• Classifies the patient into one of 3 Tiers:
   │
   ├─► TIER A: Normal Adherence (≥ 80%) ──► Patient is on track. Pipeline stays calm & green.
   │
   ├─► TIER B: Emerging Risk (2 skipped days or score < 75%) ──► Triggers Agent 3
   │                                                             │
   │                                                             ▼
   │                                            [ 3. Patient Health Warning Agent (Level 1) ]
   │                                            • Sends Email 2 directly to Patient
   │                                            • Explains physiological risks of skipping this specific drug
   │                                            • Prompts patient to report side effects or barriers
   │
   └─► TIER C: High-Risk Persistent Failure ──► Triggers Agent 4
       (48–72h non-responsive after Level 1, or 3+ consecutive skipped days)
                                                 │
                                                 ▼
                                [ 4. Doctor & Guardian SOS Agent (Level 2) ]
                                • Action A: Dispatches Email 3 to Patient's Emergency Guardian
                                • Action B: Flags Urgent Red SOS Banner on Doctor's Care Team Page
```

---

### 2. What the Updated Care Team Page Looks Like

When a doctor visits `/doctor/patients/:patientId/care-team`, the page is structured into 4 interactive zones:

#### Zone 1: Urgent AI Escalation Banner *(Only appears if Level 2 SOS is active)*
* **Color**: High-visibility Red / Rose border with pulsing alert icon.
* **Content**:
  - **Risk**: *"AI Escalation — URGENT SOS: Severe Persistent Non-Adherence"*
  - **Root Cause**: *"Patient non-responsive 48h after Level 1 warning; 3 consecutive missed days on Metformin 1000mg."*
  - **AI Model**: `gemini-2.0-flash-001` · Confidence: 94%
  - **Guardian Status**: *"SOS alert delivered to Guardian (Sarah Rivera - 08:15 PM)."*
* **1-Click Doctor Actions**:
  - `[ 📞 Schedule Urgent Telehealth ]`
  - `[ 🏥 Assign Nurse Outreach ]`
  - `[ 💊 Adjust / Switch Medication ]`
  - `[ ✓ Mark Acknowledged ]`

---

#### Zone 2: The 4-Stage Visual Stepper
Replaces the old 5-box legacy view with the 4 clear, logical agents:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Dose         │       │ 2. Pattern      │       │ 3. Patient      │       │ 4. Doctor &     │
│    Reminder     ├──────►│    Detection    ├──────►│    Warning      ├──────►│    Guardian SOS │
│ [ ✓ Complete ]  │       │ [ ● Evaluated ] │       │ [ Level 1 Sent ]│       │ [ Active SOS ]  │
│ 8:00 AM Today   │       │ Score: 64%      │       │ Oct 23, 9:00 PM │       │ High Priority   │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
                                   │
                    [ ⚡ Run Daily Check Now ] (Demo Testing Button)
```

* **Interactive Stepper**: Clicking any stage highlights it and reveals its detailed logs below.
* **Demo Button**: A **"Run Daily Check Now"** button under Stage 2 lets you simulate the 9:00 PM end-of-day check instantly during demos without waiting until midnight!

---

#### Zone 3: Live Agent Log Terminal (Console View)
* Clicking any of the 4 stages opens an expandable dark console box displaying timestamped agent execution lines:
  ```log
  [2026-10-23 08:00:00] [REMINDER_AGENT] Dispatched dose reminder email to marcus.r@example.com for Metformin 1000mg.
  [2026-10-23 21:00:00] [PATTERN_AGENT] Running end-of-day evaluation. Doses today: 0 taken, 2 skipped.
  [2026-10-23 21:00:01] [PATTERN_AGENT] 7-day adherence: 64% (threshold 75%). Triggering Level 1 Outreach.
  [2026-10-23 21:00:03] [WARNING_AGENT] Gemini generated clinical risk summary for Metformin: 'Glycemic variability & cardiovascular stress'.
  [2026-10-23 21:00:04] [WARNING_AGENT] Level 1 risk education email delivered to patient via Resend.
  [2026-10-23 21:05:00] [SOS_AGENT] Consecutive non-compliance >= 3 days. Level 2 SOS triggered.
  [2026-10-23 21:05:01] [SOS_AGENT] SOS alert delivered to Guardian (sarah.r@example.com).
  [2026-10-23 21:05:02] [SOS_AGENT] High-priority escalation posted to Dr. Chen's Care Team dashboard.
  ```

---

#### Zone 4: Clinical History & Team Roster
* **Left Card**: **Trust Score Trend Chart** (Sparkline showing the patient's adherence score evolution over 30 days).
* **Right Card**: **Care Team Roster** (PCP, Nurse Practitioner, Clinical Pharmacist, Care Coordinator) with quick communication channels.

---

### Summary of Benefits

1. **Zero Noise for Doctors**: Doctors are only disturbed when an actual SOS condition (Tier C) is met; the AI handles routine daily reminders (Tier A) and patient self-correction warnings (Tier B) autonomously.
2. **End-of-Day Calm**: Runs calmly at the end of each day, avoiding daytime spam.
3. **Total Visibility**: Doctors can click on any agent to inspect the exact logs and timestamps of what emails were sent to the patient and guardian.

Would you like me to begin implementing this updated Care Team page?