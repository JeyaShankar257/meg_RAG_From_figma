-- Migration: Patient Adherence Reports (Weekly & Monthly)
-- Creates patient_adherence_reports table, indexes, RLS policies, and periodic pg_cron dispatches

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.patient_adherence_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    adherence_percent INTEGER NOT NULL DEFAULT 0,
    taken_count INTEGER NOT NULL DEFAULT 0,
    total_doses INTEGER NOT NULL DEFAULT 0,
    missed_days INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),
    insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    html_content TEXT,
    email_dispatch_id TEXT,
    delivered_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for performance (patient lookup, latest reports first)
CREATE INDEX IF NOT EXISTS idx_adherence_reports_patient_date
    ON public.patient_adherence_reports (patient_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_adherence_reports_patient_period
    ON public.patient_adherence_reports (patient_id, period);

-- 3. Row Level Security
ALTER TABLE public.patient_adherence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Adherence reports viewable by self" ON public.patient_adherence_reports;
CREATE POLICY "Adherence reports viewable by self"
    ON public.patient_adherence_reports FOR SELECT
    USING (is_patient_self(patient_id));

DROP POLICY IF EXISTS "Adherence reports viewable by care team" ON public.patient_adherence_reports;
CREATE POLICY "Adherence reports viewable by care team"
    ON public.patient_adherence_reports FOR SELECT
    USING (get_current_user_role() IN ('admin', 'doctor'));

DROP POLICY IF EXISTS "Adherence reports manageable by admin" ON public.patient_adherence_reports;
CREATE POLICY "Adherence reports manageable by admin"
    ON public.patient_adherence_reports FOR ALL
    USING (get_current_user_role() = 'admin');

-- 4. Notification Preferences extension
ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS weekly_report_email BOOLEAN DEFAULT TRUE;

-- 5. Periodic pg_cron Schedules
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Weekly: every Sunday at 18:00 UTC (11:30 PM IST)
SELECT cron.unschedule('weekly-patient-report-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-patient-report-dispatch');

SELECT cron.schedule(
    'weekly-patient-report-dispatch',
    '0 18 * * 0',
    $$
    SELECT net.http_post(
        url := coalesce(current_setting('app.settings.api_url', true), 'http://localhost:3001') || '/admin/reports/dispatch-periodic?period=weekly',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-admin-secret', coalesce(current_setting('app.settings.admin_secret', true), 'change-me-in-production-for-pgcron-admin-eval')
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Monthly: 1st of every month at 18:00 UTC
SELECT cron.unschedule('monthly-patient-report-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-patient-report-dispatch');

SELECT cron.schedule(
    'monthly-patient-report-dispatch',
    '0 18 1 * *',
    $$
    SELECT net.http_post(
        url := coalesce(current_setting('app.settings.api_url', true), 'http://localhost:3001') || '/admin/reports/dispatch-periodic?period=monthly',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-admin-secret', coalesce(current_setting('app.settings.admin_secret', true), 'change-me-in-production-for-pgcron-admin-eval')
        ),
        body := '{}'::jsonb
    );
    $$
);
