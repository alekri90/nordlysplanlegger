-- Nordlys Planlegger — Aufguss, runde 2
--
-- * events.activity_theme: et tema for kvelden («Eukalyptus»), satt av arrangøren eller den med
--   rollen (badstumesteren). Vises under tittelen.
-- * Tittelen følger rollen: «Aufguss» blir «Aufguss med Ola» når badstumesteren er bekreftet, og
--   tilbake igjen om hen trekker seg (bare om arrangøren ikke har gitt det et eget navn).
-- * role_request_dates.invite_now: «Inviter deltagere senere» betyr at arrangementet holdes tilbake
--   (vises ikke som et arrangement) til rollen er bekreftet. Da dukker det opp, og arrangøren får
--   beskjed om at det kan inviteres. Inviterer arrangøren likevel før, er det ikke holdt lenger.
-- * Den som har fått rollen og har konto, ser arrangementet (tid, sted, plasser, tema) – men ikke
--   gjestelisten eller beskjedene. Hen er fortsatt ikke deltager.
--
-- Bare nye kolonner, policyer og funksjoner, og nye versjoner av funksjoner fra 20261112000001.

alter table public.events
  add column activity_theme text check (activity_theme is null or char_length(activity_theme) between 1 and 80);

alter table public.role_request_dates
  add column invite_now boolean not null default true;

-- ---------------------------------------------------------------------------
-- The one with the role can see the event
-- ---------------------------------------------------------------------------
create or replace function public.is_role_holder(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_request_dates d
    join role_requests r on r.id = d.request_id and r.status = 'open'
    join role_request_candidates c on c.id = d.assigned_candidate_id
    where d.event_id = p_event_id and c.user_id = auth.uid());
$$;
revoke all on function public.is_role_holder(uuid) from public, anon;
grant execute on function public.is_role_holder(uuid) to authenticated;

create policy events_select_role_holder on public.events for select to authenticated using (public.is_role_holder(id));
create policy locations_select_role_holder on public.event_locations for select to authenticated using (public.is_role_holder(event_id));
create policy images_select_role_holder on public.event_images for select to authenticated using (public.is_role_holder(event_id));
create policy options_select_role_holder on public.event_date_options for select to authenticated using (public.is_role_holder(event_id));

-- ---------------------------------------------------------------------------
-- The title follows the role: «Aufguss» ⇄ «Aufguss med Ola» (one event per date)
-- ---------------------------------------------------------------------------
create or replace function public.role_dates_sync_title()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_r role_requests;
  v_name text;
begin
  if new.event_id is null then return null; end if;
  select * into v_r from role_requests where id = new.request_id;
  if v_r.mode <> 'each' then return null; end if;
  select split_part(name, ' ', 1) into v_name from role_request_candidates where id = new.assigned_candidate_id;
  update events e
  set title = case when v_name is null then v_r.title else left(v_r.title || ' med ' || v_name, 120) end
  where e.id = new.event_id
    and (e.title = v_r.title or left(e.title, char_length(v_r.title) + 5) = v_r.title || ' med ');
  return null;
end $$;
revoke all on function public.role_dates_sync_title() from public, anon, authenticated;
create trigger role_dates_sync_title after update of assigned_candidate_id on public.role_request_dates
  for each row when (old.assigned_candidate_id is distinct from new.assigned_candidate_id)
  execute function public.role_dates_sync_title();

