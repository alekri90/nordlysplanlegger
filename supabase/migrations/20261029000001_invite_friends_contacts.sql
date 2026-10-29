-- Invite friends to an event that already exists, and find friends from the phone's contacts.

-- ---------------------------------------------------------------------------
-- Add people with an account to an existing event (organizer and co-hosts)
-- ---------------------------------------------------------------------------
create or replace function public.add_event_members(p_event_id uuid, p_user_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event events%rowtype;
  v_name text;
  v_user uuid;
  v_added int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not is_event_organizer(p_event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  select * into v_event from events where id = p_event_id;
  if v_event.status in ('cancelled', 'completed') then raise exception 'event_closed'; end if;

  select display_name into v_name from profiles where id = v_uid;

  for v_user in select distinct x from unnest(coalesce(p_user_ids, '{}')) x where x is not null and x <> v_uid limit 200 loop
    -- Friends and people you already plan with, never a stranger or someone blocked.
    continue when not can_add_person(v_user);
    continue when exists (select 1 from event_members m where m.event_id = p_event_id and m.user_id = v_user);
    insert into event_members (event_id, user_id, display_name, invited_via)
    select p_event_id, p.id, p.display_name, 'app' from profiles p where p.id = v_user
    on conflict do nothing;
    if found then
      v_added := v_added + 1;
      insert into notifications (user_id, type, event_id, actor_id, title, data)
      values (v_user, 'invited', p_event_id, v_uid,
              split_part(coalesce(v_name, 'Noen'), ' ', 1) || ' inviterte deg til ' || v_event.title,
              jsonb_build_object('url', '/event/' || p_event_id));
    end if;
  end loop;

  return v_added;
end $$;

revoke all on function public.add_event_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_event_members(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Phone number: private, only used so people who have it can find you
-- ---------------------------------------------------------------------------
create table if not exists public.profile_phones (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- E.164, e.g. +4791234567. Not unique: it isn't verified, so nobody can block someone else's number.
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  discoverable boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists profile_phones_phone_idx on public.profile_phones (phone) where discoverable;

alter table public.profile_phones enable row level security;
drop policy if exists profile_phones_own on public.profile_phones;
create policy profile_phones_own on public.profile_phones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

/**
 * Which of these numbers belong to someone in the app? The numbers are only compared here, never stored.
 * Returns the same shape as search_people, never the number itself.
 */
create or replace function public.match_contacts(p_phones text[])
returns table (id uuid, display_name text, username text, avatar_url text, friendship text, mutual_friends int, mutual_groups int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return query
  select distinct on (p.id) p.id, p.display_name, p.username, p.avatar_url,
         friendship_state(p.id), mutual_friend_count(auth.uid(), p.id), mutual_group_count(auth.uid(), p.id)
  from profile_phones pp
  join profiles p on p.id = pp.user_id
  where pp.discoverable
    and pp.phone = any (p_phones[1:3000])
    and p.id <> auth.uid()
    and not is_blocked_between(auth.uid(), p.id)
  order by p.id
  limit 300;
end $$;

revoke all on function public.match_contacts(text[]) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;
