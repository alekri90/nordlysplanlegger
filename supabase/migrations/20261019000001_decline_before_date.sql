-- Nordlys Planlegger — saying no before there is a date
--
-- An invitee can say «Kan ikke denne gangen» while the date is being found (poll or no date yet).
-- The organizer is told, and that person no longer counts in the date ranking — before, someone who
-- declined without marking days looked like they could make every date.

-- Ranking (mirrors src/lib/ranking.ts): people who declined are left out entirely.
create or replace view public.event_date_scores with (security_invoker = true) as
with respondents as (
  select m.event_id, count(*) filter (where m.role = 'organizer' or m.status not in ('invited', 'opened')) as responded,
         count(*) as invited
  from public.event_members m
  where m.status <> 'declined'
  group by m.event_id
)
select
  o.id as date_option_id,
  o.event_id,
  o.date,
  r.invited,
  r.responded,
  count(a.id) filter (where a.status = 'unavailable') as unavailable,
  r.responded - count(a.id) filter (where a.status = 'unavailable') as available,
  rank() over (
    partition by o.event_id
    order by r.responded - count(a.id) filter (where a.status = 'unavailable') desc, o.date asc
  ) as rank
from public.event_date_options o
join respondents r on r.event_id = o.event_id
left join public.event_availability a on a.date_option_id = o.id
  and exists (select 1 from public.event_members am where am.id = a.event_member_id and am.status <> 'declined')
group by o.id, o.event_id, o.date, r.invited, r.responded;

-- «Kan ikke denne gangen» before a date is set: tell the organizer. (After a date is set, the
-- existing «kan ikke likevel» notice covers it; locking a date updates the event first, so the
-- people it marks as declined don't trigger this.)
create or replace function public.notify_organizer_on_early_decline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_name text;
begin
  select * into v_event from events where id = new.event_id;
  if v_event.status not in ('polling', 'draft') or new.role <> 'guest' or new.user_id is not distinct from v_event.organizer_id then
    return new;
  end if;
  v_name := split_part(coalesce(nullif((select display_name from profiles where id = new.user_id), ''), nullif(new.display_name, ''), 'En gjest'), ' ', 1);
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  values (v_event.organizer_id, 'response_received', v_event.id, new.user_id,
          v_name || ' kan ikke denne gangen', v_event.title,
          jsonb_build_object('kind', 'declined', 'url', '/event/' || v_event.id));
  return new;
end $$;
create trigger event_members_early_decline_notify after update of status on public.event_members
  for each row when (new.status = 'declined' and old.status is distinct from 'declined')
  execute function public.notify_organizer_on_early_decline();
revoke all on function public.notify_organizer_on_early_decline() from public, anon, authenticated;
