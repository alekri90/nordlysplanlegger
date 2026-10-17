-- Nordlys Planlegger — "Ikke bestemt ennå" that does something
--
-- Guests answer «Jeg er med» / «Ikke denne gangen» while there is no date (event_members.status
-- attending / declined on a draft). The organizer hears who is in. When the organizer finds a date,
-- everyone who didn't opt out is asked about the dates, and reminders count from that moment.

alter table public.events add column polling_started_at timestamptz;
update events set polling_started_at = created_at where status = 'polling';

-- Any path into polling (find a date, a recurring round): note the time, and «Jeg er med» becomes
-- "hasn't answered the dates yet" so the poll and its reminders treat them right. «Ikke denne gangen» stays.
create or replace function public.events_polling_started()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'polling' and old.status is distinct from 'polling' then
    update events set polling_started_at = now() where id = new.id;
    update event_members set status = 'invited', responded_at = null
    where event_id = new.id and role = 'guest' and status = 'attending';
  end if;
  return null;
end $$;
create trigger events_polling_started after update of status on public.events
  for each row execute function public.events_polling_started();
revoke all on function public.events_polling_started() from public, anon, authenticated;

-- «Jeg er med» on an event without a date: tell the organizer.
create or replace function public.notify_organizer_on_interest()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
begin
  select * into v_event from events where id = new.event_id;
  if v_event.status <> 'draft' or new.user_id is not distinct from v_event.organizer_id or new.role <> 'guest' then
    return new;
  end if;
  v_name := split_part(coalesce(nullif((select display_name from profiles where id = new.user_id), ''), nullif(new.display_name, ''), 'En gjest'), ' ', 1);
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  values (v_event.organizer_id, 'response_received', v_event.id, new.user_id,
          v_name || ' er med', v_event.title || ' – finn en dato når du er klar',
          jsonb_build_object('kind', 'interest', 'url', '/event/' || v_event.id));
  return new;
end $$;
create trigger event_members_interest_notify after update of status on public.event_members
  for each row when (new.status = 'attending' and old.status is distinct from 'attending')
  execute function public.notify_organizer_on_interest();
revoke all on function public.notify_organizer_on_interest() from public, anon, authenticated;

-- The organizer finds a date for an undecided event: the dates go out to everyone who didn't opt out.
create or replace function public.start_event_poll(p_event_id uuid, p_dates date[], p_period_label text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
begin
  select * into v_event from events where id = p_event_id;
  if not found or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if v_event.status <> 'draft' then raise exception 'not_draft' using errcode = '22023'; end if;
  if coalesce(array_length(p_dates, 1), 0) = 0 then raise exception 'no_dates' using errcode = '22023'; end if;

  insert into event_date_options (event_id, date)
  select p_event_id, d from unnest(p_dates) d order by d;
  update events set status = 'polling', date_mode = 'poll', period_label = nullif(p_period_label, '') where id = p_event_id;

  v_name := split_part(coalesce(nullif((select display_name from profiles where id = v_event.organizer_id), ''), 'Arrangøren'), ' ', 1);
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'invited', p_event_id, v_event.organizer_id,
         v_name || ' har foreslått datoer', v_event.title || ' – hvilke dager kan du ikke?',
         jsonb_build_object('kind', 'poll_started', 'url', '/event/' || p_event_id)
  from event_members m
  where m.event_id = p_event_id and m.role = 'guest' and m.user_id is not null and m.status <> 'declined';
end $$;
revoke all on function public.start_event_poll(uuid, date[], text) from public, anon;
grant execute on function public.start_event_poll(uuid, date[], text) to authenticated;

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
    where e.status = 'polling' and coalesce(e.polling_started_at, e.created_at) < p_now - interval '2 days'
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                      and x.type = 'reminder_respond');
  end if;

  -- Once a day: the organizer nudges, completed events and quiet groups.
  if extract(hour from v_local) = 9 and v_quarter then
    perform generate_nudges();
  end if;
end $$;
revoke all on function public.send_event_reminders(timestamptz) from public, anon, authenticated;

create or replace function public.generate_nudges()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- "3 personer mangler å svare" to organizers of polls older than a day.
  insert into notifications (user_id, type, event_id, title, body, data)
  select e.organizer_id, 'reminder_respond', e.id,
         pending.n || case when pending.n = 1 then ' person mangler' else ' personer mangler' end || ' å svare',
         e.title, jsonb_build_object('url', '/event/' || e.id)
  from events e
  join lateral (select count(*) as n from event_members m where m.event_id = e.id and m.status in ('invited', 'opened')) pending on true
  where e.status = 'polling' and coalesce(e.polling_started_at, e.created_at) < now() - interval '1 day' and pending.n > 0
    and not exists (select 1 from notifications x where x.event_id = e.id and x.type = 'reminder_respond'
                    and x.created_at > now() - interval '48 hours');

  -- Mark past confirmed events as completed.
  update events set status = 'completed', completed_at = now()
  where status = 'confirmed' and selected_date < (now() at time zone timezone)::date;

  -- "Pokerklubben har ikke møttes på 7 uker" — only for groups that have met before and have nothing planned.
  insert into notifications (user_id, type, group_id, title, body, data)
  select g.created_by, 'group_nudge', g.id,
         g.name || ' har ikke møttes på ' || ((current_date - last.d) / 7) || ' uker',
         'Skal vi finne neste dato?', jsonb_build_object('url', '/group/' || g.id)
  from groups g
  join lateral (select max(e.selected_date) as d from events e where e.group_id = g.id and e.status in ('confirmed', 'completed')) last on true
  where g.archived_at is null and last.d is not null and last.d < current_date - 42
    and not exists (select 1 from events e where e.group_id = g.id and e.status in ('draft', 'polling', 'confirmed') and coalesce(e.selected_date, current_date) >= current_date)
    and not exists (select 1 from notifications x where x.group_id = g.id and x.type = 'group_nudge'
                    and x.created_at > now() - interval '14 days');
end $$;
