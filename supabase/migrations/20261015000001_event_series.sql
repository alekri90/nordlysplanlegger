-- Nordlys Planlegger — recurring events ("Gjenta arrangementet")
--
-- A series describes the repetition; every time it happens is an ordinary row in events
-- (series_id + series_period_start), so answers, polls, messages, reminders and RSVPs work as
-- they do for any event. Only one upcoming occurrence exists at a time; the next one is made by
-- the 15-minute job when the previous one is done.
--
--   date_mode 'fixed'      – same pattern every time ("annenhver onsdag", "første fredag i måneden")
--   date_mode 'poll_each'  – find a new date each time among the chosen weekdays in the period
--
-- Kept for later (model ready, no UI yet): max_participants, backup_group_id (waiting list).

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'hangout',
  cover_image_url text,
  location_name text,
  location_address text,
  description text check (description is null or char_length(description) <= 2000),
  time_hint public.time_hint not null default 'any',
  start_time time,
  timezone text not null default 'Europe/Oslo',
  interval_unit text not null check (interval_unit in ('day', 'week', 'month')),
  interval_count int not null default 1 check (interval_count between 1 and 52),
  date_mode text not null check (date_mode in ('fixed', 'poll_each')),
  weekdays smallint[] not null default '{}',     -- 0 = monday … 6 = sunday (as groups.preferred_weekdays)
  anchor_date date not null,                      -- first occurrence (fixed) or first period (poll_each)
  auto_invite_group boolean not null default true,
  requires_confirmation boolean not null default false,
  confirmation_lead_days int not null default 3 check (confirmation_lead_days between 1 and 14),
  max_participants int check (max_participants is null or max_participants > 0),
  backup_group_id uuid references public.groups (id) on delete set null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger event_series_touch before update on public.event_series
  for each row execute function public.touch_updated_at();

alter table public.events add column series_id uuid references public.event_series (id) on delete set null;
alter table public.events add column series_period_start date;
create index events_series_idx on public.events (series_id, series_period_start desc);

alter table public.event_series enable row level security;
create policy event_series_select on public.event_series for select using (
  organizer_id = auth.uid()
  or (group_id is not null and public.is_group_member(group_id))
  or exists (select 1 from events e where e.series_id = event_series.id and public.is_event_member(e.id))
);

-- ---------------------------------------------------------------------------
-- Dates
-- ---------------------------------------------------------------------------

/** The nth weekday of a month like the anchor's ("første fredag"); 5th means the last one. */
create or replace function public.series_month_date(p_month date, p_anchor date)
returns date language plpgsql immutable as $$
declare
  v_first date := date_trunc('month', p_month)::date;
  v_dow int := extract(isodow from p_anchor)::int;
  v_nth int := least(((extract(day from p_anchor)::int - 1) / 7) + 1, 5);
  v_d date;
begin
  v_d := v_first + ((v_dow - extract(isodow from v_first)::int + 7) % 7);
  v_d := v_d + (v_nth - 1) * 7;
  if v_nth = 5 or v_d >= v_first + interval '1 month' then
    -- last such weekday of the month
    v_d := (v_first + interval '1 month')::date - 1;
    v_d := v_d - ((extract(isodow from v_d)::int - v_dow + 7) % 7);
  end if;
  return v_d;
end $$;

/** Start of the period after p_from (fixed: the next date; poll_each: the next window). */
create or replace function public.series_next_start(s event_series, p_from date)
returns date language sql immutable as $$
  select case s.interval_unit
    when 'day' then p_from + s.interval_count
    when 'week' then p_from + 7 * s.interval_count
    else case when s.date_mode = 'fixed'
              then series_month_date((date_trunc('month', p_from) + make_interval(months => s.interval_count))::date, s.anchor_date)
              else (date_trunc('month', p_from) + make_interval(months => s.interval_count))::date end
  end;
$$;

/** Last day of a poll window starting at p_start: a month, or the length of the interval. */
create or replace function public.series_window_end(s event_series, p_start date)
returns date language sql immutable as $$
  select case s.interval_unit
    when 'month' then ((date_trunc('month', p_start) + interval '1 month')::date - 1)
    when 'week' then p_start + 7 * s.interval_count - 1
    else p_start + s.interval_count - 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- Create / change a series (organizer)
-- ---------------------------------------------------------------------------

/**
 * Turns a just-created event into the first occurrence of a series.
 * config: { unit, count, date_mode, weekdays[], auto_invite_group, requires_confirmation,
 *           confirmation_lead_days, end_date }
 */
