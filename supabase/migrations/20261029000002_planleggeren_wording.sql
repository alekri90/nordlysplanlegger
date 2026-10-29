-- «Nordlys» is the parent brand, not something that acts in the app. Say «Planleggeren».
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.run_event_series(timestamptz)'::regprocedure) into v_def;
  execute replace(v_def, 'Nordlys velger dagen flest kan.', 'Planleggeren velger dagen flest kan.');
end $$;
