-- Nordlys Planlegger — clean up names that came from e-mail addresses
--
-- 20261008 stopped new accounts from getting the part before "@" as their name, but accounts made
-- earlier kept it (e.g. "alekri90" shown to guests instead of "Alexander"). Those profiles get an
-- empty name and onboarded_at = null, so the app asks for a real name the next time they open it.
-- Names copied onto event and group memberships now follow the profile when it changes.

update public.profiles p
set display_name = '', onboarded_at = null
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.display_name <> ''
  and lower(btrim(p.display_name)) = lower(split_part(u.email, '@', 1));

update public.event_members m
set display_name = p.display_name
from public.profiles p
where m.user_id = p.id and m.display_name is distinct from p.display_name;

update public.group_members m
set display_name = p.display_name
from public.profiles p
where m.user_id = p.id and m.display_name is distinct from p.display_name;

create or replace function public.sync_member_names()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update event_members set display_name = new.display_name where user_id = new.id;
  update group_members set display_name = new.display_name where user_id = new.id;
  return new;
end $$;
create trigger profiles_sync_member_names after update of display_name on public.profiles
  for each row when (old.display_name is distinct from new.display_name)
  execute function public.sync_member_names();

revoke all on function public.sync_member_names() from public, anon, authenticated;
