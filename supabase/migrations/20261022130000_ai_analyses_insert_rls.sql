-- Add missing INSERT and DELETE RLS policies for ai_analyses and ai_citations

CREATE POLICY "AI analyses insertable by doctor, admin, or service role"
ON ai_analyses FOR INSERT
WITH CHECK (
  is_assigned_doctor(patient_id)
  OR get_current_user_role() = 'admin'::user_role
  OR auth.role() = 'service_role'
  OR auth.jwt() IS NULL
);

CREATE POLICY "AI citations insertable by doctor, admin, or service role"
ON ai_citations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ai_analyses a
    WHERE a.id = ai_citations.analysis_id
      AND (is_assigned_doctor(a.patient_id) OR get_current_user_role() = 'admin'::user_role)
  )
  OR auth.role() = 'service_role'
  OR auth.jwt() IS NULL
);

CREATE POLICY "AI analyses deletable by admin or service role"
ON ai_analyses FOR DELETE
USING (
  get_current_user_role() = 'admin'::user_role
  OR auth.role() = 'service_role'
  OR auth.jwt() IS NULL
);

CREATE POLICY "AI citations deletable by admin or service role"
ON ai_citations FOR DELETE
USING (
  get_current_user_role() = 'admin'::user_role
  OR auth.role() = 'service_role'
  OR auth.jwt() IS NULL
);
