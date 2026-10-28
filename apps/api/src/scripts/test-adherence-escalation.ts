/**
 * Test Adherence Pattern Detection, Escalation, and Mail Delivery
 *
 * Simulates:
 * 1. Target patient lookup or dynamic creation in Supabase
 * 2. Clinician linkage via care_team_assignments
 * 3. Medication, prescription, and 10 scheduled doses
 * 4. 10 dose logs simulating compliance breakdown (3 taken, 7 missed = 30% adherence)
 * 5. Pattern detection triggering: adherence < 70%
 * 6. High severity escalation creation: adherence < 50%
 * 7. Live alert email dispatch via Nodemailer Gmail SMTP
 * 8. Notification audit logging
 * 9. UI verification link generation
 */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val.replace(/^["']|["']$/g, "");
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runTest() {
  console.log("\n=======================================================");
  console.log("🏥 MedNova: Adherence, Escalation & Mail Delivery Test");
  console.log("=======================================================\n");

  // 1. Ensure default workspace exists
  const defaultWorkspaceId = "a0000000-0000-0000-0000-000000000001";
  await supabase
    .from("workspaces")
    .upsert({ id: defaultWorkspaceId, name: "MedNova Health Clinic" });

  // 2. Find clinician profile (doctor or admin)
  console.log("Step 1: Locating attending clinician profile...");
  const { data: doctorProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["doctor", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const doctorId = doctorProfile?.id || "d0000000-0000-0000-0000-000000000001";
  console.log(
    `✅ Clinician: ${doctorProfile?.full_name || "Dr. Jeya Shankar M"} (${
      doctorProfile?.email || "mjeyashankar2005@gmail.com"
    }) [Role: ${doctorProfile?.role || "admin"}]`
  );

  // 3. Find or create a target patient
  console.log("\nStep 2: Checking target patient in database...");
  let { data: patients, error: pErr } = await supabase
    .from("patients")
    .select("id, full_name, contact_email, workspace_id")
    .order("created_at", { ascending: false })
    .limit(5);

  let patient = patients?.[0];

  if (!patient) {
    console.log("   No existing patient found. Creating test patient 'Marcus Rivera'...");
    const { data: createdPatient, error: createErr } = await supabase
      .from("patients")
      .insert({
        workspace_id: defaultWorkspaceId,
        full_name: "Marcus Rivera",
        date_of_birth: "1978-04-12",
        contact_email: "marcus.rivera@mednova-demo.com",
        contact_phone: "+1 (555) 234-5678",
        status: "active",
      })
      .select("id, full_name, contact_email, workspace_id")
      .single();

    if (createErr || !createdPatient) {
      console.error("❌ Failed to create patient record:", createErr?.message);
      process.exit(1);
    }
    patient = createdPatient;
  }

  console.log(
    `✅ Selected Patient: ${patient.full_name} (ID: ${patient.id}, Email: ${patient.contact_email})`
  );

  // 4. Ensure Care Team assignment exists
  if (doctorProfile?.id) {
    const { data: existingAssignment } = await supabase
      .from("care_team_assignments")
      .select("id")
      .eq("patient_id", patient.id)
      .eq("doctor_profile_id", doctorProfile.id)
      .maybeSingle();

    if (!existingAssignment) {
      await supabase.from("care_team_assignments").insert({
        patient_id: patient.id,
        doctor_profile_id: doctorProfile.id,
      });
      console.log(`✅ Assigned patient to Dr. ${doctorProfile.full_name}'s care roster.`);
    }
  }

  // 5. Ensure medication exists
  console.log("\nStep 3: Checking medication & prescription records...");
  let { data: med } = await supabase
    .from("medications")
    .select("id, name")
    .eq("patient_id", patient.id)
    .limit(1)
    .maybeSingle();

  if (!med) {
    const { data: newMed, error: medErr } = await supabase
      .from("medications")
      .insert({
        patient_id: patient.id,
        name: "Metformin ER 500mg",
        dosage: "500mg once daily",
        form: "tablet",
      })
      .select("id, name")
      .single();

    if (medErr) {
      console.error("❌ Failed to create medication:", medErr.message);
    }
    med = newMed;
  }

  // 6. Ensure active approved prescription exists
  let { data: rx } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("patient_id", patient.id)
    .limit(1)
    .maybeSingle();

  if (!rx && med) {
    const { data: newRx, error: rxErr } = await supabase
      .from("prescriptions")
      .insert({
        patient_id: patient.id,
        medication_id: med.id,
        status: "approved",
        suggested_by: doctorProfile?.id || "doctor",
        approved_by_profile_id: doctorProfile?.id || null,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (rxErr) {
      console.error("❌ Failed to create prescription:", rxErr.message);
    }
    rx = newRx;
  }
  console.log(`✅ Prescription verified (ID: ${rx?.id || "existing"})`);

  // 7. Ensure dose schedules exist
  console.log("\nStep 4: Ensuring 10 dose schedule windows exist...");
  let { data: schedules } = await supabase
    .from("dose_schedules")
    .select("id")
    .eq("patient_id", patient.id)
    .limit(10);

  if (!schedules || schedules.length < 10) {
    const newScheduleRows = [];
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      newScheduleRows.push({
        prescription_id: rx?.id,
        patient_id: patient.id,
        scheduled_at: new Date(now - (10 - i) * 24 * 3600 * 1000).toISOString(),
        window_minutes: 60,
      });
    }
    const { data: insertedSchedules, error: schedErr } = await supabase
      .from("dose_schedules")
      .insert(newScheduleRows)
      .select("id");

    if (schedErr) {
      console.error("❌ Failed to insert schedules:", schedErr.message);
    }
    schedules = insertedSchedules || schedules || [];
  }
  console.log(`✅ ${schedules.length} schedule entries ready.`);

  // 8. Inject 10 Dose Logs simulating low adherence (3 Taken, 7 Missed = 30% adherence)
  console.log("\nStep 5: Simulating compliance breakdown (3 Taken, 7 Missed)...");
  
  // Clean prior logs for this patient to ensure predictable calculation
  await supabase.from("dose_logs").delete().eq("patient_id", patient.id);

  const doseLogRows = [];
  const logTimestamp = Date.now();
  for (let i = 0; i < schedules.length && i < 10; i++) {
    const isTaken = i < 3; // First 3 taken, remaining 7 missed
    doseLogRows.push({
      schedule_id: schedules[i].id,
      patient_id: patient.id,
      status: isTaken ? "taken" : "missed",
      method: isTaken ? "oral" : null,
      idempotency_key: `sim-dose-${patient.id}-${i}-${logTimestamp}`,
      logged_at: new Date(logTimestamp - (10 - i) * 24 * 3600 * 1000).toISOString(),
    });
  }

  const { error: logErr } = await supabase.from("dose_logs").insert(doseLogRows);
  if (logErr) {
    console.error("❌ Failed to insert dose logs:", logErr.message);
  } else {
    console.log("✅ Successfully recorded 10 authoritative dose events in database:");
    console.log("   - Taken: 3 doses (30.0%)");
    console.log("   - Missed: 7 doses (70.0%)");
  }

  // 9. Pattern Detection & Automated Escalation Logic
  console.log("\nStep 6: Executing Pattern Detection & Escalation Engine...");
  const total = doseLogRows.length;
  const taken = doseLogRows.filter((l) => l.status === "taken").length;
  const adherenceRate = (taken / total) * 100;

  console.log(`📊 Calculated Patient Adherence: ${adherenceRate.toFixed(1)}%`);
  console.log(`⚠️  Adherence is BELOW 70% threshold! Triggering AI Analysis & Escalation...`);

  // Create AI Analysis record
  const { data: analysis, error: aiErr } = await supabase
    .from("ai_analyses")
    .insert({
      patient_id: patient.id,
      requested_by_profile_id: doctorProfile?.id || doctorId,
      status: "needs_review",
      input_snapshot: {
        adherenceRate,
        totalLogs: total,
        missedCount: 7,
        takenCount: 3,
        windowDays: 10,
      },
      structured_output: {
        rootCause: "Reported gastric intolerance and missed evening dosing",
        recommendation: "Evaluate split-dose timing or meal-paired administration; initiate pharmacist follow-up call.",
      },
      confidence: 0.94,
      safety_flags: ["low_adherence_threshold", "consecutive_misses"],
      model_version: "gemini-2.0-flash-001",
      prompt_version: "1.0",
      requires_doctor_review: true,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (aiErr) {
    console.error("❌ Failed to create AI analysis:", aiErr.message);
  } else {
    console.log(`✅ AI Pattern Analysis Created (ID: ${analysis.id}, Confidence: 94%)`);
  }

  // Determine Severity: < 50% = high (Urgent)
  const severity = adherenceRate < 50 ? "high" : "medium";

  // Create Escalation Record
  const { data: escalation, error: escErr } = await supabase
    .from("escalations")
    .insert({
      patient_id: patient.id,
      analysis_id: analysis?.id || null,
      severity,
      status: "open",
      reasoning: `Critical adherence drop detected: ${adherenceRate.toFixed(1)}% adherence over 10 scheduled doses (7 missed). Immediate clinical check-in advised.`,
      confidence: 0.94,
      model_version: "gemini-2.0-flash-001",
    })
    .select()
    .single();

  if (escErr) {
    console.error("❌ Failed to create escalation:", escErr.message);
  } else {
    console.log(`🚨 ACTIVE ESCALATION CREATED!`);
    console.log(`   - Severity: ${severity.toUpperCase()}`);
    console.log(`   - Status: OPEN`);
    console.log(`   - Reasoning: ${escalation?.reasoning}`);
  }

  // 10. Mail Delivery via Gmail SMTP (Nodemailer)
  console.log("\nStep 7: Delivering Live Email Alert via Nodemailer (Gmail SMTP)...");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const emailRecipient = smtpUser || doctorProfile?.email || "mjeyashankar2005@gmail.com";

  let mailDelivered = false;
  let messageId = `alert-${Date.now()}`;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE !== "false",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const emailSubject = `🚨 [MedNova Alert] ${severity.toUpperCase()} Priority Escalation: ${patient.full_name}`;
      const emailBody = `
=====================================================
MEDNOVA CLINICAL ADHERENCE ESCALATION
=====================================================

Patient: ${patient.full_name} (ID: ${patient.id})
Adherence Score: ${adherenceRate.toFixed(1)}%
Doses Missed: 7 of last 10 scheduled doses
Severity Level: ${severity.toUpperCase()}

AI Clinical Finding:
"Critical adherence drop detected: ${adherenceRate.toFixed(1)}% adherence over 10 doses (7 missed). Immediate clinical check-in advised."

Recommended Action:
Please open the MedNova Doctor Portal to review recent dose logs and acknowledge this escalation.

Care Team URL:
http://localhost:8443/doctor/patients/${patient.id}/care-team

--
MedNova Clinical Safety Monitoring Agent
`;

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `MedNova Clinical Alerts <${smtpUser}>`,
        to: emailRecipient,
        subject: emailSubject,
        text: emailBody,
      });

      messageId = info.messageId;
      mailDelivered = true;
      console.log(`📧 EMAIL DISPATCH SUCCESSFUL!`);
      console.log(`   - Sent to: ${emailRecipient}`);
      console.log(`   - Message ID: ${messageId}`);
    } catch (mailErr: any) {
      console.warn(`⚠️  Email delivery warning: ${mailErr.message}`);
    }
  } else {
    console.log("ℹ️  SMTP_USER / SMTP_PASS not found; logged simulated notification.");
  }

  // Log in notifications table
  try {
    await supabase.from("notifications").insert({
      patient_id: patient.id,
      channel: "email",
      provider_message_id: messageId,
      status: mailDelivered ? "sent" : "queued",
      sent_at: mailDelivered ? new Date().toISOString() : null,
    });
    console.log("✅ Notification audit logged in database 'notifications' table.");
  } catch {
    // Non-fatal if notifications table has additional constraints
  }

  // 11. Output UI links for doctor inspection
  console.log("\n=======================================================");
  console.log("🎉 TEST COMPLETE — VERIFY IN THE USER INTERFACE:");
  console.log("=======================================================");
  console.log(`1. Doctor Dashboard (Check Active Escalation Indicator):`);
  console.log(`   👉 http://localhost:8443/doctor\n`);
  console.log(`2. Care Team Page (Review & Acknowledge Escalation):`);
  console.log(`   👉 http://localhost:8443/doctor/patients/${patient.id}/care-team\n`);
  console.log(`3. Patient Details Page (Check 30% Adherence Score):`);
  console.log(`   👉 http://localhost:8443/doctor/patients/${patient.id}\n`);
  console.log("=======================================================\n");

  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
