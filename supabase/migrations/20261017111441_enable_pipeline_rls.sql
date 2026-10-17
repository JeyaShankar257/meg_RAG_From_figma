-- Protect pipeline telemetry and derived adherence data exposed through the
-- Data API. Server-side workers continue to use the service role.

alter table pipeline_runs enable row level security;
alter table pipeline_stages enable row level security;
alter table pipeline_stage_logs enable row level security;
alter table adherence_records enable row level security;

create policy "Pipeline runs viewable by authorized users"
  on pipeline_runs for select
  to authenticated
  using (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or is_patient_self(patient_id)
      or get_current_user_role() = 'admin'
    )
  );

create policy "Pipeline stages viewable by authorized users"
  on pipeline_stages for select
  to authenticated
  using (
    exists (
      select 1
      from pipeline_runs pr
      where pr.id = pipeline_run_id
        and pr.workspace_id = get_current_user_workspace()
        and (
          is_assigned_doctor(pr.patient_id)
          or is_patient_self(pr.patient_id)
          or get_current_user_role() = 'admin'
        )
    )
  );

create policy "Pipeline logs viewable by authorized users"
  on pipeline_stage_logs for select
  to authenticated
  using (
    exists (
      select 1
      from pipeline_stages ps
      join pipeline_runs pr on pr.id = ps.pipeline_run_id
      where ps.id = pipeline_stage_id
        and pr.workspace_id = get_current_user_workspace()
        and (
          is_assigned_doctor(pr.patient_id)
          or is_patient_self(pr.patient_id)
          or get_current_user_role() = 'admin'
        )
    )
  );

create policy "Adherence records viewable by authorized users"
  on adherence_records for select
  to authenticated
  using (
    is_assigned_doctor(patient_id)
    or is_patient_self(patient_id)
    or (
      exists (
        select 1
        from patients p
        where p.id = adherence_records.patient_id
          and p.workspace_id = get_current_user_workspace()
      )
      and get_current_user_role() = 'admin'
    )
  );