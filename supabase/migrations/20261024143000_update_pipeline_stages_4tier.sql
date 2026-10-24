-- Migration: Add 4-tier pipeline stage keys to pipeline_stage_key enum
ALTER TYPE pipeline_stage_key ADD VALUE IF NOT EXISTS 'patient_warning_agent';
ALTER TYPE pipeline_stage_key ADD VALUE IF NOT EXISTS 'sos_agent';
