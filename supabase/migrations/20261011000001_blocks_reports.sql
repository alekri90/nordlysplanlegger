-- Nordlys Planlegger — blocking and reporting (App Store guideline 1.2)
--
-- Block: the two people stop seeing each other's profile, can't send friend requests or add each
-- other to groups and events, and any friendship between them ends. Only the blocker knows.
-- Report: a person, an event or a group, with a reason. Reports are read by the owner in the
-- Supabase dashboard (table content_reports) and handled within 24 hours.

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;
create policy user_blocks_select on public.user_blocks for select using (blocker_id = auth.uid());

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'handled')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(target_user_id, event_id, group_id) >= 1)
);
create index content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';
-- No policies: written through report_content(), read in the dashboard.
alter table public.content_reports enable row level security;

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a));
$$;

create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot_block_self' using errcode = '22023'; end if;
  insert into user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from friendships
  where least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
end $$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

create or replace function public.list_blocked()
returns table (id uuid, display_name text, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_url
  from user_blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create or replace function public.report_content(
  p_reason text,
  p_details text default null,
  p_user uuid default null,
  p_event uuid default null,
  p_group uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  insert into content_reports (reporter_id, target_user_id, event_id, group_id, reason, details)
  values (auth.uid(), p_user, p_event, p_group, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Blocked people can't send each other friend requests.
create or replace function public.friendships_block_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_blocked_between(new.requester_id, new.addressee_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger friendships_block_guard before insert on public.friendships
  for each row execute function public.friendships_block_guard();

-- Profiles: same as 20261007, plus blocks in either direction hide the profile.
create or replace function public.can_view_profile(p_target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_disc public.discoverability;
begin
  if auth.uid() is null then return false; end if;
  select discoverability into v_disc from profiles where id = p_target;
  if v_disc is null then return false; end if;
  if p_target = auth.uid() then return true; end if;
  if is_blocked_between(auth.uid(), p_target) then return false; end if;
  if shares_context_with(p_target) then return true; end if;
  if exists (select 1 from friendships f
             where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_target)
               and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_target)
               and f.status in ('accepted', 'pending')) then
    return true;
  end if;
  if v_disc = 'everyone' then return true; end if;
  if v_disc = 'friends_of_friends' then return mutual_friend_count(auth.uid(), p_target) > 0; end if;
  return false;
end $$;

/** You may add someone you're friends with or already plan things with — never a stranger, never someone blocked. */
create or replace function public.can_add_person(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()
      or (not is_blocked_between(auth.uid(), p_user) and (is_friend(auth.uid(), p_user) or shares_context_with(p_user)));
$$;

create or replace function public.list_recent_people(p_limit int default 30)
returns table (id uuid, display_name text, username text, avatar_url text, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_url, max(x.at)
  from (
    select b.user_id as uid, e.created_at as at from event_members a
      join event_members b on b.event_id = a.event_id
      join events e on e.id = a.event_id
     where a.user_id = auth.uid() and b.user_id is not null
    union all
    select b.user_id, g.last_activity_at from group_members a
      join group_members b on b.group_id = a.group_id
      join groups g on g.id = a.group_id
     where a.user_id = auth.uid() and b.user_id is not null
  ) x
  join profiles p on p.id = x.uid
  where p.id <> auth.uid() and not is_blocked_between(auth.uid(), p.id)
  group by p.id
  order by max(x.at) desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friendships_block_guard() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.block_user(uuid)', 'public.unblock_user(uuid)', 'public.list_blocked()',
    'public.report_content(text, text, uuid, uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
