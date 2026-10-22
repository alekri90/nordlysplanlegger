-- Nordlys Planlegger — spontaneous plans: «Vi drar i Dyreparken kl. 14 – hvem er gira?»
--
-- A normal event with a fixed time today or tomorrow, marked spontaneous. Its invitation says so,
-- and push-dispatch sends it as time-sensitive (iPhone) / high priority on its own channel (Android).
-- Apple's «critical alerts» are only for health and safety apps, so they're not used.

alter table public.events add column spontaneous boolean not null default false;

-- Invitations made while creating a spontaneous plan get their own wording and flag.
create or replace function public.notifications_spontaneous()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
  v_when text;
begin
  if new.type <> 'invited' or coalesce(current_setting('planlegger.spontaneous', true), '') <> 'on' then return new; end if;
  select * into v_event from events where id = new.event_id;
  v_name := split_part(coalesce(nullif((select display_name from profiles where id = v_event.organizer_id), ''), 'Noen'), ' ', 1);
  v_when := case when v_event.selected_date = (now() at time zone v_event.timezone)::date then 'i dag' else 'i morgen' end
            || coalesce(' kl. ' || to_char(v_event.start_time, 'HH24:MI'), '');
  new.title := v_name || ': ' || v_event.title || ' ' || v_when;
  new.body := 'Er du gira? Trykk for å svare.';
  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('kind', 'spontaneous', 'spontaneous', true);
  return new;
end $$;
create trigger notifications_spontaneous before insert on public.notifications
  for each row execute function public.notifications_spontaneous();
revoke all on function public.notifications_spontaneous() from public, anon, authenticated;

-- Same as create_event, with the flag set before the invitations go out.
create or replace function public.create_spontaneous_event(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_date date := nullif(payload ->> 'fixed_date', '')::date;
begin
  if (payload ->> 'date_mode') is distinct from 'fixed' or v_date is null
     or v_date not between (now() at time zone 'Europe/Oslo')::date and (now() at time zone 'Europe/Oslo')::date + 1 then
    raise exception 'spontaneous_is_today_or_tomorrow' using errcode = '22023';
  end if;
  -- create_event inserts the invitations; the trigger above reads this flag.
  perform set_config('planlegger.spontaneous', 'on', true);
  v_result := create_event(payload);
  perform set_config('planlegger.spontaneous', '', true);
  update events set spontaneous = true where id = (v_result ->> 'event_id')::uuid;
  return v_result;
end $$;
revoke all on function public.create_spontaneous_event(jsonb) from public, anon;
grant execute on function public.create_spontaneous_event(jsonb) to authenticated;
