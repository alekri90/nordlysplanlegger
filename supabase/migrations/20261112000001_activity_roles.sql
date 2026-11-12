-- Nordlys Planlegger — aktivitetstyper med egne roller (først: Aufguss med badstumester)
--
-- * events.activity_type: en konkret aktivitetstype ('aufguss'). Null = generell aktivitet som før.
-- * events.role_places: hvor mange med en egen rolle som kommer i tillegg til deltagerplassene
--   (badstumesteren = 1). De er ikke deltagere: de tar ingen plass, deler ingen kostnad og står ikke
--   i gjestelisten. events.venue_capacity: hvor mange stedet har plass til totalt (ev. ukjent).
--   Deltagerplasser + rolleplasser kan ikke overstige det.
-- * activity_venues: arrangørens egne steder (badstuer) med kapasitet, så de kan velges igjen.
-- * role_requests: én samlet forespørsel til én eller flere (badstumestere) om en rekke datoer.
--   Hver dato peker på sitt arrangement. Den som spørres, svarer «Kan» / «Kan ikke» per dato via
--   en personlig lenke, uten konto. Med én spurt for en dato får hen rollen når hen sier «Kan»;
--   med flere velger arrangøren. Aldri flere på samme dato.
--
-- Bare nye kolonner, tabeller og funksjoner; ingen eksisterende funksjon skrives om. Rollene ligger
-- utenfor event_members, så plasser, pris og venteliste fungerer uendret.

alter table public.events
  add column activity_type text check (activity_type is null or activity_type ~ '^[a-z_]{2,30}$'),
  add column role_places int not null default 0 check (role_places between 0 and 10),
  add column venue_capacity int check (venue_capacity is null or venue_capacity between 1 and 1000),
  add constraint events_venue_capacity check (venue_capacity is null or max_participants is null or max_participants + role_places <= venue_capacity);

-- ---------------------------------------------------------------------------
-- The organizer's own venues
-- ---------------------------------------------------------------------------
create table public.activity_venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  activity_type text not null check (activity_type ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  capacity int check (capacity is null or capacity between 1 and 1000),
  created_at timestamptz not null default now()
);
create unique index activity_venues_name_uq on public.activity_venues (owner_id, activity_type, lower(btrim(name)));
alter table public.activity_venues enable row level security;
create policy activity_venues_own on public.activity_venues for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.activity_venues to authenticated;
-- anon may select so the app's query check works, but no policy lets anon see a row.
revoke insert, update, delete, truncate on public.activity_venues from anon;
grant select on public.activity_venues to anon;

-- ---------------------------------------------------------------------------
-- Requests for a role
-- ---------------------------------------------------------------------------
create table public.role_requests (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null check (activity_type ~ '^[a-z_]{2,30}$'),
  role_key text not null check (role_key ~ '^[a-z_]{2,30}$'),
  -- «badstumester»: the texts in notifications come from here, so the SQL knows no activity.
  role_label text not null check (char_length(role_label) between 1 and 40),
  title text not null check (char_length(title) between 1 and 120),
  time_hint text,
  start_time time,
  place_name text check (place_name is null or char_length(place_name) <= 200),
  note text check (note is null or char_length(note) <= 500),
  -- each: every date is its own event · poll: alternative dates for one event.
  mode text not null check (mode in ('each', 'poll')),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now()
);
create index role_requests_organizer on public.role_requests (organizer_id, created_at desc);

create table public.role_request_dates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.role_requests (id) on delete cascade,
  date date not null,
  event_id uuid references public.events (id) on delete set null,
  assigned_candidate_id uuid,
  assigned_at timestamptz,
  unique (request_id, date)
);
create index role_request_dates_event on public.role_request_dates (event_id) where event_id is not null;

