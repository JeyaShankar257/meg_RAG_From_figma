-- Migration: Enable pg_cron and pg_net extensions and configure nightly adherence evaluation
-- Schedule: Every day at 17:30 UTC (11:00 PM IST)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedules old job if already registered to ensure idempotency
SELECT cron.unschedule('nightly-adherence-eval')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'nightly-adherence-eval'
);

-- Register cron job
-- Note: Replace http://localhost:3001 or set your production MedNova API domain and ADMIN_SECRET
SELECT cron.schedule(
    'nightly-adherence-eval',
    '30 17 * * *',
    $$
    SELECT net.http_post(
        url := coalesce(current_setting('app.settings.api_url', true), 'http://localhost:3001') || '/admin/patients/evaluate-all',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-admin-secret', coalesce(current_setting('app.settings.admin_secret', true), 'change-me-in-production-for-pgcron-admin-eval')
        ),
        body := '{}'::jsonb
    );
    $$
);

