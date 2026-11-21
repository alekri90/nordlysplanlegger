-- Nordlys Planlegger — full names on the invitation
--
-- 1. The role on an event (the sauna master) shows the whole name, not just the first name.
-- 2. The invitation can list who is coming (full names), so an invited guest sees who said yes
--    before answering. Anyone with the invite link can see it, like the rest of the invitation.

-- ---------------------------------------------------------------------------
-- 1. The role: the whole name (was split_part(c.name, ' ', 1)).
-- ---------------------------------------------------------------------------
create or replace function public.event_role_json(p_event_id uuid, p_selected date, p_organizer boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  with ds as (
    select d.id, d.date, d.invite_now, role_date_status(d.id) status, btrim(c.name) name, c.user_id, c.token,
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

-- ---------------------------------------------------------------------------
-- 2. Who is coming, on the invitation: the organizer first, then in the order they said yes.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite_attendees(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'name', left(btrim(coalesce(nullif(p.display_name, ''), m.display_name)), 80),
           'avatar_url', p.avatar_url,
           'organizer', m.role = 'organizer')
         order by (m.role = 'organizer') desc, coalesce(m.responded_at, m.created_at)), '[]'::jsonb)
  from event_invites i
  join events e on e.id = i.event_id and e.status <> 'cancelled'
  join event_members m on m.event_id = e.id and m.status = 'attending'
  left join profiles p on p.id = m.user_id
  where i.token = p_token and i.revoked_at is null and (i.expires_at is null or i.expires_at > now());
$$;
revoke all on function public.get_invite_attendees(text) from public;
grant execute on function public.get_invite_attendees(text) to anon, authenticated;
