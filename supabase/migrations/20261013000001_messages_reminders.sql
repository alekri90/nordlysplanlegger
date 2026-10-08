-- Nordlys Planlegger — event messages, "kan ikke likevel" and reminders
--
-- Messages: the organizer posts short updates on an event ("Vi møtes ved inngangen"). Everyone with
-- an account gets a notification; the organizer sees how many have seen each one.
-- Declines: when someone who said yes (or answered the poll) says they can't make it after the date
-- is set, the organizer is told — from the app and from the guest web page alike.
-- Reminders (Europe/Oslo by default, per event timezone), run every 15 minutes by pg_cron:
--   • Monday 08:00 — "Denne uken: …" for everyone with something planned this week
--   • 10:00 the day before — "I morgen: …" (skipped if the Monday overview went out the same day)
--   • about 2 hours before, when a start time is set
--   • "Venter på svaret ditt" to people who haven't answered a date poll after 2 days (once)

alter type public.notification_type add value if not exists 'event_message';

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on public.event_messages (event_id, created_at desc);
alter table public.event_messages enable row level security;
create policy event_messages_select on public.event_messages for select using (public.is_event_member(event_id));
alter publication supabase_realtime add table public.event_messages;

/** When this member last looked at the messages ("sett av 5"). */
alter table public.event_members add column messages_seen_at timestamptz;