-- Someone got the role for a date: tell them (to the event, when they have an account), and the
-- people already invited to that event.
create or replace function public.role_assigned_notify(p_date_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_d role_request_dates;
  v_r role_requests;
  v_c role_request_candidates;
  v_title text;
  v_day text;
begin
  select * into v_d from role_request_dates where id = p_date_id;
  select * into v_r from role_requests where id = v_d.request_id;
  select * into v_c from role_request_candidates where id = v_d.assigned_candidate_id;
  if v_c.id is null then return; end if;
  v_day := to_char(v_d.date, 'DD.MM');
  select coalesce(e.title, v_r.title) into v_title from events e where e.id = v_d.event_id;
  v_title := coalesce(v_title, v_r.title);
  if v_c.user_id is not null and v_c.user_id <> v_r.organizer_id then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    values (v_c.user_id, 'event_updated', case when v_r.mode = 'each' then v_d.event_id end, v_r.organizer_id,
            'Du er ' || v_r.role_label || ' ' || v_day, v_title || ' ligger nå i kalenderen din i appen.',
            jsonb_build_object('kind', 'role_assigned',
                               'url', case when v_r.mode = 'each' and v_d.event_id is not null then '/event/' || v_d.event_id else '/r/' || v_c.token end));
  end if;
  if v_r.mode = 'each' and v_d.event_id is not null then
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    select m.user_id, 'event_updated', v_d.event_id, v_r.organizer_id,
           v_title || ' ' || v_day || ' er bekreftet',
           initcap(v_r.role_label) || ' er klar: ' || split_part(v_c.name, ' ', 1) || '.',
           jsonb_build_object('kind', 'role_confirmed', 'url', '/event/' || v_d.event_id)
    from event_members m
    where m.event_id = v_d.event_id and m.user_id is not null and m.role <> 'organizer' and m.status::text <> 'declined';
  end if;
end $$;
revoke all on function public.role_assigned_notify(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The request, now with «inviter nå / senere» per date: dates: [{date, event_id, invite_now}]
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

  insert into role_request_dates (request_id, date, event_id, invite_now)
  select distinct on ((d ->> 'date')::date) v_req.id, (d ->> 'date')::date, nullif(d ->> 'event_id', '')::uuid,
         coalesce((d ->> 'invite_now')::boolean, true)
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

-- ---------------------------------------------------------------------------
-- The page for the one asked: per date also the theme, and the event (when it is theirs).
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
               'cancelled', coalesce(e.status = 'cancelled', false),
               'theme', case when d.assigned_candidate_id = c.id then e.activity_theme end,
               'event_id', case when d.assigned_candidate_id = c.id and r.mode = 'each' and c.user_id is not null then d.event_id end)
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

-- Answer per date. Now also tells the organizer how many dates got confirmed, and that the ones
-- held back («inviter senere») are ready for invitations.
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
  v_ready int := 0;
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
      if not v_date.invite_now and not exists (select 1 from event_members m where m.event_id = v_date.event_id and m.role <> 'organizer') then
        v_ready := v_ready + 1;
      end if;
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
          || case when v_got > 0 then ' ' || v_got || case v_got when 1 then ' dato er bekreftet.' else ' datoer er bekreftet.' end else '' end
          || case when v_ready > 0 then ' Du kan invitere deltagere nå.' else '' end
          || case when v_dropped > 0 then ' Kan likevel ikke ' || v_dropped || case v_dropped when 1 then ' dato' else ' datoer' end || ' hen hadde.' else '' end,
          jsonb_build_object('kind', 'role_answered', 'url', '/rolle/' || v_r.id));
end $$;
revoke all on function public.answer_role_request(text, jsonb, text) from public;
grant execute on function public.answer_role_request(text, jsonb, text) to anon, authenticated;

-- Stopping the request: events held back for it (never shown, nobody invited) go with it.
create or replace function public.cancel_role_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update role_requests set status = 'cancelled' where id = p_id and organizer_id = auth.uid() and status = 'open';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update events e set status = 'cancelled'
  from role_request_dates d
  where d.request_id = p_id and e.id = d.event_id and not d.invite_now and d.assigned_candidate_id is null
    and e.status <> 'cancelled'
    and not exists (select 1 from event_members m where m.event_id = e.id and m.role <> 'organizer');
