-- Nordlys Planlegger — avklar datoer med noen før gjengen inviteres
--
-- Arrangøren foreslår dager til én person (badstumesteren, hytteeieren, mormor). Personen svarer
-- «Passer» / «Passer ikke» per dag via en lenke, uten konto. Ingenting opprettes og ingen inviteres
-- før arrangøren har sett svaret og trykket «Inviter». Arrangementene lages da av appen med vanlig
-- create_event, så alt annet (plasser, pris, gjester, gjeng) fungerer som før.
--
-- Bare nye tabeller og funksjoner; ingen eksisterende funksjon skrives om. Ingen fremmednøkkel fra
-- events eller event_members, så embeds der forblir entydige.

create table public.date_clearances (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  -- The key person: a friend in the app, or only a name (they get the link).
  key_user_id uuid references public.profiles (id) on delete set null,
  key_name text not null check (char_length(key_name) between 1 and 80),
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  title text not null check (char_length(title) between 1 and 120),
  category text,
  cover_image_url text,
  time_hint text,
  start_time time,
  place_name text check (place_name is null or char_length(place_name) <= 200),
  note text check (note is null or char_length(note) <= 500),
  -- What the organizer chose in the create flow (who, places, price …), read back by the app.
  draft jsonb not null default '{}'::jsonb check (pg_column_size(draft) < 20000),
  status text not null default 'pending' check (status in ('pending', 'answered', 'done', 'cancelled')),
  reply text check (reply is null or char_length(reply) <= 500),
  answered_at timestamptz,
  event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index date_clearances_organizer on public.date_clearances (organizer_id, created_at desc);
create index date_clearances_key_user on public.date_clearances (key_user_id) where key_user_id is not null;

create table public.date_clearance_days (
  clearance_id uuid not null references public.date_clearances (id) on delete cascade,
  date date not null,
  ok boolean,
  primary key (clearance_id, date)
);

alter table public.date_clearances enable row level security;
alter table public.date_clearance_days enable row level security;

-- Reading: the organizer, and the key person if they have an account. All changes go through functions.
create policy date_clearances_read on public.date_clearances for select to authenticated
  using (organizer_id = auth.uid() or key_user_id = auth.uid());
create policy date_clearance_days_read on public.date_clearance_days for select to authenticated
  using (exists (select 1 from date_clearances c where c.id = clearance_id and (c.organizer_id = auth.uid() or c.key_user_id = auth.uid())));

grant select on public.date_clearances, public.date_clearance_days to authenticated;
revoke insert, update, delete on public.date_clearances, public.date_clearance_days from anon, authenticated;
revoke all on public.date_clearances, public.date_clearance_days from anon;

-- ---------------------------------------------------------------------------
-- The organizer sends the request. Returns {id, token}.
-- p: {key_user_id?, key_name, title, category, cover_image_url, time_hint, start_time, place_name, note, dates[], draft}
-- ---------------------------------------------------------------------------
create or replace function public.create_date_clearance(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key uuid := nullif(p ->> 'key_user_id', '')::uuid;
  v_name text := btrim(coalesce(p ->> 'key_name', ''));
  v_dates date[];
  v_row date_clearances;
  v_me text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_key is not null then
    if v_key = v_uid or not is_friend(v_uid, v_key) then raise exception 'not_friend' using errcode = '42501'; end if;
    select coalesce(nullif(v_name, ''), display_name) into v_name from profiles where id = v_key;
  end if;
  if coalesce(v_name, '') = '' then raise exception 'key_name_required' using errcode = '22023'; end if;
  select array_agg(distinct d::date order by d::date) into v_dates from jsonb_array_elements_text(coalesce(p -> 'dates', '[]'::jsonb)) d;
  if coalesce(array_length(v_dates, 1), 0) not between 1 and 120 then raise exception 'bad_dates' using errcode = '22023'; end if;
  if v_dates[1] < (now() at time zone 'Europe/Oslo')::date then raise exception 'date_in_past' using errcode = '22023'; end if;

  insert into date_clearances (organizer_id, key_user_id, key_name, title, category, cover_image_url, time_hint, start_time, place_name, note, draft)
  values (v_uid, v_key, left(v_name, 80), btrim(p ->> 'title'), p ->> 'category', p ->> 'cover_image_url', p ->> 'time_hint',
          nullif(p ->> 'start_time', '')::time, nullif(btrim(coalesce(p ->> 'place_name', '')), ''),
          nullif(btrim(coalesce(p ->> 'note', '')), ''), coalesce(p -> 'draft', '{}'::jsonb))
  returning * into v_row;
  insert into date_clearance_days (clearance_id, date) select v_row.id, unnest(v_dates);

  if v_key is not null then
    select split_part(display_name, ' ', 1) into v_me from profiles where id = v_uid;
    insert into notifications (user_id, type, actor_id, title, body, data)
    values (v_key, 'invited', v_uid,
            coalesce(nullif(v_me, ''), 'Noen') || ' lurer på hvilke dager som passer',
            v_row.title || ' · ' || array_length(v_dates, 1) || case array_length(v_dates, 1) when 1 then ' dag' else ' dager' end || ' å se på',
            jsonb_build_object('kind', 'clearance_request', 'url', '/a/' || v_row.token));
  end if;
  return jsonb_build_object('id', v_row.id, 'token', v_row.token);
end $$;
revoke all on function public.create_date_clearance(jsonb) from public, anon;
grant execute on function public.create_date_clearance(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The key person's page (no account needed): what is asked, never who is invited.
-- ---------------------------------------------------------------------------
create or replace function public.get_date_clearance(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', c.title, 'category', c.category, 'cover_image_url', c.cover_image_url,
    'time_hint', c.time_hint, 'start_time', c.start_time, 'place_name', c.place_name, 'note', c.note,
    'key_name', c.key_name, 'status', c.status, 'reply', c.reply, 'answered_at', c.answered_at,
    'organizer', jsonb_build_object('name', split_part(p.display_name, ' ', 1), 'avatar_url', p.avatar_url),
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'ok', d.ok) order by d.date)
                      from date_clearance_days d where d.clearance_id = c.id), '[]'::jsonb))
  from date_clearances c join profiles p on p.id = c.organizer_id
  where c.token = p_token and c.status <> 'cancelled';
