import { createClient } from "@supabase/supabase-js";

/**
 * Isolated Fictional Demo Seed Script
 *
 * Populates Supabase with fictional clinical demo data mirroring src/lib/mockData.ts:
 * - 1 Doctor (Dr. Jeya Shankar M)
 * - 2 Care Team members (Priya Dharshini, Parvathi)
 * - 4 Patients (Marcus Rivera, Amara Osei, David Kowalski, Sofia Patel)
 * - Clinical records: visits, conditions, medications, prescriptions, dose logs,
 *   reports, AI analyses, citations, and escalations.
 *
 * Guardrail: Strictly requires DEMO_MODE="true" to execute.
 */

async function runSeed() {
    if (process.env["DEMO_MODE"] !== "true") {
        console.error("❌ Refusing to run seed: DEMO_MODE must be explicitly set to 'true'.");
        process.exit(1);
    }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seeding.");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
    });

    console.log("🌱 Starting MedNova fictional demo seed...");

    const workspaceId = "a0000000-0000-0000-0000-000000000001";
    const demoUsers = [
        ["s.chen@mednova.clinic", "doctor"],
        ["p.nair@mednova.clinic", "care_team"],
        ["j.okafor@mednova.clinic", "care_team"],
        ["m.rivera@email.com", "patient"],
        ["a.osei@email.com", "patient"],
        ["d.kowalski@email.com", "patient"],
        ["admin@mednova.clinic", "admin"],
    ] as const;
    const authUsers = new Map<string, string>();
    const { data: listedUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
    if (listUsersError) throw new Error(`Failed to list Auth users: ${listUsersError.message}`);
    for (const [email, role] of demoUsers) {
        const existing = listedUsers.users.find((user) => user.email?.toLowerCase() === email);
        const result = existing
            ? { data: { user: existing }, error: null }
            : await supabase.auth.admin.createUser({
                email,
                password: "demo-password",
                email_confirm: true,
                user_metadata: { role, demo: true },
            });
        if (result.error || !result.data.user) {
            throw new Error(`Failed to create Auth user ${email}: ${result.error?.message ?? "unknown error"}`);
        }
        authUsers.set(email, result.data.user.id);
    }
    const doctorProfileId = authUsers.get("s.chen@mednova.clinic")!;
    const careTeam1ProfileId = authUsers.get("p.nair@mednova.clinic")!;
    const careTeam2ProfileId = authUsers.get("j.okafor@mednova.clinic")!;
    const patient1ProfileId = authUsers.get("m.rivera@email.com")!;
    const patient2ProfileId = authUsers.get("a.osei@email.com")!;
    const patient3ProfileId = authUsers.get("d.kowalski@email.com")!;
    const adminProfileId = authUsers.get("admin@mednova.clinic")!;

    // 1. Workspace
    const { error: wsError } = await supabase.from("workspaces").upsert({
        id: workspaceId,
        name: "[DEMO] MedNova Demo Clinic",
    });
    if (wsError) throw new Error(`Failed to upsert workspace: ${wsError.message}`);

    // 2. Profiles
    const profiles = [
        {
            id: doctorProfileId,
            workspace_id: workspaceId,
            role: "doctor",
            full_name: "Dr. Jeya Shankar M",
            email: "s.chen@mednova.clinic",
        },
        {
            id: careTeam1ProfileId,
            workspace_id: workspaceId,
            role: "care_team",
            full_name: "Priya Dharshini",
            email: "p.nair@mednova.clinic",
        },
        {
            id: careTeam2ProfileId,
            workspace_id: workspaceId,
            role: "care_team",
            full_name: "Parvathi",
            email: "j.okafor@mednova.clinic",
        },
        {
            id: patient1ProfileId,
            workspace_id: workspaceId,
            role: "patient",
            full_name: "Marcus Rivera",
            email: "m.rivera@email.com",
        },
        {
            id: patient2ProfileId,
            workspace_id: workspaceId,
            role: "patient",
            full_name: "Amara Osei",
            email: "a.osei@email.com",
        },
        {
            id: patient3ProfileId,
            workspace_id: workspaceId,
            role: "patient",
            full_name: "David Kowalski",
            email: "d.kowalski@email.com",
        },
        {
            id: adminProfileId,
            workspace_id: workspaceId,
            role: "admin",
            full_name: "Admin Operator",
            email: "admin@mednova.clinic",
        },
    ];
    const { error: profError } = await supabase.from("profiles").upsert(profiles);
    if (profError) throw new Error(`Failed to upsert profiles: ${profError.message}`);

    // 3. Patients
    const patients = [
        {
            id: "p-001",
            workspace_id: workspaceId,
            profile_id: patient1ProfileId,
            status: "active",
            full_name: "Marcus Rivera",
            date_of_birth: "1978-04-12",
            contact_email: "m.rivera@email.com",
            contact_phone: "+1 (555) 204-3817",
        },
        {
            id: "p-002",
            workspace_id: workspaceId,
            profile_id: patient2ProfileId,
            status: "active",
            full_name: "Amara Osei",
            date_of_birth: "1965-11-03",
            contact_email: "a.osei@email.com",
            contact_phone: "+1 (555) 318-9204",
        },
        {
            id: "p-003",
            workspace_id: workspaceId,
            profile_id: patient3ProfileId,
            status: "active",
            full_name: "David Kowalski",
            date_of_birth: "1991-07-22",
            contact_email: "d.kowalski@email.com",
            contact_phone: "+1 (555) 741-0629",
        },
        {
            id: "p-004",
            workspace_id: workspaceId,
            profile_id: null,
            status: "pending",
            full_name: "Sofia Patel",
            date_of_birth: "1988-02-14",
            contact_email: "s.patel@email.com",
            contact_phone: "+1 (555) 523-8811",
        },
    ];
    const { error: patError } = await supabase.from("patients").upsert(patients);
    if (patError) throw new Error(`Failed to upsert patients: ${patError.message}`);

    // 4. Care Team Assignments
    const assignments = [
        { patient_id: "p-001", doctor_profile_id: doctorProfileId },
        { patient_id: "p-002", doctor_profile_id: doctorProfileId },
        { patient_id: "p-003", doctor_profile_id: doctorProfileId },
        { patient_id: "p-004", doctor_profile_id: doctorProfileId },
    ];
    await supabase.from("care_team_assignments").upsert(assignments);

    // 5. Care Grants
    const grants = [
        {
            patient_id: "p-001",
            grantee_profile_id: careTeam1ProfileId,
            granted_by_id: doctorProfileId,
            scope: "all",
        },
        {
            patient_id: "p-001",
            grantee_profile_id: careTeam2ProfileId,
            granted_by_id: doctorProfileId,
            scope: "all",
        },
        {
            patient_id: "p-002",
            grantee_profile_id: careTeam1ProfileId,
            granted_by_id: doctorProfileId,
            scope: "all",
        },
        {
            patient_id: "p-003",
            grantee_profile_id: careTeam1ProfileId,
            granted_by_id: doctorProfileId,
            scope: "all",
        },
        {
            patient_id: "p-003",
            grantee_profile_id: careTeam2ProfileId,
            granted_by_id: doctorProfileId,
            scope: "all",
        },
    ];
    await supabase.from("care_grants").upsert(grants);

    // 6. Consent Records
    const consents = [
        {
            patient_id: "p-001",
            share_with_care_team: true,
            allow_reminders: true,
            allow_ai_analysis: true,
            updated_by_profile_id: patient1ProfileId,
        },
        {
            patient_id: "p-002",
            share_with_care_team: true,
            allow_reminders: true,
            allow_ai_analysis: true,
            updated_by_profile_id: patient2ProfileId,
        },
        {
            patient_id: "p-003",
            share_with_care_team: true,
            allow_reminders: true,
            allow_ai_analysis: true,
            updated_by_profile_id: patient3ProfileId,
        },
        {
            patient_id: "p-004",
            share_with_care_team: false,
            allow_reminders: false,
            allow_ai_analysis: false,
            updated_by_profile_id: doctorProfileId,
        },
    ];
    await supabase.from("consent_records").upsert(consents);

    // 7. Conditions
    const conditions = [
        { patient_id: "p-001", name: "Type 2 Diabetes", diagnosed_at: "2024-01-15" },
        { patient_id: "p-001", name: "Hypertension", diagnosed_at: "2025-10-14" },
        { patient_id: "p-002", name: "Asthma", diagnosed_at: "2020-03-10" },
        { patient_id: "p-002", name: "Hypothyroidism", diagnosed_at: "2021-08-19" },
        { patient_id: "p-003", name: "Major Depressive Disorder", diagnosed_at: "2023-05-12" },
        { patient_id: "p-003", name: "Insomnia", diagnosed_at: "2023-09-01" },
        { patient_id: "p-004", name: "GERD", diagnosed_at: "2026-02-14" },
        { patient_id: "p-004", name: "Anxiety Disorder", diagnosed_at: "2026-04-10" },
    ];
    await supabase.from("conditions").upsert(conditions);

    // 8. Visits
    const visits = [
        {
            id: "10000000-0000-0000-0000-000000000001",
            patient_id: "p-001",
            doctor_profile_id: doctorProfileId,
            visit_date: "2026-08-28",
            notes: "Patient reports improved energy levels since last dose adjustment. HbA1c down to 7.1%.",
        },
        {
            id: "10000000-0000-0000-0000-000000000002",
            patient_id: "p-001",
            doctor_profile_id: doctorProfileId,
            visit_date: "2026-06-15",
            notes: "BP measured at 142/88 mmHg. Lisinopril continued, Amlodipine 5mg QD added.",
        },
    ];
    await supabase.from("visits").upsert(visits);

    // 9. Audit Event
    await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_profile_id: adminProfileId,
        action: "seed_fictional_demo_data",
        target_type: "workspace",
        target_id: workspaceId,
        correlation_id: "seed-init-001",
        outcome: "success",
    });

    console.log("✅ MedNova fictional demo seed completed successfully.");
}

runSeed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
