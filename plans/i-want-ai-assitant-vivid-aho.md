# Plan: AI Assistant → Prescribe Medicine → Doctor Approval → Pipeline Trigger

## Context

The user wants the AI Assistant (in the doctor's Patient Page) to do more than just analyze symptoms — it should also **suggest a list of medicines** with quantity and number of days for each. The doctor reviews this AI-suggested prescription list, edits if needed, then **approves** it. On approval:

1. The prescription(s) are saved (to mock state / later to Supabase).
2. The agentic AI workflow pipeline is triggered — specifically the **Reminder Agent** (generates dose schedule slots) and the downstream chain (Pattern Detection → Escalation → Care Team).
3. The Care Team pipeline view reflects the new run.

This closes the loop between "AI suggests medicine" → "doctor approves" → "pipeline activates."

---

## What the user means (my understanding)

- The AI Assistant, after analyzing symptoms, outputs a **structured prescription suggestion**: one or more medicines, each with name, strength, frequency, quantity (tablets), and number of days.
- This suggestion appears as a **distinct, editable prescription proposal card** directly within the AI result — not just free-text.
- The doctor can edit each field inline, then click **"Approve & Prescribe"** (a single clear CTA).
- Approval triggers the mock agentic workflow: pipeline stages update to "running" then "complete", and the new prescription appears in the Prescription tab as `status: "active"` with `suggestedBy: "ai"`.
- The UI must make it visually clear that the AI suggested it and the doctor approved it.

---

## Files to modify

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `AIPrescriptionSuggestion` type and `suggestedMedications` field to `AIAnalysis` |
| `src/lib/mockData.ts` | Add `suggestedMedications` to `DEMO_AI_ANALYSIS`; add new pipeline trigger mock function |
| `src/pages/doctor/PatientPage.tsx` | Extend AI Assistant tab to show structured prescription suggestion; add approve flow; update Prescription tab on approval |
| `src/pages/doctor/CareTeamPage.tsx` | React to pipeline trigger — pipeline stages animate to "running" then "complete" when prescription is approved |

---

## Detailed changes

### 1. New type: `AIPrescriptionSuggestion` (`src/lib/types.ts`)

Add to `AIAnalysis`:
```ts
export interface AIPrescriptionSuggestion {
  name: string;           // e.g. "Metformin"
  genericName: string;    // e.g. "Metformin HCl"
  strength: string;       // e.g. "500"
  unit: string;           // e.g. "mg"
  frequency: string;      // e.g. "Twice daily (BID)"
  quantity: number;       // e.g. 60
  days: number;           // e.g. 30
  instructions: string;
  reasoning: string;      // Why AI suggested this medicine
  citations: Citation[];  // Supporting evidence
}
```

Add optional field to `AIAnalysis`:
```ts
suggestedMedications?: AIPrescriptionSuggestion[];
```

### 2. Mock data update (`src/lib/mockData.ts`)

Add `suggestedMedications` array to `DEMO_AI_ANALYSIS` with 2 medicines:
- **Jardiance (Empagliflozin) 10mg** QD, 30 tablets, 30 days — for SGLT2 benefit given T2DM + hypertension
- **Vitamin D3 1000IU** QD, 30 tablets, 30 days — commonly deficient in T2DM patients

Each with a reasoning string and 1-2 citations.

### 3. AI Assistant tab — prescription suggestion UI (`src/pages/doctor/PatientPage.tsx`)

After the existing AI result cards (confidence, reasoning, safety flags), add a new section **"AI Prescription Suggestion"** when `aiResult.suggestedMedications` is present:

- Section header: "AI Prescription Suggestion" + amber badge "Requires doctor approval before prescribing"
- One card per suggested medicine showing: name/strength, frequency, quantity, days, instructions, reasoning, collapsible citations
- Each field is **inline-editable** (the doctor can change strength, quantity, days before approving)
- A prominent **"Approve & Prescribe"** button (green/success) at the bottom of the section
- On click: shows a confirmation modal ("You are about to prescribe X medicines. This will generate dose schedules and activate reminders.") with Cancel / Confirm
- On confirm: `handleApprovePrescription()` runs:
  1. Adds the approved medicines to `activePrescriptions` state (shown in Prescription tab)
  2. Marks `aiResult.reviewed = true`
  3. Triggers `pipelineTriggered = true` (shared via a small piece of state or context — passed as prop to CareTeamPage if navigated there)
  4. Shows a success toast: "Prescription approved. Dose schedule generation triggered."

### 4. Prescription tab update

The Prescription tab already renders `DEMO_PRESCRIPTIONS`. After `handleApprovePrescription()`:
- Newly approved medicines appear at the top of the list with `suggestedBy: "ai"` badge and a green "Just approved" highlight for 3 seconds
- Status shows `"active"`

### 5. Care Team pipeline animation (`src/pages/doctor/CareTeamPage.tsx`)

Add a `pipelineTriggered` prop (or read from a shared `sessionStorage` flag). When triggered:
- Stage 1 (Reminder Agent): animates to "running" for 1.5s, then "complete" — log entry: "Dose schedule generated for new AI-approved prescription"
- Stage 2 (Dose Logging Agent): stays idle (no doses logged yet)
- Stage 3 (Pattern Detection Agent): animates to "running" after 2s, then "complete" — log: "Initial pattern eval: new prescription, no data yet, severity: none"
- Stage 4 & 5: remain as-is

Use `useState` + `useEffect` with `setTimeout` to sequence the animation.

To share state between PatientPage and CareTeamPage without a full state manager, use `sessionStorage` key `"pipeline_triggered"` — CareTeamPage reads it on mount.

---

## UI design notes

- The prescription suggestion block sits **between** the AI reasoning card and the citations card in the AI Assistant tab — keeping the flow: analyze → suggest → cite
- Each medicine card in the suggestion has a light teal-50 background with teal border to distinguish it as AI-generated, not yet official
- Editable fields use a subtle underline-input style (not heavy bordered boxes) so the card feels clean but editable
- The "Approve & Prescribe" CTA is full-width, success green (emerald-600), with a stethoscope or checkmark icon
- Approved prescriptions in the Prescription tab get a "AI Suggested · Doctor Approved" dual-badge row

---

## Verification

1. Navigate to `/doctor/patients/p-001` → AI Assistant tab
2. Enter symptoms → click "Run Analysis"
3. After 2.5s, AI result appears including the "AI Prescription Suggestion" section with 2 medicines
4. Edit one field (e.g. change days from 30 to 45)
5. Click "Approve & Prescribe" → confirm modal → Confirm
6. Toast appears: "Prescription approved. Dose schedule generation triggered."
7. Switch to Prescription tab → new medicines appear at top with AI badge
8. Navigate to Care Team page → pipeline stages animate: Reminder Agent runs → complete, Pattern Detection runs → complete
9. Click Reminder Agent stage → log shows the new prescription entry