create or replace function public.post_event_message(p_event_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_event events;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_event from events where id = p_event_id;
  if not found or v_event.organizer_id <> v_me then raise exception 'not_event_organizer' using errcode = '42501'; end if;
  if v_body = '' then raise exception 'message_empty' using errcode = '22023'; end if;

  insert into event_messages (event_id, author_id, body) values (p_event_id, v_me, left(v_body, 1000)) returning id into v_id;
  update event_members set messages_seen_at = now() where event_id = p_event_id and user_id = v_me;

  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'event_message', p_event_id, v_me,
         coalesce(nullif(v_name, ''), 'Arrangøren') || ' · ' || v_event.title,
         left(v_body, 140), jsonb_build_object('url', '/event/' || p_event_id)
  from event_members m
  where m.event_id = p_event_id and m.user_id is not null and m.user_id <> v_me and m.status <> 'declined';
  return v_id;
end $$;

/** Messages newest first; the author also gets how many have seen each one. */
create or replace function public.list_event_messages(p_event_id uuid)
returns table (id uuid, body text, created_at timestamptz, author_id uuid, author_name text, author_avatar text, seen_count int, recipient_count int)
language sql stable security definer set search_path = public as $$
  select msg.id, msg.body, msg.created_at, msg.author_id, p.display_name, p.avatar_url,
         case when msg.author_id = auth.uid() then
           (select count(*)::int from event_members m
             where m.event_id = msg.event_id and m.user_id is not null and m.user_id <> msg.author_id
               and m.status <> 'declined' and m.messages_seen_at >= msg.created_at)
         end,
         case when msg.author_id = auth.uid() then
           (select count(*)::int from event_members m
             where m.event_id = msg.event_id and m.user_id is not null and m.user_id <> msg.author_id and m.status <> 'declined')
         end
  from event_messages msg
  left join profiles p on p.id = msg.author_id
  where msg.event_id = p_event_id and is_event_member(p_event_id)
  order by msg.created_at desc
  limit 50;
$$;

create or replace function public.mark_event_messages_seen(p_event_id uuid)
returns void language sql security definer set search_path = public as $$
  update event_members set messages_seen_at = now() where event_id = p_event_id and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- "Kan ikke likevel" → tell the organizer
-- ---------------------------------------------------------------------------
create or replace function public.notify_organizer_on_decline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
begin
  select * into v_event from events where id = new.event_id;
  if v_event.status not in ('date_selected', 'confirmed') or new.user_id = v_event.organizer_id then
    return new;
  end if;
  v_name := split_part(coalesce(nullif((select display_name from profiles where id = new.user_id), ''), nullif(new.display_name, ''), 'En gjest'), ' ', 1);
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  values (v_event.organizer_id, 'response_received', v_event.id, new.user_id,
          v_name || ' kan ikke likevel', v_event.title, jsonb_build_object('url', '/event/' || v_event.id));
  return new;
end $$;
create trigger event_members_decline_notify after update of status on public.event_members
  for each row when (new.status = 'declined' and old.status in ('attending', 'responded'))
  execute function public.notify_organizer_on_decline();

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
create or replace function public.weekday_short(p_date date)
returns text language sql immutable as $$
  select (array['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'])[extract(isodow from p_date)::int];
$$;

/** "Badstu med jentene · lør kl. 18:00" */
create or replace function public.event_when_line(p_event events)
returns text language sql stable as $$
  select p_event.title || ' · ' || weekday_short(p_event.selected_date)
         || coalesce(' kl. ' || to_char(p_event.start_time, 'HH24:MI'), '');
$$;

/** Runs every 15 minutes. p_now is for tests. Idempotent: each reminder is sent once. */
create or replace function public.send_event_reminders(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_now at time zone 'Europe/Oslo';
  v_today date := v_local::date;
  v_quarter boolean := extract(minute from v_local) < 15;  -- first run of the hour
begin
  -- Monday 08:00: this week's plans, one notification per person.
  if extract(isodow from v_today) = 1 and extract(hour from v_local) = 8 and v_quarter then
    insert into notifications (user_id, type, title, body, data)
    select m.user_id, 'event_reminder', 'Denne uken',
           string_agg(event_when_line(e), ' · ' order by e.selected_date, e.start_time nulls last),
           jsonb_build_object('kind', 'weekly', 'date', v_today, 'url', '/')
    from events e
    join event_members m on m.event_id = e.id and m.user_id is not null and m.status <> 'declined'
    where e.status in ('date_selected', 'confirmed') and e.selected_date between v_today and v_today + 6
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.type = 'event_reminder'
                      and x.data ->> 'kind' = 'weekly' and x.data ->> 'date' = v_today::text)
    group by m.user_id;
  end if;

  -- 10:00 the day before ("I morgen: …"), unless this morning's overview already covered it.
  if extract(hour from v_local) = 10 and v_quarter then
    insert into notifications (user_id, type, event_id, title, body, data)
    select m.user_id, 'event_reminder', e.id, 'I morgen: ' || e.title,
           coalesce('Kl. ' || to_char(e.start_time, 'HH24:MI'), 'Gleder du deg?')
             || coalesce(' · ' || (select l.name from event_locations l where l.event_id = e.id), ''),
           jsonb_build_object('kind', 'day_before', 'url', '/event/' || e.id)
    from events e
    join event_members m on m.event_id = e.id and m.user_id is not null and m.status <> 'declined'
    where e.status in ('date_selected', 'confirmed') and e.selected_date = v_today + 1
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                      and x.type = 'event_reminder' and x.data ->> 'kind' = 'day_before')
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.type = 'event_reminder'
                      and x.data ->> 'kind' = 'weekly' and x.data ->> 'date' = v_today::text);
  end if;

  -- About 2 hours before, when there's a start time.
  insert into notifications (user_id, type, event_id, title, body, data)
  select m.user_id, 'event_reminder', e.id, 'Om 2 timer: ' || e.title,
         'Kl. ' || to_char(e.start_time, 'HH24:MI')
           || coalesce(' · ' || (select l.name from event_locations l where l.event_id = e.id), ''),
         jsonb_build_object('kind', 'soon', 'url', '/event/' || e.id)
  from events e
  join event_members m on m.event_id = e.id and m.user_id is not null and m.status <> 'declined'
  where e.status in ('date_selected', 'confirmed') and e.start_time is not null
    and ((e.selected_date + e.start_time) at time zone e.timezone) > p_now + interval '1 hour 45 minutes'
    and ((e.selected_date + e.start_time) at time zone e.timezone) <= p_now + interval '2 hours'
    and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                    and x.type = 'event_reminder' and x.data ->> 'kind' = 'soon');

  -- Haven't answered a date poll after 2 days (once, between 09 and 21).
  if extract(hour from v_local) between 9 and 20 then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    select m.user_id, 'reminder_respond', e.id, e.organizer_id,
           split_part(coalesce(nullif(p.display_name, ''), 'Arrangøren'), ' ', 1) || ' venter på svaret ditt',
           e.title || ' – trykk på dagene du ikke kan',
           jsonb_build_object('kind', 'respond', 'url', '/event/' || e.id)
    from events e
    join event_members m on m.event_id = e.id and m.user_id is not null and m.user_id <> e.organizer_id
                         and m.status in ('invited', 'opened')
    left join profiles p on p.id = e.organizer_id
    where e.status = 'polling' and e.created_at < p_now - interval '2 days'
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                      and x.type = 'reminder_respond');
  end if;

  -- Once a day: the organizer nudges, completed events and quiet groups.
  if extract(hour from v_local) = 9 and v_quarter then
    perform generate_nudges();
  end if;
end $$;

revoke all on function public.send_event_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.notify_organizer_on_decline() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.post_event_message(uuid, text)', 'public.list_event_messages(uuid)', 'public.mark_event_messages_seen(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Every 15 minutes. Needs pg_cron (on by default on Supabase); skipped where it isn't available.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('planlegger-reminders', '*/15 * * * *', 'select public.send_event_reminders()');
exception when others then
  raise notice 'pg_cron not available, reminders not scheduled: %', sqlerrm;
end $$;