create table public.role_request_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.role_requests (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  reply text check (reply is null or char_length(reply) <= 500),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index role_request_candidates_user on public.role_request_candidates (user_id) where user_id is not null;
alter table public.role_request_dates
  add constraint role_request_dates_assigned_fk foreign key (assigned_candidate_id) references public.role_request_candidates (id) on delete set null;

-- One row per person and date they were asked about. answer: true «Kan» · false «Kan ikke» · null not answered.
create table public.role_request_answers (
  candidate_id uuid not null references public.role_request_candidates (id) on delete cascade,
  date_id uuid not null references public.role_request_dates (id) on delete cascade,
  answer boolean,
  primary key (candidate_id, date_id)
);
create index role_request_answers_date on public.role_request_answers (date_id);

alter table public.role_requests enable row level security;
alter table public.role_request_dates enable row level security;
alter table public.role_request_candidates enable row level security;
alter table public.role_request_answers enable row level security;

-- Only the organizer reads them directly; the people asked use their link (functions below).
create policy role_requests_read on public.role_requests for select to authenticated using (organizer_id = auth.uid());
create policy role_request_dates_read on public.role_request_dates for select to authenticated
  using (exists (select 1 from role_requests r where r.id = request_id and r.organizer_id = auth.uid()));
create policy role_request_candidates_read on public.role_request_candidates for select to authenticated
  using (exists (select 1 from role_requests r where r.id = request_id and r.organizer_id = auth.uid()));
create policy role_request_answers_read on public.role_request_answers for select to authenticated
  using (exists (select 1 from role_request_candidates c join role_requests r on r.id = c.request_id where c.id = candidate_id and r.organizer_id = auth.uid()));

-- anon may select so the app's query check works, but no policy lets anon see a row.
grant select on public.role_requests, public.role_request_dates, public.role_request_candidates, public.role_request_answers to anon, authenticated;
revoke insert, update, delete, truncate on public.role_requests, public.role_request_dates, public.role_request_candidates, public.role_request_answers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 'confirmed' (someone has the role) · 'choose' (someone can, the organizer picks) · 'unavailable'
-- (everyone asked said no) · 'pending' (waiting for answers) · 'cancelled' (the event is cancelled).
create or replace function public.role_date_status(p_date_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when e.status = 'cancelled' or r.status = 'cancelled' then 'cancelled'
    when d.assigned_candidate_id is not null then 'confirmed'
    when exists (select 1 from role_request_answers a where a.date_id = d.id and a.answer) then 'choose'
    when exists (select 1 from role_request_answers a where a.date_id = d.id)
         and not exists (select 1 from role_request_answers a where a.date_id = d.id and a.answer is distinct from false) then 'unavailable'
    else 'pending' end
  from role_request_dates d
  join role_requests r on r.id = d.request_id
  left join events e on e.id = d.event_id
  where d.id = p_date_id;
$$;
revoke all on function public.role_date_status(uuid) from public, anon, authenticated;

-- Someone got the role for a date: tell them, and the people already invited to that event.
create or replace function public.role_assigned_notify(p_date_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_d role_request_dates;
  v_r role_requests;
  v_c role_request_candidates;
  v_day text;
begin
  select * into v_d from role_request_dates where id = p_date_id;
  select * into v_r from role_requests where id = v_d.request_id;
  select * into v_c from role_request_candidates where id = v_d.assigned_candidate_id;
  if v_c.id is null then return; end if;
  v_day := to_char(v_d.date, 'DD.MM');
  if v_c.user_id is not null and v_c.user_id <> v_r.organizer_id then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    values (v_c.user_id, 'event_updated', null, v_r.organizer_id,
            'Du er ' || v_r.role_label || ' ' || v_day, v_r.title,
            jsonb_build_object('kind', 'role_assigned', 'url', '/r/' || v_c.token));
  end if;
  -- Participants with an account: the event is no longer provisional (one event per date).
  if v_r.mode = 'each' and v_d.event_id is not null then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    select m.user_id, 'event_updated', v_d.event_id, v_r.organizer_id,
           v_r.title || ' ' || v_day || ' er bekreftet',
           initcap(v_r.role_label) || ' er klar: ' || split_part(v_c.name, ' ', 1) || '.',
           jsonb_build_object('kind', 'role_confirmed', 'url', '/event/' || v_d.event_id)
    from event_members m
    where m.event_id = v_d.event_id and m.user_id is not null and m.role <> 'organizer' and m.status::text <> 'declined';
  end if;
end $$;
revoke all on function public.role_assigned_notify(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The organizer sends the request. The events already exist (made by the app with create_event).
-- p: {activity_type, role_key, role_label, title, time_hint, start_time, place_name, note, mode,
--     dates: [{date, event_id}], candidates: [{user_id?, name}]}
-- Returns {id, candidates: [{id, user_id, name, token}]}.
-- ---------------------------------------------------------------------------
create or replace function public.create_role_request(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req role_requests;
  v_n int;
  v_c jsonb;
  v_key uuid;
  v_name text;
  v_me text;
  v_out jsonb := '[]'::jsonb;
  v_cid uuid;
  v_token text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  v_n := jsonb_array_length(coalesce(p -> 'dates', '[]'::jsonb));
  if v_n not between 1 and 120 then raise exception 'bad_dates' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p -> 'candidates', '[]'::jsonb)) not between 1 and 10 then raise exception 'bad_candidates' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p -> 'dates') d where (d ->> 'date')::date < (now() at time zone 'Europe/Oslo')::date) then
    raise exception 'date_in_past' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'dates') d
             where nullif(d ->> 'event_id', '') is not null
               and not exists (select 1 from events e where e.id = (d ->> 'event_id')::uuid and e.organizer_id = v_uid)) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  insert into role_requests (organizer_id, activity_type, role_key, role_label, title, time_hint, start_time, place_name, note, mode)
  values (v_uid, p ->> 'activity_type', p ->> 'role_key', btrim(p ->> 'role_label'), btrim(p ->> 'title'), p ->> 'time_hint',
          nullif(p ->> 'start_time', '')::time, nullif(btrim(coalesce(p ->> 'place_name', '')), ''),
          nullif(btrim(coalesce(p ->> 'note', '')), ''), coalesce(p ->> 'mode', 'each'))
  returning * into v_req;

  insert into role_request_dates (request_id, date, event_id)
  select distinct on ((d ->> 'date')::date) v_req.id, (d ->> 'date')::date, nullif(d ->> 'event_id', '')::uuid
  from jsonb_array_elements(p -> 'dates') d;

  select split_part(display_name, ' ', 1) into v_me from profiles where id = v_uid;
  for v_c in select * from jsonb_array_elements(p -> 'candidates') loop
    v_key := nullif(v_c ->> 'user_id', '')::uuid;
    v_name := btrim(coalesce(v_c ->> 'name', ''));
    if v_key is not null then
      if v_key = v_uid or not is_friend(v_uid, v_key) then raise exception 'not_friend' using errcode = '42501'; end if;
      select coalesce(nullif(v_name, ''), display_name) into v_name from profiles where id = v_key;
    end if;
    if coalesce(v_name, '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
    insert into role_request_candidates (request_id, user_id, name) values (v_req.id, v_key, left(v_name, 80))
    returning id, token into v_cid, v_token;
    insert into role_request_answers (candidate_id, date_id) select v_cid, d.id from role_request_dates d where d.request_id = v_req.id;
    if v_key is not null then
      insert into notifications (user_id, type, actor_id, title, body, data)
      values (v_key, 'invited', v_uid,
              coalesce(nullif(v_me, ''), 'Noen') || ' spør om du kan være ' || v_req.role_label,
              v_req.title || ' · ' || v_n || case v_n when 1 then ' dato' else ' datoer' end || ' å se på',
              jsonb_build_object('kind', 'role_request', 'url', '/r/' || v_token));
    end if;
    v_out := v_out || jsonb_build_object('id', v_cid, 'user_id', v_key, 'name', left(v_name, 80), 'token', v_token);
  end loop;
  return jsonb_build_object('id', v_req.id, 'candidates', v_out);
end $$;
revoke all on function public.create_role_request(jsonb) from public, anon;
grant execute on function public.create_role_request(jsonb) to authenticated;

-- Ask someone else about some of the dates (e.g. those nobody can). Same return shape as above.
create or replace function public.add_role_candidates(p_request_id uuid, p_candidates jsonb, p_date_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req role_requests;
  v_c jsonb;
  v_key uuid;
  v_name text;
  v_me text;
  v_cid uuid;
  v_token text;
  v_n int;
  v_out jsonb := '[]'::jsonb;
begin
  select * into v_req from role_requests where id = p_request_id and organizer_id = v_uid and status = 'open';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select count(*) into v_n from role_request_dates where request_id = p_request_id and id = any (coalesce(p_date_ids, '{}'));
  if v_n = 0 then raise exception 'bad_dates' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) not between 1 and 10 then raise exception 'bad_candidates' using errcode = '22023'; end if;
  select split_part(display_name, ' ', 1) into v_me from profiles where id = v_uid;
  for v_c in select * from jsonb_array_elements(p_candidates) loop
    v_key := nullif(v_c ->> 'user_id', '')::uuid;
    v_name := btrim(coalesce(v_c ->> 'name', ''));
    if v_key is not null then
      if v_key = v_uid or not is_friend(v_uid, v_key) then raise exception 'not_friend' using errcode = '42501'; end if;
      select coalesce(nullif(v_name, ''), display_name) into v_name from profiles where id = v_key;
    end if;
    if coalesce(v_name, '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
    -- Asking the same friend again only adds the dates.
    select id, token into v_cid, v_token from role_request_candidates where request_id = p_request_id and v_key is not null and user_id = v_key;
    if v_cid is null then
      insert into role_request_candidates (request_id, user_id, name) values (p_request_id, v_key, left(v_name, 80)) returning id, token into v_cid, v_token;
    end if;
    insert into role_request_answers (candidate_id, date_id)
    select v_cid, d.id from role_request_dates d where d.request_id = p_request_id and d.id = any (p_date_ids)
    on conflict do nothing;
    if v_key is not null then
      insert into notifications (user_id, type, actor_id, title, body, data)
      values (v_key, 'invited', v_uid,
              coalesce(nullif(v_me, ''), 'Noen') || ' spør om du kan være ' || v_req.role_label,
              v_req.title || ' · ' || v_n || case v_n when 1 then ' dato' else ' datoer' end || ' å se på',
              jsonb_build_object('kind', 'role_request', 'url', '/r/' || v_token));
    end if;
    v_out := v_out || jsonb_build_object('id', v_cid, 'user_id', v_key, 'name', left(v_name, 80), 'token', v_token);
    v_cid := null;
  end loop;
  return jsonb_build_object('id', p_request_id, 'candidates', v_out);
end $$;
revoke all on function public.add_role_candidates(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.add_role_candidates(uuid, jsonb, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- The person asked (no account needed): what is asked, and per date whether it is still open to them.
-- Never who else is asked or who is invited.
-- ---------------------------------------------------------------------------
create or replace function public.get_role_request(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'activity_type', r.activity_type, 'role_key', r.role_key, 'role_label', r.role_label,
    'title', r.title, 'time_hint', r.time_hint, 'start_time', r.start_time, 'place_name', r.place_name, 'note', r.note,
    'name', c.name, 'reply', c.reply, 'answered_at', c.answered_at,
    'organizer', jsonb_build_object('name', split_part(p.display_name, ' ', 1), 'avatar_url', p.avatar_url),
    'dates', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'date', d.date, 'answer', a.answer,
               'mine', d.assigned_candidate_id = c.id,
               'taken', d.assigned_candidate_id is not null and d.assigned_candidate_id <> c.id,
               'cancelled', coalesce(e.status = 'cancelled', false))
             order by d.date)
      from role_request_answers a
      join role_request_dates d on d.id = a.date_id
      left join events e on e.id = d.event_id
      where a.candidate_id = c.id), '[]'::jsonb))
  from role_request_candidates c
  join role_requests r on r.id = c.request_id
  join profiles p on p.id = r.organizer_id
  where c.token = p_token and r.status = 'open';
