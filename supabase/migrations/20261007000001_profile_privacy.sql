-- Nordlys Planlegger — profile privacy fix
--
-- Before: anonymous visitors could list every profile with discoverability = 'everyone'
-- straight from the profiles table (names and usernames only, never e-mail — but still enumerable).
-- After: the profiles table is only readable when signed in. Anonymous visitors can still open a
-- profile link (/@username) through get_public_profile(), which looks up one exact username.

create or replace function public.can_view_profile(p_target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_disc public.discoverability;
begin
  -- No anonymous table access; anonymous profile links go through get_public_profile().
  if auth.uid() is null then return false; end if;
  select discoverability into v_disc from profiles where id = p_target;
  if v_disc is null then return false; end if;
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

/** Public profile for /@username or a tapped avatar. Returns null when not visible. */
create or replace function public.get_public_profile(p_username text default null, p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_p profiles;
  v_me uuid := auth.uid();
begin
  if p_user is not null then
    -- Lookup by id is for signed-in users only (ids are not meant to be guessable public handles).
    if v_me is null then return null; end if;
    select * into v_p from profiles where id = p_user;
  else
    select * into v_p from profiles where username_normalized = normalize_username(p_username);
  end if;
  if v_p.id is null then return null; end if;
  if v_me is null then
    -- Anonymous: only an exact-username link to someone who chose "Alle kan finne meg".
    if v_p.discoverability <> 'everyone' then return null; end if;
  elsif not can_view_profile(v_p.id) then
    return null;
  end if;

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
    'mutual_groups', case when v_me is null or v_p.id = v_me then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'emoji', g.emoji, 'image_url', g.image_url))
      from groups g
      where exists (select 1 from group_members m where m.group_id = g.id and m.user_id = v_me)
        and exists (select 1 from group_members m where m.group_id = g.id and m.user_id = v_p.id)), '[]'::jsonb) end
  );
end $$;
