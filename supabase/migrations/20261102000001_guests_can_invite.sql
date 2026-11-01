-- The organizer decides who can invite: only organizers and co-hosts (the default), or everyone
-- who is taking part. A recurring event remembers the choice for its next rounds.
alter table public.events add column guests_can_invite boolean not null default false;
alter table public.event_series add column guests_can_invite boolean not null default false;

-- Someone who said no, or an event that's over, can't bring in more people.
create or replace function public.can_invite_to_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_event_organizer(p_event_id)
      or exists (
        select 1 from events e
        join event_members m on m.event_id = e.id
        where e.id = p_event_id and e.guests_can_invite
          and e.status not in ('cancelled', 'completed')
          and (e.selected_date is null or e.selected_date >= current_date)
          and m.user_id = auth.uid() and m.status::text <> 'declined'
      );
$$;
revoke all on function public.can_invite_to_event(uuid) from public, anon;
grant execute on function public.can_invite_to_event(uuid) to authenticated;

do $$
declare
  v_fn regprocedure;
  v_def text;
begin
  foreach v_fn in array array['public.add_event_members(uuid, uuid[])'::regprocedure, 'public.add_event_guests(uuid, uuid[], text[])'::regprocedure] loop
    select pg_get_functiondef(v_fn) into v_def;
    if position('if not is_event_organizer(p_event_id) then' in v_def) = 0 then
      raise exception 'unexpected definition of %', v_fn;
    end if;
    execute replace(v_def, 'if not is_event_organizer(p_event_id) then', 'if not can_invite_to_event(p_event_id) then');
  end loop;
end $$;

-- The first event gives the series its choice; every later round takes it from the series.
create or replace function public.events_series_guests_can_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from events e where e.series_id = new.series_id and e.id <> new.id) then
    new.guests_can_invite := (select s.guests_can_invite from event_series s where s.id = new.series_id);
  else
    update event_series set guests_can_invite = new.guests_can_invite where id = new.series_id;
  end if;
  return new;
end $$;
create trigger events_series_guests_can_invite before update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_guests_can_invite();
revoke all on function public.events_series_guests_can_invite() from public, anon, authenticated;

-- Changing it on a round carries on to the next one.
create or replace function public.events_guests_can_invite_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update event_series set guests_can_invite = new.guests_can_invite where id = new.series_id;
  return null;
end $$;
create trigger events_guests_can_invite_changed after update of guests_can_invite on public.events
  for each row when (new.series_id is not null and new.guests_can_invite is distinct from old.guests_can_invite)
  execute function public.events_guests_can_invite_changed();
revoke all on function public.events_guests_can_invite_changed() from public, anon, authenticated;
