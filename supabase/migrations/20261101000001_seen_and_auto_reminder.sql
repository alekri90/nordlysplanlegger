-- The organizer sees who has seen the invitation, and those who saw it but didn't answer get one
-- reminder two hours later.

-- A personal link counts too, unless it's the organizer checking their own link.
create or replace function public.mark_invite_opened(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update event_members m set status = 'opened', opened_at = now()
  from event_invites i
  where i.token = p_token and m.event_id = i.event_id and m.status = 'invited'
    and (m.user_id = auth.uid()
         or (i.guest_profile_id is not null and m.guest_id = i.guest_profile_id and not is_event_organizer(i.event_id)));
  update event_invites set use_count = use_count + 1 where token = p_token;
end $$;

-- Opened from the app or a notification, without going through the link.
create or replace function public.mark_event_opened(p_event_id uuid)
returns void language sql security definer set search_path = public as $$
  update event_members set status = 'opened', opened_at = now()
  where event_id = p_event_id and user_id = auth.uid() and status = 'invited';
$$;
revoke all on function public.mark_event_opened(uuid) from public, anon;
grant execute on function public.mark_event_opened(uuid) to authenticated;

/**
 * Saw it, didn't answer: one reminder after two hours, between 09 and 21 (later ones wait for the
 * morning). Not right after another reminder, and not for invitations opened long ago.
 */
create or replace function public.remind_seen_unanswered(p_now timestamptz default now())
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'reminder_respond', e.id, e.organizer_id,
         split_part(coalesce(nullif(p.display_name, ''), 'Arrangøren'), ' ', 1) || ' venter på svaret ditt',
         e.title || case e.status when 'polling' then ' – trykk på dagene du ikke kan' when 'draft' then ' – er du med?' else ' – kommer du?' end,
         jsonb_build_object('kind', 'seen_reminder', 'url', '/event/' || e.id)
  from event_members m
  join events e on e.id = m.event_id
  left join profiles p on p.id = e.organizer_id
  where m.status = 'opened' and m.role = 'guest' and m.user_id is not null
    and m.opened_at <= p_now - interval '2 hours'
    and m.opened_at > p_now - interval '7 days'
    and e.status in ('draft', 'polling', 'date_selected', 'confirmed')
    and (e.selected_date is null or e.selected_date >= (p_now at time zone e.timezone)::date)
    and extract(hour from p_now at time zone e.timezone) between 9 and 20
    and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                    and x.data ->> 'kind' = 'seen_reminder')
    and not exists (select 1 from notifications x where x.user_id = m.user_id and x.event_id = e.id
                    and x.type = 'reminder_respond' and x.created_at > p_now - interval '12 hours');
$$;
revoke all on function public.remind_seen_unanswered(timestamptz) from public, anon, authenticated;

-- Runs with the existing 15-minute job.
create or replace function public.send_event_reminders_with_series(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  perform run_event_series(p_now);
  perform send_event_reminders(p_now);
  perform remind_seen_unanswered(p_now);
end $$;
