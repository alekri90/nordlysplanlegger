-- Nordlys Planlegger — never derive public names from e-mail addresses
--
-- Before: someone who first signed in with an e-mail code got the part before "@" as their
-- display name (e.g. "alekri90"), which was pre-filled on the profile setup screen and then
-- shown to friends and guests ("Vi sier fra når alekri90 har låst datoen").
-- After: no name in the sign-up metadata → empty display name; the profile setup screen
-- (shown while onboarded_at is null) asks for a real name.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
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
    -- Chose their name and username on the sign-up screen → no extra onboarding step.
    case when v_name <> '' and v_wanted <> '' and v_username = v_typed then now() end
  );
  insert into public.subscriptions (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;
