-- Nordlys Planlegger — social graph
-- Usernames, friendships, discoverability, group roles, guest participants with personal
-- invite links, and secure linking of guest history to a new account.
--
-- Principle: the social graph only reduces friction. Nothing here is required to answer an invitation.
-- All authorization is enforced here (RLS + security definer RPCs), never in the client.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles: username, bio, discoverability
-- Note: profiles.id IS the auth user id (1:1 with auth.users), so no separate user_id column.
-- ---------------------------------------------------------------------------
create type public.discoverability as enum ('everyone', 'friends_of_friends', 'nobody');

alter table public.profiles
  add column username text,
  add column username_normalized text,
  add column bio text check (bio is null or char_length(bio) <= 160),
  add column discoverability public.discoverability not null default 'everyone',
  add column onboarded_at timestamptz;

-- Reserved names. `prefix = true` also blocks names starting with it (admin_team, support2 …).
create table public.reserved_usernames (
  name text primary key,
  prefix boolean not null default false
);
insert into public.reserved_usernames (name, prefix) values
  ('admin', true), ('support', true), ('moderator', true), ('official', true), ('system', true),
  ('nordlys', true), ('planlegger', true), ('help', false), ('wen', false), ('web', false), ('www', false), ('api', false),
  ('app', false), ('root', false), ('staff', false), ('team', false), ('security', false), ('settings', false),
  ('login', false), ('signup', false), ('privacy', false), ('terms', false), ('about', false), ('me', false),
  ('null', false), ('undefined', false), ('everyone', false), ('anonymous', false), ('gjest', false), ('guest', false);

-- Substring blocklist for obviously problematic names. Extend from a maintained list in production.
create table public.blocked_username_terms (term text primary key);
insert into public.blocked_username_terms (term) values
  ('fuck'), ('shit'), ('cunt'), ('nazi'), ('hitler'), ('porn'), ('fitte'), ('faen');

alter table public.reserved_usernames enable row level security;
alter table public.blocked_username_terms enable row level security;
-- No policies: only readable by security definer functions.

/** "@Alex.K " → "alex.k" */
create or replace function public.normalize_username(p text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(btrim(coalesce(p, '')), '^@+', '')));
$$;

/** null when ok, otherwise a reason code. Rules: 3–24 chars, a–z 0–9 _ . ; no leading/trailing/double dots. */
create or replace function public.username_problem(p_norm text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if p_norm is null or char_length(p_norm) < 3 then return 'too_short'; end if;
  if char_length(p_norm) > 24 then return 'too_long'; end if;
  if p_norm !~ '^[a-z0-9_.]+$' then return 'invalid_chars'; end if;
  if p_norm ~ '^\.' or p_norm ~ '\.$' or p_norm ~ '\.\.' then return 'invalid_dots'; end if;
  if exists (select 1 from reserved_usernames r where r.name = p_norm or (r.prefix and p_norm like r.name || '%')) then
    return 'reserved';
  end if;
  if exists (select 1 from blocked_username_terms b where position(b.term in p_norm) > 0) then return 'blocked'; end if;
  return null;
end $$;

/** Turns any text (a name, an e-mail prefix) into a username-shaped slug. */
create or replace function public.slugify_username(p text)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(
    replace(replace(replace(replace(replace(lower(coalesce(p, '')), 'æ', 'ae'), 'ø', 'o'), 'å', 'a'), 'ä', 'a'), 'ö', 'o'),
    '[^a-z0-9_.]+', '', 'g'), '\.{2,}', '.', 'g'), '.'), 20);
$$;

create or replace function public.username_taken(p_norm text, p_except uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where username_normalized = p_norm and id is distinct from p_except);
$$;

/** A free, valid username derived from `p_base`. */
create or replace function public.generate_username(p_base text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_base text := slugify_username(p_base);
  v_try text;
  i int := 0;
begin
  if char_length(v_base) < 3 then v_base := v_base || 'venn'; end if;
  v_try := v_base;
  while username_problem(v_try) is not null or username_taken(v_try) loop
    i := i + 1;
    v_try := case when i < 25 then left(v_base, 20) || (10 + floor(random() * 990))::int
                  else 'venn' || floor(random() * 1000000)::int end;
  end loop;
  return v_try;
end $$;

/** Keeps username_normalized in sync and validates it — never trust the client. */
create or replace function public.profiles_username_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_problem text;
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    new.username_normalized := old.username_normalized;
    return new;
  end if;
  new.username := btrim(regexp_replace(btrim(coalesce(new.username, '')), '^@+', ''));
  new.username_normalized := normalize_username(new.username);
  v_problem := username_problem(new.username_normalized);
  if v_problem is not null then
    raise exception 'username_%', v_problem using errcode = '23514';
  end if;
  return new;
end $$;

create trigger profiles_username_guard before insert or update of username on public.profiles
  for each row execute function public.profiles_username_guard();

-- Backfill any existing rows, then enforce.
update public.profiles set username = public.generate_username(coalesce(nullif(display_name, ''), 'venn')) where username is null;
alter table public.profiles alter column username set not null, alter column username_normalized set not null;
alter table public.profiles add constraint profiles_username_normalized_key unique (username_normalized);
create index profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- New auth user → profile with a generated (editable) username.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );
  v_typed text := btrim(regexp_replace(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), '^@+', ''));
  v_wanted text := normalize_username(v_typed);
  v_username text;
