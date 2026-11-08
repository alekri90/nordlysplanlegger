-- Nordlys Planlegger — pris, og arrangøren kan sette svaret for andre
--
-- * Pris (valgfritt) på et arrangement: enten en kostnad som deles (f.eks. leie av badstue) eller en
--   fast pris per person. Bare til visning – betaling skjer utenfor appen. Følger med i en gjentakelse.
-- * «Betaler ikke andel»: arrangøren kan unnta noen (f.eks. badstumesteren) fra å dele kostnaden.
--   De har fortsatt plass. Følger med til neste runde i en gjentakelse.
-- * Arrangøren (og medarrangører) kan sette svaret for noen som har svart på SMS eller muntlig.
--   Det merkes «Satt av …», personen får beskjed, og merket forsvinner når de svarer selv.
--
-- Bare nye kolonner, triggere og funksjoner; ingen eksisterende funksjon skrives om.
-- answer_set_by er et navn, ikke en fremmednøkkel, så embed event_members → profiles forblir entydig.

alter table public.events
  add column price_ore int check (price_ore is null or price_ore between 0 and 100000000),
  add column price_mode text check (price_mode is null or price_mode in ('split', 'per_person')),
  add constraint events_price_complete check ((price_ore is null) = (price_mode is null));

alter table public.event_series
  add column price_ore int check (price_ore is null or price_ore between 0 and 100000000),
  add column price_mode text check (price_mode is null or price_mode in ('split', 'per_person'));

alter table public.event_members
  add column pays_share boolean not null default true,
  add column answer_set_by text,
  add column answer_set_at timestamptz;

-- ---------------------------------------------------------------------------
-- Who pays: computed fields on events (like places_taken), null when there is no price
-- ---------------------------------------------------------------------------

-- Has a place now: coming, or always has a place (organizer, co-host, fixed guest) unless they said no.
create or replace function public.member_has_place(m event_members)
returns boolean language sql stable security definer set search_path = public as $$
  select m.status::text <> 'declined'
     and (m.status::text = 'attending' or m.role = 'organizer' or m.is_cohost
          or exists (select 1 from event_reserved_seats r where r.event_id = m.event_id and r.user_id = m.user_id));
$$;
revoke all on function public.member_has_place(event_members) from public, anon, authenticated;

create or replace function public.paying_places(e events)
returns int language sql stable security definer set search_path = public as $$
  select case when e.price_ore is null then null else
    (select count(*)::int from event_members m where m.event_id = e.id and m.pays_share and member_has_place(m)) end;
$$;
grant execute on function public.paying_places(events) to anon, authenticated;

create or replace function public.non_paying_places(e events)
returns int language sql stable security definer set search_path = public as $$
  select case when e.price_ore is null then null else
    (select count(*)::int from event_members m where m.event_id = e.id and not m.pays_share and member_has_place(m)) end;
$$;
grant execute on function public.non_paying_places(events) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guard: only the organizer side changes «betaler andel»; «Satt av» is only set by set_member_answer,
-- and disappears as soon as the answer changes any other way (the person answering themselves).
-- ---------------------------------------------------------------------------
create or replace function public.event_members_answer_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('planlegger.answer_set', true), '') = 'on' then return new; end if;
  if new.pays_share is distinct from old.pays_share and auth.uid() is not null and not is_event_organizer(new.event_id) then
    raise exception 'only_organizer_sets_share' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.answer_set_by := null;
    new.answer_set_at := null;
  else
    new.answer_set_by := old.answer_set_by;
    new.answer_set_at := old.answer_set_at;
  end if;
  return new;
end $$;
create trigger event_members_answer_fields before update on public.event_members
  for each row execute function public.event_members_answer_fields();
