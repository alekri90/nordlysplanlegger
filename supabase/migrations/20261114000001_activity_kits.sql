-- Nordlys Planlegger — flere aktivitetstyper: poker, middag, løping, knytteknute, padel/tennis, fjelltur
--
-- Byggeklosser som hver aktivitetstype plukker fra (typene selv er definert i appen):
-- * events.activity_details: typens egne felter (buy-in-struktur, meny, distanse, utstyr …) som jsonb.
-- * Kostbehov/allergier (middag): bare arrangøren og personen selv ser dem.
-- * Ta-med-liste (knytteknute): arrangøren lager listen, deltagerne tar på seg ting og kan legge til egne.
-- * Samkjøring (fjelltur): noen tilbyr seter, andre blir med.
-- * Pokerresultat: arrangøren fører buy-ins og sluttsum per spiller; oppgjøret regnes ut i appen.
--
-- Tabellene leses og skrives bare gjennom funksjoner, så gjester uten konto (invitasjonslenke +
-- gjestehemmelighet) kan være med på samme måte som de med konto. Ingen eksisterende funksjon skrives om.

alter table public.events
  add column activity_details jsonb
    check (activity_details is null or (jsonb_typeof(activity_details) = 'object' and octet_length(activity_details::text) <= 8000));

create table public.event_diets (
  member_id uuid primary key references public.event_members (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  diet text not null check (char_length(diet) between 1 and 200),
  updated_at timestamptz not null default now()
);
create index event_diets_event on public.event_diets (event_id);

create table public.event_bring_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  claimed_by uuid references public.event_members (id) on delete set null,
  added_by uuid references public.event_members (id) on delete set null,
  -- seq: the list keeps the order it was written in, also within one call.
  seq bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index event_bring_items_event on public.event_bring_items (event_id, seq);

create table public.event_rides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  driver_id uuid not null references public.event_members (id) on delete cascade,
  seats int not null check (seats between 1 and 8),
  from_text text check (from_text is null or char_length(from_text) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (event_id, driver_id)
);

create table public.event_ride_passengers (
  ride_id uuid not null references public.event_rides (id) on delete cascade,
  member_id uuid not null references public.event_members (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  primary key (ride_id, member_id),
  unique (event_id, member_id)
);

create table public.event_poker_results (
  member_id uuid primary key references public.event_members (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  buy_ins int not null default 1 check (buy_ins between 0 and 50),
  cash_out_ore int check (cash_out_ore is null or cash_out_ore between 0 and 100000000),
  updated_at timestamptz not null default now()
);
create index event_poker_results_event on public.event_poker_results (event_id);

alter table public.event_diets enable row level security;
alter table public.event_bring_items enable row level security;
alter table public.event_rides enable row level security;
alter table public.event_ride_passengers enable row level security;
alter table public.event_poker_results enable row level security;
revoke all on public.event_diets, public.event_bring_items, public.event_rides, public.event_ride_passengers, public.event_poker_results
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who is asking: the signed-in member, or the guest behind an invite link (personal link, or the
-- guest secret on their device). With a token the event comes from the link.
-- ---------------------------------------------------------------------------
create or replace function public.kit_member(p_event_id uuid, p_token text, p_secret text)
returns event_members language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_invite event_invites;
  v_event uuid := p_event_id;
  v_guest uuid;
  v_member event_members;
begin
  if p_token is not null then
    select * into v_invite from event_invites
    where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
    if not found or (p_event_id is not null and v_invite.event_id <> p_event_id) then return null; end if;
    v_event := v_invite.event_id;
  end if;
  if auth.uid() is not null then
    select * into v_member from event_members where event_id = v_event and user_id = auth.uid();
  end if;
  if v_member.id is null and v_invite.guest_profile_id is not null then
    select * into v_member from event_members where event_id = v_event and guest_id = v_invite.guest_profile_id;
  elsif v_member.id is null and p_token is not null and p_secret is not null then
    select id into v_guest from guest_profiles where secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
    select * into v_member from event_members where event_id = v_event and guest_id = v_guest;
  end if;
  return v_member;
end $$;
revoke all on function public.kit_member(uuid, text, text) from public, anon, authenticated;

-- The event a call is about: from the link, or the id.
create or replace function public.kit_event(p_event_id uuid, p_token text)
returns uuid language sql stable security definer set search_path = public as $$
  select case when p_token is null then p_event_id
              else (select i.event_id from event_invites i
                    where i.token = p_token and i.revoked_at is null and (i.expires_at is null or i.expires_at > now())
                      and (p_event_id is null or i.event_id = p_event_id)) end;
$$;
revoke all on function public.kit_event(uuid, text) from public, anon, authenticated;

create or replace function public.kit_name(m event_members)
returns text language sql stable security definer set search_path = public as $$
  select split_part(coalesce(nullif(m.display_name, ''),
                             (select p.display_name from profiles p where p.id = m.user_id),
                             (select g.display_name from guest_profiles g where g.id = m.guest_id), 'Gjest'), ' ', 1);
$$;
revoke all on function public.kit_name(event_members) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Everything for one event in one read: details, my diet (and everyone's for the organizer),
-- the bring list, rides and poker results.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_kit(p_event_id uuid default null, p_token text default null, p_secret text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_event uuid := kit_event(p_event_id, p_token);
  v_me event_members := kit_member(p_event_id, p_token, p_secret);
  v_org boolean;
begin
  if v_event is null then return null; end if;
  v_org := auth.uid() is not null and is_event_organizer(v_event);
  -- Signed in without a link: only members of the event (or the organizer side).
  if p_token is null and v_me.id is null and not v_org then return null; end if;

  return jsonb_build_object(
    'me', v_me.id,
    'organizer', v_org,
    'details', (select e.activity_details from events e where e.id = v_event),
    'my_diet', (select d.diet from event_diets d where d.member_id = v_me.id),
    'diets', case when v_org then coalesce((
      select jsonb_agg(jsonb_build_object('member_id', m.id, 'name', kit_name(m), 'diet', d.diet) order by kit_name(m))
      from event_diets d join event_members m on m.id = d.member_id where d.event_id = v_event), '[]'::jsonb) end,
    'bring', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'label', b.label,
               'claimed_by', (select kit_name(m) from event_members m where m.id = b.claimed_by),
               'mine', b.claimed_by is not null and b.claimed_by = v_me.id,
               'added_by_me', b.added_by is not null and b.added_by = v_me.id) order by b.seq)
      from event_bring_items b where b.event_id = v_event), '[]'::jsonb),
    'rides', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'driver', kit_name(dm), 'mine', r.driver_id = v_me.id, 'seats', r.seats, 'from', r.from_text,
               'passengers', coalesce((select jsonb_agg(kit_name(pm) order by kit_name(pm))
                                       from event_ride_passengers p join event_members pm on pm.id = p.member_id
                                       where p.ride_id = r.id), '[]'::jsonb),
               'joined', exists (select 1 from event_ride_passengers p where p.ride_id = r.id and p.member_id = v_me.id))
             order by r.created_at)
      from event_rides r join event_members dm on dm.id = r.driver_id where r.event_id = v_event), '[]'::jsonb),
    'poker', case when v_me.id is not null or v_org then coalesce((
      select jsonb_agg(jsonb_build_object('member_id', m.id, 'name', kit_name(m), 'buy_ins', p.buy_ins, 'cash_out_ore', p.cash_out_ore)
             order by kit_name(m))
      from event_poker_results p join event_members m on m.id = p.member_id where p.event_id = v_event), '[]'::jsonb)
      else '[]'::jsonb end
  );