begin
  if v_wanted <> '' and username_problem(v_wanted) is null and not username_taken(v_wanted) then
    v_username := v_typed;  -- keep their casing for display; uniqueness uses the normalized column
  else
    v_username := generate_username(coalesce(nullif(v_name, ''), 'venn'));
  end if;

  insert into public.profiles (id, display_name, username, avatar_url, onboarded_at)
  values (
    new.id,
    left(v_name, 60),
    v_username,
    new.raw_user_meta_data ->> 'avatar_url',
    -- Chose their username on the sign-up screen → no extra onboarding step.
    case when v_wanted <> '' and v_username = v_typed then now() end
  );
  insert into public.subscriptions (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Friendships (mutual; no followers)
-- ---------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted', 'declined');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
-- One row per pair, regardless of direction.
create unique index friendships_pair_uq on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);
create trigger friendships_touch before update on public.friendships
  for each row execute function public.touch_updated_at();

alter table public.friendships enable row level security;
create policy friendships_select on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
-- Unfriend / cancel a request. Creating and answering go through RPCs below.
create policy friendships_delete on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

create or replace function public.friend_ids(p_user uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when requester_id = p_user then addressee_id else requester_id end
  from friendships
  where status = 'accepted' and p_user in (requester_id, addressee_id);
$$;

create or replace function public.is_friend(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = p_a and addressee_id = p_b) or (requester_id = p_b and addressee_id = p_a))
  );
$$;