$$;
revoke all on function public.get_role_request(text) from public;
grant execute on function public.get_role_request(text) to anon, authenticated;

-- Answer per date: p_answers = {"<date id>": true | false | null}. Dates not in it stay as they are.
-- Alone on a date and «Kan»: you get the role. «Kan ikke» on a date you had: it is free again.
create or replace function public.answer_role_request(p_token text, p_answers jsonb, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c role_request_candidates;
  v_r role_requests;
  v_k text;
  v_v jsonb;
  v_date role_request_dates;
  v_cancelled boolean;
  v_dropped int := 0;
  v_got int := 0;
  v_ok int;
  v_total int;
begin
  select * into v_c from role_request_candidates where token = p_token for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_r from role_requests where id = v_c.request_id;
  if v_r.status <> 'open' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_reply is not null and char_length(p_reply) > 500 then raise exception 'reply_too_long' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then raise exception 'bad_answers' using errcode = '22023'; end if;

  for v_k, v_v in select * from jsonb_each(coalesce(p_answers, '{}'::jsonb)) loop
    select d.* into v_date from role_request_dates d
    join role_request_answers a on a.date_id = d.id and a.candidate_id = v_c.id
    where d.id = v_k::uuid for update of d;
    if v_date.id is null then continue; end if;
    select coalesce(e.status = 'cancelled', false) into v_cancelled from events e where e.id = v_date.event_id;
    if coalesce(v_cancelled, false) then v_date := null; continue; end if;
    update role_request_answers set answer = case jsonb_typeof(v_v) when 'boolean' then v_v::text::boolean end
    where candidate_id = v_c.id and date_id = v_date.id;
    if jsonb_typeof(v_v) is distinct from 'boolean' or v_v::text::boolean = false then
      if v_date.assigned_candidate_id = v_c.id then
        update role_request_dates set assigned_candidate_id = null, assigned_at = null where id = v_date.id;
        v_dropped := v_dropped + 1;
      end if;
    elsif v_date.assigned_candidate_id is null
          and (select count(*) from role_request_answers a where a.date_id = v_date.id) = 1 then
      update role_request_dates set assigned_candidate_id = v_c.id, assigned_at = now() where id = v_date.id;
      perform role_assigned_notify(v_date.id);
      v_got := v_got + 1;
    end if;
    v_date := null;
  end loop;

  update role_request_candidates set reply = nullif(btrim(coalesce(p_reply, '')), ''), answered_at = now() where id = v_c.id;

  select count(*) filter (where a.answer), count(*) into v_ok, v_total from role_request_answers a where a.candidate_id = v_c.id;
  insert into notifications (user_id, type, actor_id, title, body, data)
  values (v_r.organizer_id, 'response_received', case when auth.uid() = v_c.user_id then v_c.user_id end,
          split_part(v_c.name, ' ', 1) || ' har svart på ' || v_r.title,
          case when v_ok = 0 then 'Kan ingen av datoene.'
               when v_ok = v_total then case when v_total = 1 then 'Kan datoen.' else 'Kan alle datoene.' end
               else 'Kan ' || v_ok || ' av ' || v_total || ' datoer.' end
          || case when v_dropped > 0 then ' Kan likevel ikke ' || v_dropped || case v_dropped when 1 then ' dato' else ' datoer' end || ' hen hadde.' else '' end,
          jsonb_build_object('kind', 'role_answered', 'url', '/rolle/' || v_r.id));
end $$;
revoke all on function public.answer_role_request(text, jsonb, text) from public;
grant execute on function public.answer_role_request(text, jsonb, text) to anon, authenticated;

-- The organizer gives the role for a date to one who can (null: nobody). Never two on one date.
create or replace function public.assign_role(p_date_id uuid, p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_d role_request_dates;
begin
  select d.* into v_d from role_request_dates d join role_requests r on r.id = d.request_id
  where d.id = p_date_id and r.organizer_id = auth.uid() and r.status = 'open' for update of d;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_candidate_id is null then
    update role_request_dates set assigned_candidate_id = null, assigned_at = null where id = p_date_id;
    return;
  end if;
  if not exists (select 1 from role_request_answers a where a.date_id = p_date_id and a.candidate_id = p_candidate_id and a.answer) then
    raise exception 'candidate_cannot' using errcode = '22023';
  end if;
  if v_d.assigned_candidate_id is not distinct from p_candidate_id then return; end if;
  update role_request_dates set assigned_candidate_id = p_candidate_id, assigned_at = now() where id = p_date_id;
  perform role_assigned_notify(p_date_id);
end $$;
revoke all on function public.assign_role(uuid, uuid) from public, anon;
grant execute on function public.assign_role(uuid, uuid) to authenticated;

create or replace function public.cancel_role_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update role_requests set status = 'cancelled' where id = p_id and organizer_id = auth.uid() and status = 'open';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.cancel_role_request(uuid) from public, anon;
grant execute on function public.cancel_role_request(uuid) to authenticated;

-- Requests sent to me (in the app): what is still waiting for my answer.
create or replace function public.my_role_requests()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'token', c.token, 'title', r.title, 'role_label', r.role_label,
           'organizer_name', split_part(p.display_name, ' ', 1),
           'open', (select count(*) from role_request_answers a join role_request_dates d on d.id = a.date_id
                    left join events e on e.id = d.event_id
                    where a.candidate_id = c.id and a.answer is null and coalesce(e.status::text, '') <> 'cancelled'
                      and d.date >= (now() at time zone 'Europe/Oslo')::date),
           'mine', (select count(*) from role_request_dates d where d.assigned_candidate_id = c.id
                      and d.date >= (now() at time zone 'Europe/Oslo')::date))
         order by r.created_at desc), '[]'::jsonb)
  from role_request_candidates c
  join role_requests r on r.id = c.request_id and r.status = 'open'
  join profiles p on p.id = r.organizer_id
  where c.user_id = auth.uid();
