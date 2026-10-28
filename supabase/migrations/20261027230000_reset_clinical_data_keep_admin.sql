-- Migration: 20261027230000_reset_clinical_data_keep_admin.sql
-- Wipes all mock/clinical data and non-admin accounts, preserving admin mjeyashankar2005@gmail.com

-- 1. Disable triggers and foreign keys for session
SET session_replication_role = 'replica';

-- 2. Truncate all clinical and operational tables
TRUNCATE TABLE
  public.adherence_records,
  public.pipeline_stage_logs,
  public.jobs,
  public.pipeline_stages,
  public.pipeline_runs,
  public.document_indexing_jobs,
  public.rag_results,
  public.rag_queries,
  public.knowledge_chunks,
  public.knowledge_sources,
  public.notifications,
  public.notification_preferences,
  public.audit_events,
  public.correction_requests,
  public.escalations,
  public.ai_citations,
  public.ai_analyses,
  public.patient_reports,
  public.dose_logs,
  public.dose_schedules,
  public.prescription_revisions,
  public.prescriptions,
  public.medications,
  public.visits,
  public.conditions,
  public.care_team_assignments,
  public.care_grants,
  public.consent_records,
  public.patients
CASCADE;

-- 3. Clear practice credentials table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'practice_credentials') THEN
    DELETE FROM public.practice_credentials WHERE email != 'mjeyashankar2005@gmail.com';
  END IF;
END $$;

-- 4. Delete non-admin profiles from public.profiles
DELETE FROM public.profiles WHERE email != 'mjeyashankar2005@gmail.com';

-- 5. Delete non-admin auth records from Supabase Auth
DELETE FROM auth.sessions WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = 'mjeyashankar2005@gmail.com');
DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = 'mjeyashankar2005@gmail.com');
DELETE FROM auth.users WHERE email != 'mjeyashankar2005@gmail.com';

-- 6. Ensure default workspace exists
INSERT INTO public.workspaces (id, name)
VALUES ('a0000000-0000-0000-0000-000000000001', 'MedNova Health Clinic')
ON CONFLICT (id) DO NOTHING;

-- 7. Ensure admin user profile in public.profiles is fully registered and approved
INSERT INTO public.profiles (
  id,
  workspace_id,
  role,
  full_name,
  email,
  approval_status,
  must_change_password
)
SELECT 
  u.id,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin'::user_role,
  'Jeya Shankar M',
  'mjeyashankar2005@gmail.com',
  'approved'::profile_approval_status,
  false
FROM auth.users u
WHERE u.email = 'mjeyashankar2005@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin'::user_role,
  approval_status = 'approved'::profile_approval_status,
  must_change_password = false;

-- 8. Re-enable triggers and foreign keys
SET session_replication_role = 'origin';
