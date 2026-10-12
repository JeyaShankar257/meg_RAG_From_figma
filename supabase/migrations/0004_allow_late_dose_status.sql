-- Dose logging distinguishes an on-time dose from a dose logged after its schedule.
do $$
begin
  alter type dose_status add value if not exists 'late';
exception
  when duplicate_object then null;
end $$;