create or replace function public.mutual_friend_count(p_a uuid, p_b uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from friend_ids(p_a) f where f in (select friend_ids(p_b));
$$;

create or replace function public.mutual_group_count(p_a uuid, p_b uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from group_members a join group_members b on b.group_id = a.group_id
  where a.user_id = p_a and b.user_id = p_b;
$$;

/**
 * Who may see a profile (avatar, display name, username — never e-mail or phone):
 * yourself, friends, people you plan with, and otherwise according to their discoverability.
 */
create or replace function public.can_view_profile(p_target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_disc public.discoverability;
begin
  select discoverability into v_disc from profiles where id = p_target;
  if v_disc is null then return false; end if;
  if auth.uid() is null then return v_disc = 'everyone'; end if;
  if p_target = auth.uid() or shares_context_with(p_target) then return true; end if;
  -- Friends, and anyone with a pending request between you (so you can see who asked).
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

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (public.can_view_profile(id));

/** Friendship as seen from the current user. */
create or replace function public.friendship_state(p_other uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_other = auth.uid() then 'self'
    when f.id is null then 'none'
    when f.status = 'accepted' then 'friends'
    when f.requester_id = auth.uid() then 'outgoing'      -- a declined request still looks pending to the sender
    when f.status = 'pending' then 'incoming'
    else 'none'
  end
  from (select 1) x
  left join friendships f
    on least(f.requester_id, f.addressee_id) = least(auth.uid(), p_other)
   and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_other);
$$;

/** A short, human reason you know someone: "Dere var sammen på Poker hos Thomas" / "Dere er begge i Poker". */
create or replace function public.shared_context_label(p_other uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'Dere var sammen på ' || e.title from event_members a
       join event_members b on b.event_id = a.event_id
       join events e on e.id = a.event_id
      where a.user_id = auth.uid() and b.user_id = p_other and e.status <> 'cancelled'
      order by coalesce(e.selected_date, e.created_at::date) desc limit 1),
    (select 'Dere er begge i ' || g.name from group_members a
       join group_members b on b.group_id = a.group_id
       join groups g on g.id = a.group_id
      where a.user_id = auth.uid() and b.user_id = p_other
      order by g.last_activity_at desc limit 1)
  );
$$;

create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row friendships;
  v_name text;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user = v_me then raise exception 'cannot_friend_self' using errcode = '22023'; end if;
  if not can_view_profile(p_user) then raise exception 'profile_not_found' using errcode = 'P0002'; end if;

  select * into v_row from friendships
  where least(requester_id, addressee_id) = least(v_me, p_user)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_user)
  for update;

  if found then
    if v_row.status = 'accepted' then return 'friends'; end if;
    if v_row.addressee_id = v_me then
      -- They asked first (or I ignored them earlier): sending a request back means yes.
      update friendships set status = 'accepted' where id = v_row.id;
      select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
      insert into notifications (user_id, type, actor_id, title, data)
      values (p_user, 'friend_accepted', v_me, coalesce(v_name, 'Noen') || ' og du er nå venner',
              jsonb_build_object('url', '/@' || (select username from profiles where id = v_me)));
      return 'friends';
    end if;
    return 'outgoing';
  end if;

  insert into friendships (requester_id, addressee_id) values (v_me, p_user);
  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (user_id, type, actor_id, title, body, data)
  values (p_user, 'friend_request', v_me, coalesce(v_name, 'Noen') || ' vil legge deg til som venn',
          shared_context_label(p_user),
          jsonb_build_object('url', '/friends/requests'));
  return 'outgoing';
end $$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_row friendships;
  v_name text;
begin
  select * into v_row from friendships where id = p_request_id and addressee_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  update friendships set status = case when p_accept then 'accepted' else 'declined' end::public.friendship_status where id = v_row.id;
  if p_accept then
    select split_part(display_name, ' ', 1) into v_name from profiles where id = auth.uid();
    insert into notifications (user_id, type, actor_id, title, data)
    values (v_row.requester_id, 'friend_accepted', auth.uid(), coalesce(v_name, 'Noen') || ' godtok venneforespørselen din',
            jsonb_build_object('url', '/@' || (select username from profiles where id = auth.uid())));
    return 'friends';
  end if;
  return 'none';
end $$;

create or replace function public.remove_friend(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships
  where least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
$$;

-- ---------------------------------------------------------------------------
-- Finding people
-- ---------------------------------------------------------------------------
create or replace function public.search_people(p_query text, p_limit int default 20)
returns table (id uuid, display_name text, username text, avatar_url text, friendship text, mutual_friends int, mutual_groups int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_user_only boolean := v_q like '@%';
  v_norm text := normalize_username(v_q);
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_norm) < 2 then return; end if;
  return query
  select p.id, p.display_name, p.username, p.avatar_url,
         friendship_state(p.id), mutual_friend_count(auth.uid(), p.id), mutual_group_count(auth.uid(), p.id)
  from profiles p
  where p.id <> auth.uid()
    and (p.username_normalized like v_norm || '%' or (not v_user_only and p.display_name ilike '%' || v_q || '%'))
    and can_view_profile(p.id)
  order by (p.username_normalized = v_norm) desc,
           is_friend(auth.uid(), p.id) desc,
           mutual_friend_count(auth.uid(), p.id) desc,
           similarity(p.display_name, v_q) desc,
           p.display_name
  limit least(greatest(p_limit, 1), 30);
end $$;

/** Discreet suggestions from your own history in the app. No address book upload. */
create or replace function public.people_you_may_know(p_limit int default 10)
returns table (id uuid, display_name text, username text, avatar_url text, context text, mutual_friends int)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  candidates as (
    select b.user_id as uid, 3 as score from event_members a
      join event_members b on b.event_id = a.event_id, me
     where a.user_id = me.uid and b.user_id is not null and b.user_id <> me.uid
    union all
    select b.user_id, 2 from group_members a
      join group_members b on b.group_id = a.group_id, me
     where a.user_id = me.uid and b.user_id is not null and b.user_id <> me.uid
    union all
    select fof, 1 from me, friend_ids(me.uid) f, friend_ids(f) fof where fof <> me.uid
  ),
  ranked as (select uid, sum(score) as score from candidates group by uid)
  select p.id, p.display_name, p.username, p.avatar_url,
         coalesce(shared_context_label(p.id),
                  mutual_friend_count(auth.uid(), p.id) || ' felles venner'),
         mutual_friend_count(auth.uid(), p.id)
  from ranked r
  join profiles p on p.id = r.uid
  where not exists (
    select 1 from friendships f
    where least(f.requester_id, f.addressee_id) = least(auth.uid(), p.id)
      and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p.id)
  )
    and can_view_profile(p.id)
  order by r.score desc, p.display_name
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.list_friends()
returns table (id uuid, display_name text, username text, avatar_url text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_url, f.updated_at
  from friendships f
  join profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  order by lower(p.display_name);
$$;

create or replace function public.list_friend_requests()
returns table (request_id uuid, id uuid, display_name text, username text, avatar_url text, context text, mutual_friends int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.display_name, p.username, p.avatar_url,
         shared_context_label(p.id), mutual_friend_count(auth.uid(), p.id), f.created_at
  from friendships f
  join profiles p on p.id = f.requester_id
  where f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

/** Recently planned-with people (for "Nylig" in pickers). Replaces reading all visible profiles. */
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
  where p.id <> auth.uid()
  group by p.id
  order by max(x.at) desc
  limit least(greatest(p_limit, 1), 100);
$$;

/** Public profile for /@username or a tapped avatar. Returns null when not visible. */
create or replace function public.get_public_profile(p_username text default null, p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_p profiles;
  v_me uuid := auth.uid();
begin
  if p_user is not null then
    select * into v_p from profiles where id = p_user;
  else
    select * into v_p from profiles where username_normalized = normalize_username(p_username);
  end if;
  if v_p.id is null or not can_view_profile(v_p.id) then return null; end if;

  return jsonb_build_object(
    'id', v_p.id,
    'display_name', v_p.display_name,
    'username', v_p.username,
    'avatar_url', v_p.avatar_url,
    'bio', v_p.bio,
    'friendship', case when v_me is null then 'anonymous' else friendship_state(v_p.id) end,
    'request_id', (select f.id from friendships f where f.requester_id = v_p.id and f.addressee_id = v_me and f.status = 'pending'),
    'context', case when v_me is null then null else shared_context_label(v_p.id) end,
    'friend_count', case when v_p.id = v_me then (select count(*) from friend_ids(v_me)) end,
    'group_count', case when v_p.id = v_me then (select count(*) from group_members where user_id = v_me) end,
    'mutual_friends', case when v_me is null or v_p.id = v_me then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.display_name, 'avatar_url', q.avatar_url))
      from (select p.id, p.display_name, p.avatar_url from profiles p
            where p.id in (select friend_ids(v_me)) and p.id in (select friend_ids(v_p.id))
            order by p.display_name limit 8) q), '[]'::jsonb) end,
    'mutual_friend_count', case when v_me is null then 0 else mutual_friend_count(v_me, v_p.id) end,
    -- Only groups the viewer is in too — never someone's private groups.
    'mutual_groups', case when v_me is null or v_p.id = v_me then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'emoji', g.emoji, 'image_url', g.image_url))
      from groups g
      where exists (select 1 from group_members m where m.group_id = g.id and m.user_id = v_me)
        and exists (select 1 from group_members m where m.group_id = g.id and m.user_id = v_p.id)), '[]'::jsonb) end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Usernames: live availability with suggestions (also before sign-up)
