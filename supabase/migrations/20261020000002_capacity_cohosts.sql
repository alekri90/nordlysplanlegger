-- Nordlys Planlegger — limited places, a waiting list, co-hosts and fixed guests
--
-- * events.max_participants: how many can come. Anyone who says «Kommer» when it's full is put on
--   the waiting list (status 'waitlisted') by the database itself, so two people can't take the last
--   place at once. When someone drops out, the first on the list gets the place and a notification.
-- * Co-hosts (event_members.is_cohost) can do what the organizer does: is_event_organizer() now
--   includes them, so every policy and function that uses it follows.
-- * Fixed guests on a recurring event (event_series_reserved) always have a place. Kept in their
--   own table that only the organizer side (and the person) can read — invisible to everyone else.
-- * Locking a date with a limit: those who answered first get the places, the rest the waiting list.

alter table public.events add column max_participants int check (max_participants is null or max_participants > 0);
alter table public.event_members add column is_cohost boolean not null default false;
alter table public.event_members add column waitlisted_at timestamptz;
alter table public.event_series add column cohost_ids uuid[] not null default '{}';
-- Who has a fixed place: only the series organizer can read it (fixed guests are private).
create table public.event_series_reserved (
  series_id uuid not null references public.event_series (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (series_id, user_id)
);
alter table public.event_series_reserved enable row level security;
create policy series_reserved_select on public.event_series_reserved for select
  using (exists (select 1 from public.event_series s where s.id = series_id and s.organizer_id = auth.uid()));
grant select on public.event_series_reserved to authenticated;

create table public.event_reserved_seats (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);
alter table public.event_reserved_seats enable row level security;
create policy reserved_seats_select on public.event_reserved_seats for select
  using (user_id = auth.uid() or public.is_event_organizer(event_id));
grant select on public.event_reserved_seats to authenticated;

-- Co-hosts count as organizers everywhere this is used (policies, adding guests, messages …).
create or replace function public.is_event_organizer(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event_id and e.organizer_id = auth.uid())
      or exists (select 1 from event_members m where m.event_id = p_event_id and m.user_id = auth.uid() and m.is_cohost);
$$;

-- Places taken: everyone coming, plus those who always have a place (organizer, co-hosts, fixed
-- guests) unless they said no. Optionally leaving one member out (the one being checked).
create or replace function public.event_places_taken(p_event_id uuid, p_except uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from event_members m
  where m.event_id = p_event_id and m.id is distinct from p_except and m.status::text <> 'declined'
    and (m.status::text = 'attending' or m.role = 'organizer' or m.is_cohost
         or exists (select 1 from event_reserved_seats r where r.event_id = m.event_id and r.user_id = m.user_id));
$$;

-- Read as a column on events (PostgREST computed field): «6 av 10».
create or replace function public.places_taken(e events)
returns int language sql stable security definer set search_path = public as $$
  select case when e.max_participants is null then null else public.event_places_taken(e.id) end;
$$;
grant execute on function public.places_taken(events) to anon, authenticated;

create or replace function public.has_reserved_place(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_id is not null and exists (select 1 from event_reserved_seats where event_id = p_event_id and user_id = p_user_id);
$$;

-- Every change to a member: only the organizer hands out co-host; «Kommer» on a full event becomes
-- the waiting list.
create or replace function public.event_members_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event events;
begin
  if tg_op = 'UPDATE' and new.is_cohost is distinct from old.is_cohost and auth.uid() is not null
     and not exists (select 1 from events where id = new.event_id and organizer_id = auth.uid()) then
    raise exception 'only_organizer_sets_cohost' using errcode = '42501';
  end if;
  if coalesce(current_setting('planlegger.capacity_bulk', true), '') = 'on' then return new; end if;
  if new.status::text <> 'attending' or (tg_op = 'UPDATE' and old.status::text = 'attending') then
    if new.status::text <> 'waitlisted' then new.waitlisted_at := null; end if;
    return new;
  end if;
  select * into v_event from events where id = new.event_id;
  if v_event.max_participants is null or v_event.status not in ('confirmed', 'date_selected')
     or new.role = 'organizer' or new.is_cohost or has_reserved_place(new.event_id, new.user_id) then
    return new;
  end if;
  if event_places_taken(new.event_id, new.id) >= v_event.max_participants then
    new.status := 'waitlisted';
    new.waitlisted_at := coalesce(new.waitlisted_at, now());
  end if;
  return new;
end $$;
create trigger event_members_capacity before insert or update of status, is_cohost on public.event_members
  for each row execute function public.event_members_capacity();
revoke all on function public.event_members_capacity() from public, anon, authenticated;

-- A place came free: the first on the waiting list gets it, and is told.
create or replace function public.promote_waitlist(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_member event_members;
begin
  select * into v_event from events where id = p_event_id;
  if v_event.max_participants is null or v_event.status not in ('confirmed', 'date_selected') then return; end if;
  loop
    exit when event_places_taken(p_event_id) >= v_event.max_participants;
    select * into v_member from event_members
    where event_id = p_event_id and status::text = 'waitlisted' order by waitlisted_at nulls last, id limit 1;
    exit when not found;
    update event_members set status = 'attending', waitlisted_at = null, responded_at = now() where id = v_member.id;
    if v_member.user_id is not null then
      insert into notifications (user_id, type, event_id, title, body, data)
      values (v_member.user_id, 'event_updated', p_event_id, 'Du har fått plass! 🎉', v_event.title,
              jsonb_build_object('kind', 'waitlist_promoted', 'url', '/event/' || p_event_id));
    end if;
  end loop;
end $$;
revoke all on function public.promote_waitlist(uuid) from public, anon, authenticated;

create or replace function public.event_members_promote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('planlegger.capacity_bulk', true), '') <> 'on' then
    perform promote_waitlist(coalesce(new.event_id, old.event_id));
  end if;
  return null;
end $$;
create trigger event_members_promote_on_leave after update of status on public.event_members
  for each row when (old.status::text = 'attending' and new.status::text <> 'attending')
  execute function public.event_members_promote();
create trigger event_members_promote_on_delete after delete on public.event_members
  for each row when (old.status::text = 'attending') execute function public.event_members_promote();
revoke all on function public.event_members_promote() from public, anon, authenticated;

create or replace function public.events_capacity_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform promote_waitlist(new.id);
  return null;
end $$;
create trigger events_capacity_changed after update of max_participants on public.events
  for each row when (new.max_participants is distinct from old.max_participants)
  execute function public.events_capacity_changed();
revoke all on function public.events_capacity_changed() from public, anon, authenticated;

-- With a limit, the first to answer get the places; the rest go on the waiting list in that order.
create or replace function public.apply_capacity(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_free int;
begin
  select * into v_event from events where id = p_event_id;
  if v_event.max_participants is null then return; end if;
  -- Places for those who always have one are taken first.
  v_free := v_event.max_participants - (select count(*) from event_members m where m.event_id = p_event_id and m.status::text <> 'declined'
             and (m.role = 'organizer' or m.is_cohost or has_reserved_place(p_event_id, m.user_id)));
  perform set_config('planlegger.capacity_bulk', 'on', true);
  with ranked as (
    select m.id, row_number() over (order by m.responded_at nulls last, m.id) as n
    from event_members m
    where m.event_id = p_event_id and m.status::text = 'attending'
      and m.role <> 'organizer' and not m.is_cohost and not has_reserved_place(p_event_id, m.user_id)
  )
  update event_members m set status = 'waitlisted', waitlisted_at = coalesce(m.responded_at, now())
  from ranked r where r.id = m.id and r.n > greatest(v_free, 0);
  perform set_config('planlegger.capacity_bulk', '', true);

  insert into notifications (user_id, type, event_id, title, body, data)
  select m.user_id, 'event_updated', p_event_id, 'Det ble fullt – du står på venteliste', v_event.title,
         jsonb_build_object('kind', 'waitlisted', 'url', '/event/' || p_event_id)
  from event_members m where m.event_id = p_event_id and m.status::text = 'waitlisted' and m.user_id is not null
    and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = p_event_id and x.data ->> 'kind' = 'waitlisted');
end $$;
revoke all on function public.apply_capacity(uuid) from public, anon, authenticated;

-- Locking a date: co-hosts may do it too, and a limit is respected (first answers first).
create or replace function public.lock_event_date(p_event_id uuid, p_option_id uuid, p_start_time time default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_date date;
  v_name text;
begin
  if not is_event_organizer(p_event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  select * into v_event from events where id = p_event_id for update;
  if not found then raise exception 'not_organizer' using errcode = '42501'; end if;
  select date into v_date from event_date_options where id = p_option_id and event_id = p_event_id;
  if v_date is null then raise exception 'option_not_found' using errcode = 'P0002'; end if;

  update events set status = 'confirmed', selected_option_id = p_option_id, selected_date = v_date,
                    start_time = coalesce(p_start_time, start_time), locked_at = now()
  where id = p_event_id;

  -- Respondents who could make it are attending; those who couldn't are declined.
  perform set_config('planlegger.capacity_bulk', 'on', true);
  update event_members m set status = case
      when exists (select 1 from event_availability a where a.event_member_id = m.id and a.date_option_id = p_option_id and a.status = 'unavailable')
      then 'declined' else 'attending' end::public.invite_status
  where m.event_id = p_event_id and (m.status = 'responded' or m.role = 'organizer');
  perform set_config('planlegger.capacity_bulk', '', true);
  perform apply_capacity(p_event_id);

  select split_part(display_name, ' ', 1) into v_name from profiles where id = auth.uid();
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'date_locked', p_event_id, auth.uid(),
         coalesce(v_name, 'Arrangøren') || ' har låst ' || to_char(v_date, 'FMDD.') || ' ' ||
           (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from v_date)::int],
         v_event.title,
         jsonb_build_object('url', '/event/' || p_event_id)
  from event_members m where m.event_id = p_event_id and m.user_id is not null and m.user_id <> auth.uid();
end $$;

create or replace function public.start_event_poll(p_event_id uuid, p_dates date[], p_period_label text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
begin
  select * into v_event from events where id = p_event_id;
  if not found or not is_event_organizer(p_event_id) then
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

-- ---------------------------------------------------------------------------
-- Recurring events: co-hosts, fixed guests and the limit follow every round
-- ---------------------------------------------------------------------------

-- Bring one round in line with its series: the limit, co-hosts and fixed guests (invited if missing).
create or replace function public.apply_series_people(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  s event_series;
  v_user uuid;
  v_reserved uuid[];
begin
  select * into v_event from events where id = p_event_id;
  select * into s from event_series where id = v_event.series_id;
  if not found then return; end if;
  select coalesce(array_agg(user_id), '{}') into v_reserved from event_series_reserved where series_id = s.id;
  update events set max_participants = s.max_participants where id = p_event_id and max_participants is distinct from s.max_participants;
  foreach v_user in array (s.cohost_ids || v_reserved) loop
    continue when v_user = v_event.organizer_id;
    insert into event_members (event_id, user_id, display_name, status)
    select p_event_id, v_user, coalesce(p.display_name, ''), 'invited' from profiles p where p.id = v_user
    on conflict (event_id, user_id) where user_id is not null do nothing;
  end loop;
  perform set_config('planlegger.capacity_bulk', 'on', true);
  update event_members set is_cohost = (user_id = any (s.cohost_ids))
  where event_id = p_event_id and role = 'guest' and is_cohost is distinct from (user_id = any (s.cohost_ids));
  perform set_config('planlegger.capacity_bulk', '', true);
  delete from event_reserved_seats where event_id = p_event_id and not (user_id = any (v_reserved));
  insert into event_reserved_seats (event_id, user_id)
  select p_event_id, u from unnest(v_reserved) u where u <> v_event.organizer_id
  on conflict do nothing;
  perform promote_waitlist(p_event_id);
end $$;
revoke all on function public.apply_series_people(uuid) from public, anon, authenticated;

-- A round joins its series (first event, and every new round): the limit starts from the first event.
create or replace function public.events_series_people()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update event_series set max_participants = new.max_participants
  where id = new.series_id and max_participants is null and new.max_participants is not null;
  perform apply_series_people(new.id);
  return null;
end $$;
create trigger events_series_people after update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_people();
revoke all on function public.events_series_people() from public, anon, authenticated;

-- The organizer sets co-hosts, fixed guests and the limit for the whole series (this round and the next).
create or replace function public.set_series_people(p_series_id uuid, p_cohost_ids uuid[], p_reserved_ids uuid[], p_max int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from event_series where id = p_series_id and organizer_id = auth.uid()) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if p_max is not null and p_max < 1 then raise exception 'bad_max' using errcode = '22023'; end if;
  update event_series set cohost_ids = coalesce(p_cohost_ids, '{}'), max_participants = p_max where id = p_series_id;
  delete from event_series_reserved where series_id = p_series_id;
  insert into event_series_reserved (series_id, user_id)
  select p_series_id, u from unnest(coalesce(p_reserved_ids, '{}')) u on conflict do nothing;
  for v_id in select id from events where series_id = p_series_id and status not in ('cancelled', 'completed')
              and (selected_date is null or selected_date >= current_date) loop
    perform apply_series_people(v_id);
  end loop;
end $$;
revoke all on function public.set_series_people(uuid, uuid[], uuid[], int) from public, anon;
grant execute on function public.set_series_people(uuid, uuid[], uuid[], int) to authenticated;