end $$;
revoke all on function public.cancel_role_request(uuid) from public, anon;
grant execute on function public.cancel_role_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The role on an event: now also `hold` (held back until confirmed, invite later), `mine` (I have
-- the role) and `token` (my answer page).
-- ---------------------------------------------------------------------------
create or replace function public.event_role_json(p_event_id uuid, p_selected date, p_organizer boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  with ds as (
    select d.id, d.date, d.invite_now, role_date_status(d.id) status, split_part(c.name, ' ', 1) name, c.user_id, c.token,
           r.id request_id, r.role_label
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
    'hold', (select bool_and(not invite_now) from ds)
            and not exists (select 1 from ds where status = 'confirmed')
            and not exists (select 1 from event_members m where m.event_id = p_event_id and m.role <> 'organizer'),
    'mine', exists (select 1 from ds where ds.user_id = auth.uid()),
    'token', (select token from ds where ds.user_id = auth.uid() limit 1),
    'dates', (select jsonb_agg(jsonb_build_object('date', date, 'status', status, 'name', name) order by date) from ds)) end;
$$;
revoke all on function public.event_role_json(uuid, date, boolean) from public, anon, authenticated;

create or replace function public.activity_role(e events)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when e.activity_type is null then null
              when is_event_organizer(e.id) then event_role_json(e.id, e.selected_date, true)
              when exists (select 1 from event_members m where m.event_id = e.id and m.user_id = auth.uid())
                or is_role_holder(e.id) then event_role_json(e.id, e.selected_date, false)
         end;
$$;
grant execute on function public.activity_role(events) to authenticated;

create or replace function public.get_invite_activity(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when e.activity_type is null then null else
    jsonb_build_object('activity_type', e.activity_type, 'role_places', e.role_places, 'venue_capacity', e.venue_capacity,
                       'theme', e.activity_theme, 'role', event_role_json(e.id, e.selected_date, false)) end
  from event_invites i join events e on e.id = i.event_id
  where i.token = p_token and i.revoked_at is null and e.status <> 'cancelled';
$$;
grant execute on function public.get_invite_activity(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The theme: the organizer (and co-hosts) or the one with the role. The other side is told.
-- ---------------------------------------------------------------------------
create or replace function public.role_theme_set(p_event_id uuid, p_theme text, p_by_holder boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_theme text := nullif(btrim(coalesce(p_theme, '')), '');
  v_e events;
begin
  if v_theme is not null and char_length(v_theme) > 80 then raise exception 'theme_too_long' using errcode = '22023'; end if;
  update events set activity_theme = v_theme
  where id = p_event_id and activity_type is not null and status <> 'cancelled' and activity_theme is distinct from v_theme
  returning * into v_e;
  if v_e.id is null or v_theme is null then return; end if;
  if p_by_holder then
    insert into notifications (user_id, type, event_id, title, body, data)
    values (v_e.organizer_id, 'event_updated', v_e.id, v_e.title || ' ' || to_char(v_e.selected_date, 'DD.MM') || ' har fått tema',
            v_theme, jsonb_build_object('kind', 'role_theme', 'url', '/event/' || v_e.id));
  else
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    select c.user_id, 'event_updated', v_e.id, v_e.organizer_id, v_e.title || ' ' || to_char(d.date, 'DD.MM') || ' har fått tema',
           v_theme, jsonb_build_object('kind', 'role_theme', 'url', '/event/' || v_e.id)
    from role_request_dates d
    join role_requests r on r.id = d.request_id and r.status = 'open' and r.mode = 'each'
    join role_request_candidates c on c.id = d.assigned_candidate_id
    where d.event_id = v_e.id and c.user_id is not null and c.user_id <> v_e.organizer_id;
  end if;
end $$;
revoke all on function public.role_theme_set(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.set_activity_theme(p_event_id uuid, p_theme text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if is_event_organizer(p_event_id) then
    perform role_theme_set(p_event_id, p_theme, false);
  elsif is_role_holder(p_event_id) then
    perform role_theme_set(p_event_id, p_theme, true);
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end $$;
revoke all on function public.set_activity_theme(uuid, text) from public, anon;
grant execute on function public.set_activity_theme(uuid, text) to authenticated;

-- From the answer page (no account): only on a date that is theirs.
create or replace function public.set_role_theme(p_token text, p_date_id uuid, p_theme text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
begin
  select d.event_id into v_event
  from role_request_candidates c
  join role_requests r on r.id = c.request_id and r.status = 'open'
  join role_request_dates d on d.request_id = r.id and d.id = p_date_id and d.assigned_candidate_id = c.id
  where c.token = p_token;
  if v_event is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform role_theme_set(v_event, p_theme, true);
end $$;
revoke all on function public.set_role_theme(text, uuid, text) from public;
grant execute on function public.set_role_theme(text, uuid, text) to anon, authenticated;
