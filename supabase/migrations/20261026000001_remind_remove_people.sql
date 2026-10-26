-- Nordlys Planlegger — reminding, removing, and co-hosts / fixed places on single events
--
-- * remind_pending: one tap sends «X venter på svaret ditt» to everyone with an account who hasn't
--   answered (at most once every 12 hours per person, so it never turns into nagging). People without
--   an account can't be notified; the count is returned so the app can offer their links.
-- * remove_event_member: the organizer side takes someone off the guest list, quietly. Their personal
--   link stops working and their notifications for it go away.
-- * set_event_people: co-hosts and fixed places on an event that isn't recurring (recurring events
--   use set_series_people). Only the organizer.

create or replace function public.remind_pending(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
  v_body text;
  v_sent int;
  v_without int;
begin
  if not is_event_organizer(p_event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  select * into v_event from events where id = p_event_id;
  if v_event.status not in ('draft', 'polling', 'confirmed', 'date_selected') then raise exception 'nothing_to_answer' using errcode = '22023'; end if;
  v_name := split_part(coalesce(nullif((select display_name from profiles where id = auth.uid()), ''), 'Arrangøren'), ' ', 1);
  v_body := v_event.title || case v_event.status
    when 'polling' then ' – trykk på dagene du ikke kan'
    when 'draft' then ' – er du med?'
    else ' – kommer du?' end;

  with sent as (
    insert into notifications (user_id, type, event_id, actor_id, title, body, data)
    select m.user_id, 'reminder_respond', p_event_id, auth.uid(), v_name || ' venter på svaret ditt', v_body,
           jsonb_build_object('kind', 'manual_reminder', 'url', '/event/' || p_event_id)
    from event_members m
    where m.event_id = p_event_id and m.role = 'guest' and m.user_id is not null and m.status in ('invited', 'opened')
      and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = p_event_id
                      and x.data ->> 'kind' = 'manual_reminder' and x.created_at > now() - interval '12 hours')
    returning 1
  )
  select count(*) into v_sent from sent;
  select count(*) into v_without from event_members m
  where m.event_id = p_event_id and m.role = 'guest' and m.user_id is null and m.status in ('invited', 'opened');
  return jsonb_build_object('sent', v_sent, 'without_account', v_without);
end $$;
revoke all on function public.remind_pending(uuid) from public, anon;
grant execute on function public.remind_pending(uuid) to authenticated;

create or replace function public.remove_event_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m event_members;
begin
  select * into v_m from event_members where id = p_member_id;
  if not found then return; end if;
  if not is_event_organizer(v_m.event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  if v_m.role = 'organizer' then raise exception 'cannot_remove_organizer' using errcode = '22023'; end if;
  if v_m.guest_id is not null then
    delete from event_invites where event_id = v_m.event_id and guest_profile_id = v_m.guest_id;
  end if;
  if v_m.user_id is not null then
    delete from notifications where user_id = v_m.user_id and event_id = v_m.event_id;
    delete from event_reserved_seats where event_id = v_m.event_id and user_id = v_m.user_id;
  end if;
  delete from event_members where id = p_member_id;
end $$;
revoke all on function public.remove_event_member(uuid) from public, anon;
grant execute on function public.remove_event_member(uuid) to authenticated;

create or replace function public.set_event_people(p_event_id uuid, p_cohost_ids uuid[], p_reserved_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
begin
  select * into v_event from events where id = p_event_id;
  if not found or v_event.organizer_id is distinct from auth.uid() then raise exception 'not_organizer' using errcode = '42501'; end if;
  if v_event.series_id is not null then raise exception 'use_series_settings' using errcode = '22023'; end if;
  perform set_config('planlegger.capacity_bulk', 'on', true);
  update event_members set is_cohost = (user_id = any (coalesce(p_cohost_ids, '{}')))
  where event_id = p_event_id and role = 'guest' and user_id is not null
    and is_cohost is distinct from (user_id = any (coalesce(p_cohost_ids, '{}')));
  perform set_config('planlegger.capacity_bulk', '', true);
  delete from event_reserved_seats where event_id = p_event_id;
  insert into event_reserved_seats (event_id, user_id)
  select p_event_id, m.user_id from event_members m
  where m.event_id = p_event_id and m.role = 'guest' and m.user_id = any (coalesce(p_reserved_ids, '{}'))
  on conflict do nothing;
  perform promote_waitlist(p_event_id);
end $$;
revoke all on function public.set_event_people(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.set_event_people(uuid, uuid[], uuid[]) to authenticated;