$$;
revoke all on function public.my_role_requests() from public, anon;
grant execute on function public.my_role_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- The role on an event, for everyone who can see the event (computed field `activity_role`)
-- {role_label, request_id (organizer side only), status, name, dates: [{date, status, name}]}
-- ---------------------------------------------------------------------------
create or replace function public.event_role_json(p_event_id uuid, p_selected date, p_organizer boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  with ds as (
    select d.id, d.date, role_date_status(d.id) status, split_part(c.name, ' ', 1) name, r.id request_id, r.role_label
    from role_request_dates d
    join role_requests r on r.id = d.request_id and r.status = 'open'
    left join role_request_candidates c on c.id = d.assigned_candidate_id
    where d.event_id = p_event_id
  )
  select case when not exists (select 1 from ds) then null else jsonb_build_object(
    'role_label', (select role_label from ds limit 1),
    'request_id', case when p_organizer then (select request_id from ds limit 1) end,
    'status', coalesce(
       (select status from ds where ds.date = p_selected),
       case when (select count(*) from ds) = 1 then (select status from ds)
            when exists (select 1 from ds where status = 'confirmed') then 'partly' else 'pending' end),
    'name', coalesce((select name from ds where ds.date = p_selected), case when (select count(*) from ds) = 1 then (select name from ds) end),
    'dates', (select jsonb_agg(jsonb_build_object('date', date, 'status', status, 'name', name) order by date) from ds)) end;
$$;
revoke all on function public.event_role_json(uuid, date, boolean) from public, anon, authenticated;

create or replace function public.activity_role(e events)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when e.activity_type is null then null
              when is_event_organizer(e.id) then event_role_json(e.id, e.selected_date, true)
              when exists (select 1 from event_members m where m.event_id = e.id and m.user_id = auth.uid()) then event_role_json(e.id, e.selected_date, false)
         end;
$$;
grant execute on function public.activity_role(events) to authenticated;

-- The invitation page (link, no account): the type, and whether the role is confirmed yet.
create or replace function public.get_invite_activity(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when e.activity_type is null then null else
    jsonb_build_object('activity_type', e.activity_type, 'role_places', e.role_places, 'venue_capacity', e.venue_capacity,
                       'role', event_role_json(e.id, e.selected_date, false)) end
  from event_invites i join events e on e.id = i.event_id
  where i.token = p_token and i.revoked_at is null and e.status <> 'cancelled';
$$;
grant execute on function public.get_invite_activity(text) to anon, authenticated;

-- An event with someone in a role is cancelled: tell them.
create or replace function public.events_cancelled_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, event_id, title, body, data)
  select c.user_id, 'event_cancelled', null, new.title || ' ' || to_char(d.date, 'DD.MM') || ' er avlyst',
         'Du trenger ikke stille som ' || r.role_label || '.', jsonb_build_object('kind', 'role_cancelled', 'url', '/r/' || c.token)
  from role_request_dates d
  join role_requests r on r.id = d.request_id and r.status = 'open'
  join role_request_candidates c on c.id = d.assigned_candidate_id
  where d.event_id = new.id and c.user_id is not null and c.user_id <> new.organizer_id;
  return null;
end $$;
create trigger events_cancelled_roles after update of status on public.events
  for each row when (new.status = 'cancelled' and old.status is distinct from new.status and new.activity_type is not null)
  execute function public.events_cancelled_roles();
revoke all on function public.events_cancelled_roles() from public, anon, authenticated;