-- ---------------------------------------------------------------------------
create or replace function public.check_username(p_username text, p_display_name text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_norm text := normalize_username(p_username);
  v_problem text := username_problem(v_norm);
  v_taken boolean := v_problem is null and username_taken(v_norm, auth.uid());
  v_words text[] := regexp_split_to_array(btrim(coalesce(p_display_name, '')), '\s+');
  v_first text := slugify_username(v_words[1]);
  v_last text := slugify_username(v_words[array_length(v_words, 1)]);
  v_base text := coalesce(nullif(regexp_replace(v_norm, '[^a-z0-9_.]', '', 'g'), ''), v_first);
  v_candidates text[];
  v_out text[] := '{}';
  c text;
begin
  if v_problem is null and not v_taken then
    return jsonb_build_object('normalized', v_norm, 'available', true, 'reason', null, 'suggestions', '[]'::jsonb);
  end if;
  if v_last = v_first then v_last := ''; end if;
  v_candidates := array[
    v_base || left(v_last, 1),
    left(v_first, 4) || left(v_last, 1),
    v_base || (10 + floor(random() * 89))::int,
    v_first || '.' || v_last,
    v_base || '_',
    v_first || left(v_last, 3),
    v_base || (100 + floor(random() * 899))::int
  ];
  foreach c in array v_candidates loop
    c := left(slugify_username(c), 24);
    if username_problem(c) is null and not username_taken(c) and not (c = any (v_out)) and c <> v_norm then
      v_out := v_out || c;
    end if;
    exit when array_length(v_out, 1) >= 3;
  end loop;
  return jsonb_build_object('normalized', v_norm, 'available', false,
                            'reason', coalesce(v_problem, 'taken'), 'suggestions', to_jsonb(v_out));
end $$;

-- ---------------------------------------------------------------------------
-- Groups: roles, activity, membership management (guests allowed)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = p_group_id and g.created_by = auth.uid())
      or exists (select 1 from group_members m where m.group_id = p_group_id and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

/** You may add someone you're friends with or already plan things with — never a stranger by id. */
create or replace function public.can_add_person(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or is_friend(auth.uid(), p_user) or shares_context_with(p_user);
$$;

/** Guests you know: someone in an event or group you're part of. */
create or replace function public.can_add_guest(p_guest uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_members m where m.guest_id = p_guest and is_event_member(m.event_id))
      or exists (select 1 from group_members m where m.guest_id = p_guest and is_group_member(m.group_id));
$$;

-- Only admins edit the group itself; members are managed through RPCs.
drop policy groups_update on public.groups;
create policy groups_update on public.groups for update
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
drop policy group_members_insert on public.group_members;
drop policy group_members_delete on public.group_members;

create or replace function public.touch_group_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update groups set last_activity_at = now() where id = new.group_id;
  return new;
end $$;
create trigger events_group_activity after insert or update of status on public.events
  for each row when (new.group_id is not null) execute function public.touch_group_activity();
create trigger group_members_activity after insert on public.group_members
  for each row execute function public.touch_group_activity();

/** Adds people to a group. Any member may add; returns number added. */
create or replace function public.add_group_members(
  p_group_id uuid,
  p_user_ids uuid[] default '{}',
  p_guest_ids uuid[] default '{}',
  p_guest_names text[] default '{}'
) returns int language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_count int := 0;
  v_n int;
  v_id uuid;
  v_name text;
  v_group text;
  v_actor text;
begin
  if not is_group_member(p_group_id) then raise exception 'not_group_member' using errcode = '42501'; end if;
  select name into v_group from groups where id = p_group_id;
  select split_part(display_name, ' ', 1) into v_actor from profiles where id = v_me;

  foreach v_id in array coalesce(p_user_ids, '{}') loop
    continue when v_id = v_me or not can_add_person(v_id);
    insert into group_members (group_id, user_id, display_name)
    select p_group_id, p.id, p.display_name from profiles p where p.id = v_id
    on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_count := v_count + 1;
      insert into notifications (user_id, type, group_id, actor_id, title, data)
      values (v_id, 'group_added', p_group_id, v_me, coalesce(v_actor, 'Noen') || ' la deg til i ' || v_group,
              jsonb_build_object('url', '/group/' || p_group_id));
    end if;
  end loop;

  foreach v_id in array coalesce(p_guest_ids, '{}') loop
    continue when not can_add_guest(v_id);
    insert into group_members (group_id, guest_id, display_name)
    select p_group_id, g.id, g.display_name from guest_profiles g where g.id = v_id and g.claimed_by_user_id is null
    on conflict do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;

  -- People without an account yet: guest members, invited via personal links later.
  foreach v_name in array coalesce(p_guest_names, '{}') loop
    v_name := left(btrim(v_name), 60);
    continue when v_name = '';
    insert into guest_profiles (display_name) values (v_name) returning id into v_id;
    insert into group_members (group_id, guest_id, display_name) values (p_group_id, v_id, v_name);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

create or replace function public.create_group(
  p_name text,
  p_emoji text default null,
  p_image_url text default null,
  p_description text default null,
  p_user_ids uuid[] default '{}',
  p_guest_ids uuid[] default '{}',
  p_guest_names text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  insert into groups (name, emoji, image_url, description, created_by)
  values (btrim(p_name), nullif(p_emoji, ''), p_image_url, nullif(btrim(coalesce(p_description, '')), ''), v_me)
  returning id into v_id;
  insert into group_members (group_id, user_id, display_name, role)
  select v_id, v_me, display_name, 'owner' from profiles where id = v_me;
  perform add_group_members(v_id, p_user_ids, p_guest_ids, p_guest_names);
  return v_id;
end $$;

/** Admins remove anyone except the owner; anyone can remove themselves (leave). */
create or replace function public.remove_group_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m group_members;
begin
  select * into v_m from group_members where id = p_member_id;
  if not found then return; end if;
  if v_m.user_id = auth.uid() then
    perform leave_group(v_m.group_id);
    return;
  end if;
  if not is_group_admin(v_m.group_id) or v_m.role = 'owner' then raise exception 'not_group_admin' using errcode = '42501'; end if;
  delete from group_members where id = p_member_id;
end $$;

/** Leave a group. The owner hands over to an admin (or the longest-standing member); last one out deletes it. */
create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was_owner boolean;
  v_next uuid;
begin
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;
  delete from group_members where group_id = p_group_id and user_id = auth.uid()
  returning role = 'owner' into v_was_owner;
  if not exists (select 1 from group_members where group_id = p_group_id and user_id is not null) then
    delete from groups where id = p_group_id;
    return;
  end if;
  if coalesce(v_was_owner, false) or exists (select 1 from groups where id = p_group_id and created_by = auth.uid()) then
    select user_id into v_next from group_members
    where group_id = p_group_id and user_id is not null
    order by (role = 'admin') desc, joined_at asc limit 1;
    update group_members set role = 'owner' where group_id = p_group_id and user_id = v_next;
    update groups set created_by = v_next where id = p_group_id;
  end if;
end $$;

create or replace function public.set_group_member_role(p_member_id uuid, p_role public.group_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m group_members;
begin
  select * into v_m from group_members where id = p_member_id;
  if not found or v_m.user_id is null or p_role = 'owner' or v_m.role = 'owner' then raise exception 'invalid_role_change' using errcode = '22023'; end if;
  if not is_group_admin(v_m.group_id) then raise exception 'not_group_admin' using errcode = '42501'; end if;
  update group_members set role = p_role where id = p_member_id;
end $$;

-- ---------------------------------------------------------------------------
-- Guest participants: personal invite links, and secure claiming
-- A personal link (random 128-bit token, only shared with that person) is the credential.
-- We never link identities by name.
-- ---------------------------------------------------------------------------
alter table public.event_invites add column guest_profile_id uuid references public.guest_profiles (id) on delete cascade;
create unique index event_invites_personal_uq on public.event_invites (event_id, guest_profile_id) where guest_profile_id is not null;
-- The personal invite a guest first arrived through (traceability for claims).
alter table public.guest_profiles add column invite_token text;

/** Ensure a guest is on an event, with a personal invite link. Returns the token. */
create or replace function public.ensure_guest_invite(p_event_id uuid, p_guest_id uuid, p_created_by uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  insert into event_members (event_id, guest_id, display_name, invited_via)
  select p_event_id, g.id, g.display_name, 'group' from guest_profiles g where g.id = p_guest_id
  on conflict do nothing;
  select token into v_token from event_invites where event_id = p_event_id and guest_profile_id = p_guest_id and revoked_at is null;
  if v_token is null then
    insert into event_invites (event_id, created_by, guest_profile_id, channel)
    values (p_event_id, p_created_by, p_guest_id, 'personal') returning token into v_token;
  end if;
  update guest_profiles set invite_token = coalesce(invite_token, v_token) where id = p_guest_id;
  return v_token;
end $$;

/** Organizer adds people without an account, by name. Returns their personal links. */
create or replace function public.add_event_guests(p_event_id uuid, p_guest_ids uuid[] default '{}', p_names text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_id uuid;
  v_name text;
begin
  if not is_event_organizer(p_event_id) then raise exception 'not_organizer' using errcode = '42501'; end if;
  foreach v_id in array coalesce(p_guest_ids, '{}') loop
    continue when not can_add_guest(v_id);
    v_out := v_out || jsonb_build_object('guest_id', v_id, 'name', (select display_name from guest_profiles where id = v_id),
                                         'token', ensure_guest_invite(p_event_id, v_id, auth.uid()));
  end loop;
  foreach v_name in array coalesce(p_names, '{}') loop
    v_name := left(btrim(v_name), 60);
    continue when v_name = '';
    insert into guest_profiles (display_name) values (v_name) returning id into v_id;
    v_out := v_out || jsonb_build_object('guest_id', v_id, 'name', v_name, 'token', ensure_guest_invite(p_event_id, v_id, auth.uid()));
  end loop;
  return v_out;
end $$;

/** Moves everything a guest did to a user account. Internal: callers must have verified identity. */
create or replace function public.merge_guest_into_user(p_guest_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_events int;
  v_groups int;
begin
  update guest_profiles set claimed_by_user_id = p_user_id, claimed_at = now(), secret_hash = null
  where id = p_guest_id and claimed_by_user_id is null;
  if not found then return jsonb_build_object('events', 0, 'groups', 0); end if;

  -- Where the user already is a member, keep the user's row and drop the guest duplicate.
  delete from event_members m where m.guest_id = p_guest_id
    and exists (select 1 from event_members x where x.event_id = m.event_id and x.user_id = p_user_id);
  update event_members set user_id = p_user_id, guest_id = null where guest_id = p_guest_id;
  get diagnostics v_events = row_count;

  delete from group_members m where m.guest_id = p_guest_id
    and exists (select 1 from group_members x where x.group_id = m.group_id and x.user_id = p_user_id);
  update group_members set user_id = p_user_id, guest_id = null where guest_id = p_guest_id;
  get diagnostics v_groups = row_count;

  return jsonb_build_object('events', v_events, 'groups', v_groups);
end $$;

-- Return type changes from int (initial schema) to jsonb.
drop function if exists public.claim_guest_identity(text);

/** Claim via the secret stored on the device that answered as a guest. */
create or replace function public.claim_guest_identity(p_guest_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_guest uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select id into v_guest from guest_profiles
  where secret_hash = encode(digest(p_guest_secret, 'sha256'), 'hex') and claimed_by_user_id is null;
  if v_guest is null then return jsonb_build_object('events', 0, 'groups', 0); end if;
  return merge_guest_into_user(v_guest, auth.uid());
end $$;

/** Claim via a personal invite link ("Dette er meg"), used when signing up from that link. */
create or replace function public.claim_guest_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guest uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select i.guest_profile_id into v_guest from event_invites i
  join guest_profiles g on g.id = i.guest_profile_id
  where i.token = p_token and i.revoked_at is null and g.claimed_by_user_id is null;
  if v_guest is null then return jsonb_build_object('events', 0, 'groups', 0); end if;
  return merge_guest_into_user(v_guest, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Invitations, updated for personal links
-- ---------------------------------------------------------------------------
create or replace function public.get_invite(p_token text, p_guest_secret text default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_invite event_invites;
  v_event events;
  v_guest_id uuid;
  v_member event_members;
begin
  select * into v_invite from event_invites
  where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  select * into v_event from events where id = v_invite.event_id;
  if v_event.status = 'cancelled' then return jsonb_build_object('cancelled', true, 'title', v_event.title); end if;

  if auth.uid() is not null then
    select * into v_member from event_members where event_id = v_event.id and user_id = auth.uid();
  end if;
  if v_member.id is null and v_invite.guest_profile_id is not null then
    -- Personal link: this is that guest.
    select * into v_member from event_members where event_id = v_event.id and guest_id = v_invite.guest_profile_id;
  elsif v_member.id is null and p_guest_secret is not null then
    select id into v_guest_id from guest_profiles where secret_hash = encode(digest(p_guest_secret, 'sha256'), 'hex');
    select * into v_member from event_members where event_id = v_event.id and guest_id = v_guest_id;
  end if;

  return jsonb_build_object(
    'token', p_token,
    'personal', v_invite.guest_profile_id is not null,
    'claimable', v_invite.guest_profile_id is not null
                 and exists (select 1 from guest_profiles g where g.id = v_invite.guest_profile_id and g.claimed_by_user_id is null),
    'event', jsonb_build_object(
      'id', v_event.id, 'title', v_event.title, 'category', v_event.category,
      'cover_image_url', v_event.cover_image_url, 'status', v_event.status,
      'date_mode', v_event.date_mode, 'period_label', v_event.period_label,
      'time_hint', v_event.time_hint, 'start_time', v_event.start_time,
      'selected_date', v_event.selected_date, 'description', v_event.description, 'group_id', v_event.group_id,
      'location', (select jsonb_build_object('name', l.name, 'address', l.address, 'details_pending', l.details_pending)
                   from event_locations l where l.event_id = v_event.id),
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'date', o.date) order by o.date)
                           from event_date_options o where o.event_id = v_event.id), '[]'::jsonb)
    ),
    'organizer', (select jsonb_build_object('id', p.id, 'name', split_part(p.display_name, ' ', 1), 'username', p.username, 'avatar_url', p.avatar_url)
                  from profiles p where p.id = v_event.organizer_id),
    'invited_count', (select count(*) from event_members m where m.event_id = v_event.id),
    'respondents', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', split_part(coalesce(nullif(p.display_name, ''), m.display_name), ' ', 1), 'avatar_url', p.avatar_url))
      from event_members m left join profiles p on p.id = m.user_id
      where m.event_id = v_event.id and m.status in ('responded', 'attending')
    ), '[]'::jsonb),
    'my_response', case when v_member.id is null then null else jsonb_build_object(
      'member_id', v_member.id,
      'name', v_member.display_name,
      'status', v_member.status,
      'unavailable_option_ids', coalesce((select jsonb_agg(a.date_option_id) from event_availability a
                                          where a.event_member_id = v_member.id and a.status = 'unavailable'), '[]'::jsonb)
    ) end
  );
end $$;

/** Resolve (or create) the guest answering through this invite, rotating the device secret. */
create or replace function public.resolve_guest_for_invite(v_invite event_invites, p_name text, p_guest_secret text)
returns table (guest_id uuid, secret text) language plpgsql security definer set search_path = public, extensions as $$
declare
  v_guest uuid;
  v_secret text := p_guest_secret;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_invite.guest_profile_id is not null then
    -- The personal link is the credential. Issue a fresh device secret for later edits/claims.
    v_guest := v_invite.guest_profile_id;
    if exists (select 1 from guest_profiles g where g.id = v_guest and g.claimed_by_user_id is not null) then
      raise exception 'guest_claimed' using errcode = '42501';
    end if;
    v_secret := encode(gen_random_bytes(24), 'hex');
    update guest_profiles set secret_hash = encode(digest(v_secret, 'sha256'), 'hex'),
                              display_name = coalesce(nullif(v_name, ''), display_name)
    where id = v_guest;
  else
    if v_secret is not null then
      select id into v_guest from guest_profiles
      where secret_hash = encode(digest(v_secret, 'sha256'), 'hex') and claimed_by_user_id is null;
    end if;
    if v_guest is null then
      if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
      v_secret := encode(gen_random_bytes(24), 'hex');
      insert into guest_profiles (display_name, secret_hash, invite_token)
      values (v_name, encode(digest(v_secret, 'sha256'), 'hex'), v_invite.token)
      returning id into v_guest;
    elsif v_name <> '' then
      update guest_profiles set display_name = v_name where id = v_guest;
    end if;
  end if;
  return query select v_guest, v_secret;
end $$;

create or replace function public.submit_guest_response(
  p_token text,
  p_name text,
  p_unavailable_option_ids uuid[],
  p_guest_secret text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite event_invites;
  v_event events;
  v_uid uuid := auth.uid();
  v_guest uuid;
  v_secret text;
  v_member_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_pending int;
  v_total int;
begin
  select * into v_invite from event_invites
  where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  select * into v_event from events where id = v_invite.event_id;
  if v_event.status not in ('polling', 'draft') then raise exception 'poll_closed' using errcode = 'P0001'; end if;

  if v_uid is not null then
    if v_name = '' then select display_name into v_name from profiles where id = v_uid; end if;
    -- Signed in on a personal link that is still a guest seat: that seat is this user.
    if v_invite.guest_profile_id is not null then perform merge_guest_into_user(v_invite.guest_profile_id, v_uid); end if;
    insert into event_members (event_id, user_id, display_name, invited_via)
    values (v_event.id, v_uid, v_name, 'link')
    on conflict (event_id, user_id) where user_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  else
    select r.guest_id, r.secret into v_guest, v_secret from resolve_guest_for_invite(v_invite, v_name, p_guest_secret) r;
    select coalesce(nullif(v_name, ''), display_name) into v_name from guest_profiles where id = v_guest;
    insert into event_members (event_id, guest_id, display_name, invited_via)
    values (v_event.id, v_guest, v_name, 'link')
    on conflict (event_id, guest_id) where guest_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  end if;

  delete from event_availability where event_member_id = v_member_id;
  insert into event_availability (event_member_id, date_option_id, status)
  select v_member_id, o.id, 'unavailable'
  from event_date_options o
  where o.event_id = v_event.id and o.id = any (coalesce(p_unavailable_option_ids, '{}'));

  update event_members set status = 'responded', responded_at = now() where id = v_member_id;

  insert into guest_responses (event_id, invite_id, guest_id, event_member_id, display_name, unavailable_option_ids)
  values (v_event.id, v_invite.id, v_guest, v_member_id, v_name, coalesce(p_unavailable_option_ids, '{}'));

  select count(*) filter (where status in ('invited', 'opened')), count(*) into v_pending, v_total
  from event_members where event_id = v_event.id;

  insert into notifications (user_id, type, event_id, title, body, data)
  values (v_event.organizer_id, 'response_received', v_event.id,
          split_part(v_name, ' ', 1) || ' har svart på ' || v_event.title,
          case when v_pending = 0 then 'Alle har svart. Se beste dato.' else (v_total - v_pending) || ' av ' || v_total || ' har svart' end,
          jsonb_build_object('url', '/event/' || v_event.id));

  if v_pending = 0 and exists (select 1 from event_date_scores s where s.event_id = v_event.id and s.unavailable = 0) then
    insert into notifications (user_id, type, event_id, title, data)
    select v_event.organizer_id, 'all_can', v_event.id,
           'Alle kan ' || to_char(s.date, 'FMDD.') || ' ' || (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from s.date)::int],
           jsonb_build_object('url', '/event/' || v_event.id)
    from event_date_scores s where s.event_id = v_event.id and s.unavailable = 0
    order by s.date limit 1;
  end if;

  return jsonb_build_object('member_id', v_member_id, 'guest_secret', v_secret);
end $$;

create or replace function public.respond_rsvp(p_token text, p_attending boolean, p_name text default null, p_guest_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite event_invites;
  v_uid uuid := auth.uid();
  v_guest uuid;
  v_secret text;
  v_member_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  select * into v_invite from event_invites where token = p_token and revoked_at is null;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;

  if v_uid is not null then
    if v_name = '' then select display_name into v_name from profiles where id = v_uid; end if;
    if v_invite.guest_profile_id is not null then perform merge_guest_into_user(v_invite.guest_profile_id, v_uid); end if;
    insert into event_members (event_id, user_id, display_name) values (v_invite.event_id, v_uid, v_name)
    on conflict (event_id, user_id) where user_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  else
    select r.guest_id, r.secret into v_guest, v_secret from resolve_guest_for_invite(v_invite, v_name, p_guest_secret) r;
    select coalesce(nullif(v_name, ''), display_name) into v_name from guest_profiles where id = v_guest;
    insert into event_members (event_id, guest_id, display_name) values (v_invite.event_id, v_guest, v_name)
    on conflict (event_id, guest_id) where guest_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  end if;

  update event_members set status = case when p_attending then 'attending' else 'declined' end::public.invite_status,
                           responded_at = now()
  where id = v_member_id;

  insert into guest_responses (event_id, invite_id, guest_id, event_member_id, display_name, rsvp)
  values (v_invite.event_id, v_invite.id, v_guest, v_member_id, v_name, case when p_attending then 'attending' else 'declined' end);

  return jsonb_build_object('member_id', v_member_id, 'guest_secret', v_secret);
end $$;

-- ---------------------------------------------------------------------------
-- create_event, now with guests (from the group, or new by name) and personal links
-- payload adds: guest_ids[], guest_names[]
-- ---------------------------------------------------------------------------
create or replace function public.create_event(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_group_id uuid := nullif(payload ->> 'group_id', '')::uuid;
  v_mode public.date_mode := (payload ->> 'date_mode')::public.date_mode;
  v_status public.event_status;
  v_token text;
  v_member uuid;
  v_name text;
  v_date date;
  v_guests jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_group_id is not null and not is_group_member(v_group_id) then raise exception 'not_group_member' using errcode = '42501'; end if;

  v_status := case v_mode when 'poll' then 'polling' when 'fixed' then 'confirmed' else 'draft' end;

  if v_group_id is null and coalesce(payload ->> 'save_as_group_name', '') <> '' then
    v_group_id := create_group(
      payload ->> 'save_as_group_name', null, payload ->> 'cover_image_url', null,
      array(select jsonb_array_elements_text(coalesce(payload -> 'member_user_ids', '[]'::jsonb))::uuid),
      array(select jsonb_array_elements_text(coalesce(payload -> 'guest_ids', '[]'::jsonb))::uuid),
      '{}'::text[]
    );
    update groups set default_title = payload ->> 'title', default_category = payload ->> 'category',
                      default_time_hint = (payload ->> 'time_hint')::public.time_hint,
                      default_start_time = nullif(payload ->> 'start_time', '')::time
    where id = v_group_id;
  end if;

  insert into events (title, category, cover_image_url, organizer_id, group_id, status, date_mode,
                      period_label, time_hint, start_time, selected_date, locked_at)
  values (
    payload ->> 'title', coalesce(payload ->> 'category', 'hangout'), payload ->> 'cover_image_url',
    v_uid, v_group_id, v_status, v_mode, payload ->> 'period_label',
    coalesce((payload ->> 'time_hint')::public.time_hint, 'any'), nullif(payload ->> 'start_time', '')::time,
    case when v_mode = 'fixed' then (payload ->> 'fixed_date')::date end,
    case when v_mode = 'fixed' then now() end
  )
  returning id into v_event_id;

  if v_mode = 'poll' then
    for v_date in select (jsonb_array_elements_text(coalesce(payload -> 'option_dates', '[]'::jsonb)))::date loop
      insert into event_date_options (event_id, date) values (v_event_id, v_date) on conflict do nothing;
    end loop;
  end if;

  select display_name into v_name from profiles where id = v_uid;
  insert into event_members (event_id, user_id, display_name, role, status, invited_via, responded_at)
  values (v_event_id, v_uid, coalesce(v_name, ''), 'organizer',
          case when v_mode = 'fixed' then 'attending' else 'responded' end::public.invite_status, 'app', now());

  -- Explicitly chosen people only (a group pre-selects everyone, but the organizer may deselect some).
  for v_member in
    select distinct x from (
      select (jsonb_array_elements_text(coalesce(payload -> 'member_user_ids', '[]'::jsonb)))::uuid as x
    ) s where x is not null and x <> v_uid
  loop
    if can_add_person(v_member) then
      insert into event_members (event_id, user_id, display_name, invited_via)
      select v_event_id, p.id, p.display_name, case when v_group_id is null then 'app' else 'group' end
      from profiles p where p.id = v_member
      on conflict do nothing;
    end if;
  end loop;

  insert into event_invites (event_id, created_by) values (v_event_id, v_uid) returning token into v_token;

  -- Guests (no account): existing guest profiles + new names → personal links.
  v_guests := add_event_guests(
    v_event_id,
    array(select jsonb_array_elements_text(coalesce(payload -> 'guest_ids', '[]'::jsonb))::uuid),
    array(select jsonb_array_elements_text(coalesce(payload -> 'guest_names', '[]'::jsonb)))
  );

  insert into notifications (user_id, type, event_id, actor_id, title, data)
  select m.user_id, 'invited', v_event_id, v_uid,
         split_part(coalesce(v_name, 'Noen'), ' ', 1) || ' inviterte deg til ' || (payload ->> 'title'),
         jsonb_build_object('url', '/event/' || v_event_id)
  from event_members m where m.event_id = v_event_id and m.role = 'guest' and m.user_id is not null;

  return jsonb_build_object('event_id', v_event_id, 'invite_token', v_token, 'group_id', v_group_id, 'guests', v_guests);
end $$;

-- ---------------------------------------------------------------------------
-- Smart invite: only the organizer's own history in the app
-- ---------------------------------------------------------------------------
create or replace function public.suggest_invitees(p_category text default null, p_title text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'group_id', (
      select g.id from groups g
      join group_members m on m.group_id = g.id and m.user_id = auth.uid()
      where (p_category is not null and (g.default_category = p_category
               or exists (select 1 from events e where e.group_id = g.id and e.category = p_category)))
         or (p_title is not null and char_length(btrim(p_title)) >= 3
             and (p_title ilike '%' || g.name || '%'                       -- "Pokerkveld" → Poker
                  or g.name ilike '%' || split_part(btrim(p_title), ' ', 1) || '%'
                  or coalesce(g.default_title, '') ilike '%' || split_part(btrim(p_title), ' ', 1) || '%'))
      order by (p_title is not null and p_title ilike '%' || g.name || '%') desc, g.last_activity_at desc limit 1
    ),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.display_name, 'username', q.username, 'avatar_url', q.avatar_url, 'times', q.times))
      from (
        select p.id, p.display_name, p.username, p.avatar_url, count(*) as times
        from events e
        join event_members m on m.event_id = e.id and m.user_id is not null and m.user_id <> auth.uid()
        join profiles p on p.id = m.user_id
        where e.organizer_id = auth.uid() and e.status <> 'cancelled'
          and (p_category is null or e.category = p_category)
        group by p.id
        having count(*) >= 2
        order by count(*) desc, max(e.created_at) desc
        limit 8
      ) q), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.generate_username(text) from public, anon, authenticated;
revoke all on function public.merge_guest_into_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ensure_guest_invite(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_guest_for_invite(public.event_invites, text, text) from public, anon, authenticated;

grant execute on function public.check_username(text, text) to anon, authenticated;
grant execute on function public.get_public_profile(text, uuid) to anon, authenticated;
grant execute on function public.get_invite(text, text) to anon, authenticated;
grant execute on function public.submit_guest_response(text, text, uuid[], text) to anon, authenticated;
grant execute on function public.respond_rsvp(text, boolean, text, text) to anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.send_friend_request(uuid)', 'public.respond_friend_request(uuid, boolean)', 'public.remove_friend(uuid)',
    'public.search_people(text, int)', 'public.people_you_may_know(int)', 'public.list_friends()',
    'public.list_friend_requests()', 'public.list_recent_people(int)', 'public.add_group_members(uuid, uuid[], uuid[], text[])',
    'public.create_group(text, text, text, text, uuid[], uuid[], text[])', 'public.remove_group_member(uuid)',
    'public.leave_group(uuid)', 'public.set_group_member_role(uuid, public.group_role)',
    'public.add_event_guests(uuid, uuid[], text[])', 'public.claim_guest_identity(text)', 'public.claim_guest_invite(text)',
    'public.create_event(jsonb)', 'public.suggest_invitees(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.friendships;