create or replace function public.create_event_series(p_event_id uuid, config jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_loc event_locations;
  v_first date;
  v_id uuid;
  v_mode text := coalesce(config ->> 'date_mode', 'fixed');
  v_unit text := coalesce(config ->> 'unit', 'week');
  v_weekdays smallint[];
begin
  select * into v_event from events where id = p_event_id and organizer_id = auth.uid();
  if not found then raise exception 'not_organizer' using errcode = '42501'; end if;
  if v_event.series_id is not null then return v_event.series_id; end if;
  select * into v_loc from event_locations where event_id = p_event_id;

  v_first := coalesce(v_event.selected_date,
                      (select min(date) from event_date_options where event_id = p_event_id),
                      current_date);
  v_weekdays := case when jsonb_typeof(config -> 'weekdays') = 'array' and jsonb_array_length(config -> 'weekdays') > 0
    then array(select (jsonb_array_elements_text(config -> 'weekdays'))::smallint)
    else array(select distinct (extract(isodow from date)::int - 1)::smallint from event_date_options where event_id = p_event_id)
  end;
  if v_mode = 'fixed' and cardinality(v_weekdays) = 0 then
    v_weekdays := array[(extract(isodow from v_first)::int - 1)::smallint];
  end if;

  insert into event_series (organizer_id, group_id, title, category, cover_image_url, location_name, location_address,
                            description, time_hint, start_time, timezone, interval_unit, interval_count, date_mode,
                            weekdays, anchor_date, auto_invite_group, requires_confirmation, confirmation_lead_days, end_date)
  values (auth.uid(), v_event.group_id, v_event.title, v_event.category, v_event.cover_image_url, v_loc.name, v_loc.address,
          v_event.description, v_event.time_hint, v_event.start_time, v_event.timezone, v_unit,
          greatest(1, coalesce((config ->> 'count')::int, 1)), v_mode, v_weekdays,
          case when v_mode = 'poll_each' and v_unit = 'month' then date_trunc('month', v_first)::date
               when v_mode = 'poll_each' and v_unit = 'week' then v_first - (extract(isodow from v_first)::int - 1)
               else v_first end,
          coalesce((config ->> 'auto_invite_group')::boolean, true),
          coalesce((config ->> 'requires_confirmation')::boolean, false),
          coalesce((config ->> 'confirmation_lead_days')::int, 3),
          nullif(config ->> 'end_date', '')::date)
  returning id into v_id;

  update events set series_id = v_id,
    series_period_start = (select anchor_date from event_series where id = v_id)
  where id = p_event_id;
  return v_id;
end $$;

/** Change how often, the date mode, confirmation, pause/resume/end. Organizer only. */
create or replace function public.update_event_series(p_series_id uuid, patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from event_series where id = p_series_id and organizer_id = auth.uid()) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  update event_series set
    interval_unit = coalesce(patch ->> 'unit', interval_unit),
    interval_count = coalesce((patch ->> 'count')::int, interval_count),
    date_mode = coalesce(patch ->> 'date_mode', date_mode),
    weekdays = case when patch ? 'weekdays' then array(select (jsonb_array_elements_text(patch -> 'weekdays'))::smallint) else weekdays end,
    requires_confirmation = coalesce((patch ->> 'requires_confirmation')::boolean, requires_confirmation),
    confirmation_lead_days = coalesce((patch ->> 'confirmation_lead_days')::int, confirmation_lead_days),
    auto_invite_group = coalesce((patch ->> 'auto_invite_group')::boolean, auto_invite_group),
    end_date = case when patch ? 'end_date' then nullif(patch ->> 'end_date', '')::date else end_date end,
    status = coalesce(patch ->> 'status', status)
  where id = p_series_id;
end $$;

-- ---------------------------------------------------------------------------
-- The engine (called from send_event_reminders every 15 minutes)
-- ---------------------------------------------------------------------------

/** Next occurrence for one series, reusing create_event as the organizer. */
create or replace function public.create_next_occurrence(s event_series, p_today date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_last events;
  v_start date;
  v_users uuid[];
  v_guests uuid[];
  v_result jsonb;
  v_id uuid;
  v_month text;
begin
  select * into v_last from events where series_id = s.id order by series_period_start desc, created_at desc limit 1;
  v_start := series_next_start(s, coalesce(v_last.series_period_start, s.anchor_date));
  -- Skipped ahead if we were paused or late: never create something in the past.
  while v_start < p_today loop
    v_start := series_next_start(s, v_start);
  end loop;
  if s.end_date is not null and v_start > s.end_date then
    update event_series set status = 'ended' where id = s.id;
    return null;
  end if;

  -- Who: the group as it is now, or the people from last time.
  if s.auto_invite_group and s.group_id is not null then
    v_users := array(select user_id from group_members where group_id = s.group_id and user_id is not null and user_id <> s.organizer_id);
    v_guests := array(select guest_id from group_members where group_id = s.group_id and guest_id is not null);
  else
    v_users := array(select user_id from event_members where event_id = v_last.id and user_id is not null and user_id <> s.organizer_id);
    v_guests := array(select guest_id from event_members where event_id = v_last.id and guest_id is not null);
  end if;

  v_month := (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from v_start)::int];
  perform set_config('request.jwt.claim.sub', s.organizer_id::text, true);
  v_result := create_event(jsonb_build_object(
    'title', s.title, 'category', s.category, 'cover_image_url', s.cover_image_url,
    'date_mode', case when s.date_mode = 'fixed' then 'fixed' else 'undecided' end,
    'fixed_date', case when s.date_mode = 'fixed' then v_start end,
    'period_label', case when s.date_mode = 'poll_each' then initcap(v_month) end,
    'time_hint', s.time_hint, 'start_time', s.start_time,
    'group_id', s.group_id,
    'member_user_ids', to_jsonb(v_users), 'guest_ids', to_jsonb(v_guests)
  ));
  perform set_config('request.jwt.claim.sub', '', true);
  v_id := (v_result ->> 'event_id')::uuid;

  update events set series_id = s.id, series_period_start = v_start, description = s.description where id = v_id;
  -- A waiting round says nothing yet; people hear about it when the poll opens.
  if s.date_mode = 'poll_each' then
    delete from notifications where event_id = v_id and type = 'invited';
  end if;
  if s.location_name is not null then
    insert into event_locations (event_id, name, address) values (v_id, s.location_name, s.location_address);
  end if;
  return v_id;
end $$;

/** A waiting poll_each occurrence becomes a date poll when its window is close. */
create or replace function public.open_occurrence_poll(p_event_id uuid, s event_series, p_today date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_e events;
  v_end date;
  v_n int;
begin
  select * into v_e from events where id = p_event_id;
  v_end := series_window_end(s, v_e.series_period_start);
  insert into event_date_options (event_id, date)
  select v_e.id, d::date from generate_series(greatest(v_e.series_period_start, p_today + 3), v_end, interval '1 day') d
  where cardinality(s.weekdays) = 0 or (extract(isodow from d)::int - 1) = any (s.weekdays)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return false; end if;

  update events set status = 'polling', date_mode = 'poll' where id = v_e.id;
  update event_members set status = 'responded', responded_at = now() where event_id = v_e.id and role = 'organizer';
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'invited', v_e.id, v_e.organizer_id,
         'Ny runde: ' || v_e.title || coalesce(' i ' || lower(v_e.period_label), ''),
         'Hvilke dager kan du ikke? Trykk for å svare.',
         jsonb_build_object('kind', 'series_poll', 'url', '/event/' || v_e.id)
  from event_members m where m.event_id = v_e.id and m.user_id is not null and m.role = 'guest';
  return true;
end $$;

/** Picks the date most people can (earliest on a tie) and locks it as the organizer. */
create or replace function public.auto_lock_occurrence(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_e events;
  v_option uuid;
begin
  select * into v_e from events where id = p_event_id;
  select o.id into v_option
  from event_date_options o
  left join event_availability a on a.date_option_id = o.id and a.status = 'unavailable'
  where o.event_id = p_event_id
  group by o.id, o.date
  order by count(a.*) asc, o.date asc
  limit 1;
  if v_option is null then return; end if;
  perform set_config('request.jwt.claim.sub', v_e.organizer_id::text, true);
  perform lock_event_date(p_event_id, v_option);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function public.run_event_series(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_now at time zone 'Europe/Oslo';
  v_today date := v_local::date;
  s event_series;
  v_up events;
  v_first date;
  v_lead int;
begin
  for s in select * from event_series where status = 'active' loop
    begin
      select * into v_up from events
      where series_id = s.id and status in ('draft', 'polling', 'date_selected', 'confirmed')
        and coalesce(selected_date, v_today) >= v_today
      order by series_period_start desc limit 1;

      if v_up.id is null then
        -- The last one is done (or cancelled): line up the next.
        perform create_next_occurrence(s, v_today);
      elsif v_up.status = 'draft' and s.date_mode = 'poll_each'
            and v_up.series_period_start - (case when s.interval_unit = 'month' then 14 else least(14, 7 * s.interval_count) end) <= v_today then
        perform open_occurrence_poll(v_up.id, s, v_today);
      elsif v_up.status = 'polling' then
        select min(date) into v_first from event_date_options where event_id = v_up.id;
        -- Monthly rounds lock 5 days before the first possible day, shorter ones 2 days before.
        v_lead := case when s.interval_unit = 'month' then 5 else 2 end;
        if v_first - v_lead - 1 = v_today and extract(hour from v_local) >= 10 then
          insert into notifications (user_id, type, event_id, title, body, data)
          select s.organizer_id, 'reminder_respond', v_up.id, 'Datoen for ' || v_up.title || ' låses i morgen',
                 'Nordlys velger dagen flest kan. Vil du velge selv, gjør det i dag.',
                 jsonb_build_object('kind', 'autolock_warning', 'url', '/event/' || v_up.id)
          where not exists (select 1 from notifications x where x.event_id = v_up.id and x.data ->> 'kind' = 'autolock_warning');
        elsif v_first - v_lead <= v_today then
          perform auto_lock_occurrence(v_up.id);
        end if;
      end if;

      -- "Kortkveld på torsdag – kommer du?" the chosen number of days before.
      if s.requires_confirmation and v_up.id is not null and v_up.status in ('date_selected', 'confirmed')
         and v_up.selected_date - s.confirmation_lead_days <= v_today and v_up.selected_date >= v_today
         and extract(hour from v_local) >= 10 then
        insert into notifications (user_id, type, event_id, actor_id, title, body, data)
        select m.user_id, 'event_reminder', v_up.id, s.organizer_id,
               v_up.title || ' på ' || (array['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'])[extract(isodow from v_up.selected_date)::int],
               'Kommer du? Trykk for å svare.',
               jsonb_build_object('kind', 'confirm', 'url', '/event/' || v_up.id)
        from event_members m
        where m.event_id = v_up.id and m.user_id is not null and m.role = 'guest' and m.status <> 'declined'
          and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = v_up.id and x.data ->> 'kind' = 'confirm');
      end if;
    exception when others then
      raise notice 'series % skipped: %', s.id, sqlerrm;
    end;
  end loop;
end $$;

-- Hook the engine into the existing 15-minute job.
create or replace function public.send_event_reminders_with_series(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  perform run_event_series(p_now);
  perform send_event_reminders(p_now);
end $$;

do $$
begin
  perform cron.unschedule('planlegger-reminders');
  perform cron.schedule('planlegger-reminders', '*/15 * * * *', 'select public.send_event_reminders_with_series()');
exception when others then
  raise notice 'pg_cron not available, series not scheduled: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Fix: locking a date marks people who couldn't as declined — that's not "kan ikke likevel".
-- Only someone who had said yes backing out tells the organizer.
-- ---------------------------------------------------------------------------
drop trigger if exists event_members_decline_notify on public.event_members;
create trigger event_members_decline_notify after update of status on public.event_members
  for each row when (new.status = 'declined' and old.status = 'attending')
  execute function public.notify_organizer_on_decline();

revoke all on function public.create_next_occurrence(event_series, date) from public, anon, authenticated;
revoke all on function public.open_occurrence_poll(uuid, event_series, date) from public, anon, authenticated;
revoke all on function public.auto_lock_occurrence(uuid) from public, anon, authenticated;
revoke all on function public.run_event_series(timestamptz) from public, anon, authenticated;
revoke all on function public.send_event_reminders_with_series(timestamptz) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.create_event_series(uuid, jsonb)', 'public.update_event_series(uuid, jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- When a date is set on an occurrence of a fixed-pattern series, that date is its place in the
-- pattern. For a series that started with a poll, the first locked date becomes the pattern
-- ("annenhver torsdag" from the Thursday the group picked).
create or replace function public.series_follow_selected_date()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s event_series;
begin
  select * into s from event_series where id = new.series_id;
  if s.date_mode <> 'fixed' then return new; end if;
  if s.anchor_date = old.series_period_start then
    update event_series set anchor_date = new.selected_date,
      weekdays = array[(extract(isodow from new.selected_date)::int - 1)::smallint]
    where id = s.id;
  end if;
  new.series_period_start := new.selected_date;
  return new;
end $$;
create trigger events_series_follow_date before update of selected_date on public.events
  for each row when (new.series_id is not null and new.selected_date is not null and new.selected_date is distinct from old.selected_date)
  execute function public.series_follow_selected_date();
revoke all on function public.series_follow_selected_date() from public, anon, authenticated;