end $$;
revoke all on function public.get_event_kit(uuid, text, text) from public;
grant execute on function public.get_event_kit(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The organizer sets the type and its details (right after creating the event, or later).
-- A type with its own request (aufguss) is never switched away from here. The first bring list
-- comes along; it is only added when the event has none yet.
-- ---------------------------------------------------------------------------
create or replace function public.set_activity_details(p_event_id uuid, p_type text, p_details jsonb, p_bring text[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_current text;
  v_label text;
begin
  if auth.uid() is null or not is_event_organizer(p_event_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_type is null or p_type !~ '^[a-z_]{2,30}$' then raise exception 'bad_type' using errcode = '22023'; end if;
  select activity_type into v_current from events where id = p_event_id;
  if v_current is not null and v_current <> p_type then raise exception 'type_locked' using errcode = '22023'; end if;
  update events set activity_type = p_type, activity_details = p_details where id = p_event_id;
  if p_bring is not null and not exists (select 1 from event_bring_items where event_id = p_event_id) then
    foreach v_label in array p_bring[1:40] loop
      v_label := btrim(v_label);
      if v_label <> '' then insert into event_bring_items (event_id, label) values (p_event_id, left(v_label, 80)); end if;
    end loop;
  end if;
end $$;
revoke all on function public.set_activity_details(uuid, text, jsonb, text[]) from public, anon;
grant execute on function public.set_activity_details(uuid, text, jsonb, text[]) to authenticated;

-- Diet and allergies: your own, for this event. Blank removes it.
create or replace function public.kit_set_diet(p_event_id uuid, p_diet text, p_token text default null, p_secret text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me event_members := kit_member(p_event_id, p_token, p_secret);
  v_diet text := nullif(btrim(coalesce(p_diet, '')), '');
begin
  if v_me.id is null then raise exception 'not_member' using errcode = '42501'; end if;
  if v_diet is null then
    delete from event_diets where member_id = v_me.id;
  else
    insert into event_diets (member_id, event_id, diet) values (v_me.id, v_me.event_id, left(v_diet, 200))
    on conflict (member_id) do update set diet = excluded.diet, updated_at = now();
  end if;
end $$;
revoke all on function public.kit_set_diet(uuid, text, text, text) from public;
grant execute on function public.kit_set_diet(uuid, text, text, text) to anon, authenticated;

-- The bring list: 'claim' / 'unclaim' a thing, 'add' your own, 'remove' (what you added; the organizer anything).
create or replace function public.kit_bring(p_event_id uuid, p_action text, p_item_id uuid default null, p_label text default null,
                                            p_token text default null, p_secret text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := kit_event(p_event_id, p_token);
  v_me event_members := kit_member(p_event_id, p_token, p_secret);
  v_org boolean := auth.uid() is not null and v_event is not null and is_event_organizer(v_event);
  v_item event_bring_items;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if v_event is null or (v_me.id is null and not v_org) then raise exception 'not_member' using errcode = '42501'; end if;
  if p_action = 'add' then
    if v_label is null then raise exception 'bad_label' using errcode = '22023'; end if;
    if (select count(*) from event_bring_items where event_id = v_event) >= 60 then raise exception 'too_many' using errcode = '22023'; end if;
    insert into event_bring_items (event_id, label, added_by, claimed_by)
    values (v_event, left(v_label, 80), v_me.id, case when not v_org then v_me.id end);
    return;
  end if;
  select * into v_item from event_bring_items where id = p_item_id and event_id = v_event for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_action = 'claim' then
    if v_me.id is null then raise exception 'not_member' using errcode = '42501'; end if;
    if v_item.claimed_by is not null and v_item.claimed_by <> v_me.id then raise exception 'taken' using errcode = '22023'; end if;
    update event_bring_items set claimed_by = v_me.id where id = v_item.id;
  elsif p_action = 'unclaim' then
    if not (v_org or v_item.claimed_by = v_me.id) then raise exception 'not_allowed' using errcode = '42501'; end if;
    update event_bring_items set claimed_by = null where id = v_item.id;
  elsif p_action = 'remove' then
    if not (v_org or (v_item.added_by is not null and v_item.added_by = v_me.id)) then raise exception 'not_allowed' using errcode = '42501'; end if;
    delete from event_bring_items where id = v_item.id;
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
end $$;
revoke all on function public.kit_bring(uuid, text, uuid, text, text, text) from public;
grant execute on function public.kit_bring(uuid, text, uuid, text, text, text) to anon, authenticated;

-- Rides: 'offer' seats (or change them), 'cancel' your ride, 'join' one with room, 'leave' it.
create or replace function public.kit_ride(p_event_id uuid, p_action text, p_ride_id uuid default null, p_seats int default null,
                                           p_from text default null, p_token text default null, p_secret text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me event_members := kit_member(p_event_id, p_token, p_secret);
  v_ride event_rides;
  v_taken int;
begin
  if v_me.id is null then raise exception 'not_member' using errcode = '42501'; end if;
  if p_action = 'offer' then
    if p_seats is null or p_seats not between 1 and 8 then raise exception 'bad_seats' using errcode = '22023'; end if;
    if p_seats < (select count(*) from event_ride_passengers p join event_rides r on r.id = p.ride_id where r.driver_id = v_me.id) then
      raise exception 'seats_taken' using errcode = '22023';
    end if;
    delete from event_ride_passengers where event_id = v_me.event_id and member_id = v_me.id;
    insert into event_rides (event_id, driver_id, seats, from_text)
    values (v_me.event_id, v_me.id, p_seats, nullif(left(btrim(coalesce(p_from, '')), 80), ''))
    on conflict (event_id, driver_id) do update set seats = excluded.seats, from_text = excluded.from_text;
  elsif p_action = 'cancel' then
    delete from event_rides where event_id = v_me.event_id and driver_id = v_me.id;
  elsif p_action = 'join' then
    select * into v_ride from event_rides where id = p_ride_id and event_id = v_me.event_id for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_ride.driver_id = v_me.id then raise exception 'own_ride' using errcode = '22023'; end if;
    if exists (select 1 from event_rides where event_id = v_me.event_id and driver_id = v_me.id) then
      raise exception 'is_driver' using errcode = '22023';
    end if;
    select count(*) into v_taken from event_ride_passengers where ride_id = v_ride.id and member_id <> v_me.id;
    if v_taken >= v_ride.seats then raise exception 'full' using errcode = '22023'; end if;
    delete from event_ride_passengers where event_id = v_me.event_id and member_id = v_me.id;
    insert into event_ride_passengers (ride_id, member_id, event_id) values (v_ride.id, v_me.id, v_me.event_id);
  elsif p_action = 'leave' then
    delete from event_ride_passengers where event_id = v_me.event_id and member_id = v_me.id;
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
end $$;
revoke all on function public.kit_ride(uuid, text, uuid, int, text, text, text) from public;
grant execute on function public.kit_ride(uuid, text, uuid, int, text, text, text) to anon, authenticated;

-- Poker: the organizer side keeps the score. A null buy-in count removes the player from the list.
create or replace function public.kit_poker_set(p_event_id uuid, p_member_id uuid, p_buy_ins int, p_cash_out_ore int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_event_organizer(p_event_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from event_members where id = p_member_id and event_id = p_event_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_buy_ins is null then
    delete from event_poker_results where member_id = p_member_id;
    return;
  end if;
  insert into event_poker_results (member_id, event_id, buy_ins, cash_out_ore)
  values (p_member_id, p_event_id, p_buy_ins, p_cash_out_ore)
  on conflict (member_id) do update set buy_ins = excluded.buy_ins, cash_out_ore = excluded.cash_out_ore, updated_at = now();
end $$;
revoke all on function public.kit_poker_set(uuid, uuid, int, int) from public, anon;
grant execute on function public.kit_poker_set(uuid, uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Recurring events: every round keeps the type, its details and a fresh copy of the bring list.
-- ---------------------------------------------------------------------------
create or replace function public.events_series_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prev events;
begin
  if new.activity_type is not null then return new; end if;
  select * into v_prev from events e
  where e.series_id = new.series_id and e.id <> new.id and e.activity_type is not null
  order by e.series_period_start desc nulls last, e.created_at desc limit 1;
  if v_prev.id is null then return new; end if;
  new.activity_type := v_prev.activity_type;
  new.activity_details := v_prev.activity_details;
  return new;
end $$;
create trigger events_series_activity before update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_activity();
revoke all on function public.events_series_activity() from public, anon, authenticated;

create or replace function public.events_series_bring()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prev uuid;
begin
  select e.id into v_prev from events e
  where e.series_id = new.series_id and e.id <> new.id and exists (select 1 from event_bring_items b where b.event_id = e.id)
  order by e.series_period_start desc nulls last, e.created_at desc limit 1;
  if v_prev is not null and not exists (select 1 from event_bring_items where event_id = new.id) then
    insert into event_bring_items (event_id, label)
    select new.id, b.label from event_bring_items b where b.event_id = v_prev and b.added_by is null order by b.seq;
  end if;
  return null;
end $$;
create trigger events_series_bring after update of series_id on public.events
  for each row when (new.series_id is not null and old.series_id is distinct from new.series_id)
  execute function public.events_series_bring();
revoke all on function public.events_series_bring() from public, anon, authenticated;