$$;
revoke all on function public.get_date_clearance(text) from public;
grant execute on function public.get_date_clearance(text) to anon, authenticated;

-- The key person answers (and may change it until the organizer has invited). The organizer is told.
create or replace function public.answer_date_clearance(p_token text, p_ok_dates date[], p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row date_clearances;
  v_ok int;
  v_total int;
begin
  select * into v_row from date_clearances where token = p_token for update;
  if not found or v_row.status = 'cancelled' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_row.status = 'done' then raise exception 'already_done' using errcode = '22023'; end if;
  if p_reply is not null and char_length(p_reply) > 500 then raise exception 'reply_too_long' using errcode = '22023'; end if;

  update date_clearance_days set ok = (date = any (coalesce(p_ok_dates, '{}'))) where clearance_id = v_row.id;
  update date_clearances set status = 'answered', answered_at = now(), reply = nullif(btrim(coalesce(p_reply, '')), '')
  where id = v_row.id;

  select count(*) filter (where ok), count(*) into v_ok, v_total from date_clearance_days where clearance_id = v_row.id;
  insert into notifications (user_id, type, actor_id, title, body, data)
  values (v_row.organizer_id, 'response_received', case when auth.uid() = v_row.key_user_id then v_row.key_user_id end,
          split_part(v_row.key_name, ' ', 1) || ' har svart på ' || v_row.title,
          case when v_ok = 0 then 'Ingen av dagene passet.'
               when v_ok = v_total then case when v_total = 1 then 'Dagen passer.' else 'Alle dagene passer.' end
               else v_ok || ' av ' || v_total || ' dager passer.' end,
          jsonb_build_object('kind', 'clearance_answered', 'url', '/avklaring/' || v_row.id));
end $$;
revoke all on function public.answer_date_clearance(text, date[], text) from public;
grant execute on function public.answer_date_clearance(text, date[], text) to anon, authenticated;

-- The organizer has made the events (or stops the request).
create or replace function public.finish_date_clearance(p_id uuid, p_event_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update date_clearances set status = 'done', event_ids = coalesce(p_event_ids, '{}')
  where id = p_id and organizer_id = auth.uid() and status in ('pending', 'answered');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.finish_date_clearance(uuid, uuid[]) from public, anon;
grant execute on function public.finish_date_clearance(uuid, uuid[]) to authenticated;

create or replace function public.cancel_date_clearance(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update date_clearances set status = 'cancelled'
  where id = p_id and organizer_id = auth.uid() and status in ('pending', 'answered');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.cancel_date_clearance(uuid) from public, anon;
grant execute on function public.cancel_date_clearance(uuid) to authenticated;
