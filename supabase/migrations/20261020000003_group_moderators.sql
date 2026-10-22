-- Nordlys Planlegger — moderators in a gjeng
--
-- The 'admin' role is shown as «Moderator». Moderators can add and remove people and edit the gjeng.
-- Only the owner chooses moderators, and a moderator can't remove another moderator (or the owner).

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.set_group_member_role(p_member_id uuid, p_role public.group_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m group_members;
begin
  select * into v_m from group_members where id = p_member_id;
  if not found or v_m.user_id is null or p_role = 'owner' or v_m.role = 'owner' then raise exception 'invalid_role_change' using errcode = '22023'; end if;
  if not is_group_owner(v_m.group_id) then raise exception 'not_group_owner' using errcode = '42501'; end if;
  update group_members set role = p_role where id = p_member_id;
end $$;

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
  if v_m.role = 'admin' and not is_group_owner(v_m.group_id) then raise exception 'not_group_owner' using errcode = '42501'; end if;
  delete from group_members where id = p_member_id;
end $$;

revoke all on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;
