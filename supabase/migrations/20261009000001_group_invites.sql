-- Nordlys Planlegger — invite links for groups
--
-- Every member gets their own link to the group (random 128-bit token). Anyone who opens it sees
-- the group's name, picture and a few first names, and joins with an account. The link names who
-- invited (“Alex inviterer deg til Fotballgjengen”) and stops working when that person leaves.

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  use_count int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index group_invites_member_uq on public.group_invites (group_id, created_by) where revoked_at is null;

-- Only through the RPCs below.
alter table public.group_invites enable row level security;

/** The current member's invite link token for a group (created on first use). */
create or replace function public.get_group_invite_link(p_group_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;
  select token into v_token from group_invites where group_id = p_group_id and created_by = auth.uid() and revoked_at is null;
  if v_token is null then
    insert into group_invites (group_id, created_by) values (p_group_id, auth.uid()) returning token into v_token;
  end if;
  return v_token;
end $$;

/** What someone opening a group link may see: no contact data, first names only. */
create or replace function public.get_group_invite(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inv group_invites;
  v_group groups;
begin
  select i.* into v_inv from group_invites i
  where i.token = p_token and i.revoked_at is null
    and exists (select 1 from group_members m where m.group_id = i.group_id and m.user_id = i.created_by);
  if not found then return null; end if;
  select * into v_group from groups where id = v_inv.group_id and archived_at is null;
  if not found then return null; end if;

  return jsonb_build_object(
    'token', p_token,
    'group', jsonb_build_object(
      'id', v_group.id, 'name', v_group.name, 'emoji', v_group.emoji, 'description', v_group.description,
      'image_url', v_group.image_url, 'default_category', v_group.default_category
    ),
    'inviter', (select jsonb_build_object('id', p.id, 'name', split_part(p.display_name, ' ', 1), 'avatar_url', p.avatar_url)
                from profiles p where p.id = v_inv.created_by),
    'member_count', (select count(*) from group_members m where m.group_id = v_group.id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'avatar_url', q.avatar_url))
      from (select m.id, split_part(coalesce(nullif(p.display_name, ''), m.display_name), ' ', 1) as name, p.avatar_url
            from group_members m left join profiles p on p.id = m.user_id
            where m.group_id = v_group.id
            order by (m.user_id = v_inv.created_by) desc nulls last, (m.user_id is null), m.joined_at
            limit 6) q
    ), '[]'::jsonb),
    'is_member', auth.uid() is not null
                 and exists (select 1 from group_members m where m.group_id = v_group.id and m.user_id = auth.uid())
  );
end $$;

/** Join a group through an invite link. Returns the group id (also when already a member). */
create or replace function public.join_group_via_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_inv group_invites;
  v_group groups;
  v_name text;
  v_n int;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select i.* into v_inv from group_invites i
  where i.token = p_token and i.revoked_at is null
    and exists (select 1 from group_members m where m.group_id = i.group_id and m.user_id = i.created_by);
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  select * into v_group from groups where id = v_inv.group_id and archived_at is null;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;

  select display_name into v_name from profiles where id = v_me;
  insert into group_members (group_id, user_id, display_name)
  values (v_group.id, v_me, coalesce(v_name, ''))
  on conflict do nothing;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    update group_invites set use_count = use_count + 1 where id = v_inv.id;
    insert into notifications (user_id, type, group_id, actor_id, title, data)
    values (v_inv.created_by, 'group_added', v_group.id, v_me,
            coalesce(nullif(split_part(v_name, ' ', 1), ''), 'Noen') || ' ble med i ' || v_group.name,
            jsonb_build_object('url', '/group/' || v_group.id));
  end if;
  return v_group.id;
end $$;

/** A member's link stops working when they leave or are removed. */
create or replace function public.revoke_member_group_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.user_id is not null then
    update group_invites set revoked_at = now()
    where group_id = old.group_id and created_by = old.user_id and revoked_at is null;
  end if;
  return old;
end $$;
create trigger group_members_revoke_invites after delete on public.group_members
  for each row execute function public.revoke_member_group_invites();

revoke all on function public.get_group_invite_link(uuid) from public, anon;
grant execute on function public.get_group_invite_link(uuid) to authenticated;
revoke all on function public.join_group_via_invite(text) from public, anon;
grant execute on function public.join_group_via_invite(text) to authenticated;
revoke all on function public.get_group_invite(text) from public;
grant execute on function public.get_group_invite(text) to anon, authenticated;
revoke all on function public.revoke_member_group_invites() from public, anon, authenticated;