revoke all on function public.event_members_answer_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The organizer side sets someone's answer: 'attending', 'declined' or 'invited' (clears it).
-- A full event still puts «Kommer» on the waiting list (the capacity trigger decides). Returns the result.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_answer(p_member_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_member event_members;
  v_event events;
  v_name text;
  v_new text;
begin
  select * into v_member from event_members where id = p_member_id;
  if not found then raise exception 'member_not_found' using errcode = 'P0002'; end if;
  if not is_event_organizer(v_member.event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  if v_member.role = 'organizer' then raise exception 'cannot_set_organizer' using errcode = '22023'; end if;
  if p_status not in ('attending', 'declined', 'invited') then raise exception 'bad_status' using errcode = '22023'; end if;
  select * into v_event from events where id = v_member.event_id;
  if v_event.status in ('cancelled', 'completed') then raise exception 'event_closed' using errcode = '22023'; end if;

  select split_part(display_name, ' ', 1) into v_name from profiles where id = auth.uid();
  perform set_config('planlegger.answer_set', 'on', true);
  update event_members
  set status = p_status::public.invite_status,
      responded_at = case when p_status = 'invited' then null else now() end,
      answer_set_by = case when p_status = 'invited' then null else coalesce(nullif(v_name, ''), 'arrangøren') end,
      answer_set_at = case when p_status = 'invited' then null else now() end
  where id = p_member_id
  returning status::text into v_new;
  perform set_config('planlegger.answer_set', '', true);

  if v_member.user_id is not null and v_member.user_id <> auth.uid() and p_status <> 'invited' then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    values (v_member.user_id, 'event_updated', v_event.id, auth.uid(),
            coalesce(nullif(v_name, ''), 'Arrangøren') || ' satte svaret ditt på ' || v_event.title,
            case v_new when 'attending' then 'Du er satt til «Kommer». Du kan endre det selv.'
                       when 'waitlisted' then 'Det var fullt, så du står på ventelisten.'
                       else 'Du er satt til «Kan ikke». Du kan endre det selv.' end,
            jsonb_build_object('kind', 'answer_set', 'url', '/event/' || v_event.id));
  end if;
  return v_new;
end $$;
revoke all on function public.set_member_answer(uuid, text) from public, anon;
grant execute on function public.set_member_answer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Recurring events: the price and who doesn't pay follow every round
-- ---------------------------------------------------------------------------

-- The first event gives the series its price; every later round takes it from the series.
create or replace function public.events_series_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from events e where e.series_id = new.series_id and e.id <> new.id) then
    select s.price_ore, s.price_mode into new.price_ore, new.price_mode from event_series s where s.id = new.series_id;
  else
    update event_series set price_ore = new.price_ore, price_mode = new.price_mode where id = new.series_id;
  end if;
  return new;
end $$;
create trigger events_series_price before update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_price();
revoke all on function public.events_series_price() from public, anon, authenticated;

-- Changing the price on a round carries on to the next one.
create or replace function public.events_price_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update event_series set price_ore = new.price_ore, price_mode = new.price_mode where id = new.series_id;
  return null;
end $$;
create trigger events_price_changed after update of price_ore, price_mode on public.events
  for each row when (new.series_id is not null
                     and (new.price_ore is distinct from old.price_ore or new.price_mode is distinct from old.price_mode))
  execute function public.events_price_changed();
revoke all on function public.events_price_changed() from public, anon, authenticated;

-- A new round: people who didn't pay a share last time don't pay this time either.
create or replace function public.events_series_pays_share()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prev uuid;
begin
  select id into v_prev from events
  where series_id = new.series_id and id <> new.id
  order by series_period_start desc nulls last, created_at desc limit 1;
  if v_prev is null then return null; end if;
  perform set_config('planlegger.answer_set', 'on', true);
  update event_members m set pays_share = false
  where m.event_id = new.id and m.user_id is not null and m.pays_share
    and m.user_id in (select p.user_id from event_members p where p.event_id = v_prev and not p.pays_share and p.user_id is not null);
  perform set_config('planlegger.answer_set', '', true);
  return null;
end $$;
-- Triggers run in name order: «shares» comes after events_series_people, which adds co-hosts and fixed guests.
create trigger events_series_shares after update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_pays_share();
revoke all on function public.events_series_pays_share() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The invitation page (also without an account): price and places, no names.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite_price(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'price_ore', e.price_ore, 'price_mode', e.price_mode, 'max_participants', e.max_participants,
    'places_taken', event_places_taken(e.id),
    'paying_places', paying_places(e), 'non_paying_places', non_paying_places(e))
  from event_invites i join events e on e.id = i.event_id
  where i.token = p_token and i.revoked_at is null and e.status <> 'cancelled';
$$;
grant execute on function public.get_invite_price(text) to anon, authenticated;
