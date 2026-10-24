-- Migration: Add emergency guardian contact details to patients table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_phone text;

COMMENT ON COLUMN patients.guardian_name IS 'Full name of emergency caregiver / guardian for Level 2 SOS escalations';
COMMENT ON COLUMN patients.guardian_email IS 'Email address of emergency caregiver / guardian';
COMMENT ON COLUMN patients.guardian_phone IS 'Phone number of emergency caregiver / guardian';
