-- Nordlys Planlegger — every gjeng, event and series has a picture
--
-- Pictures are part of the product, not optional metadata. Anything saved without one gets the
-- theme's photo (same first photo as defaultCover() in src/lib/categories.ts), so older app builds
-- keep working and nothing is ever shown without a picture.
--
-- Recurring events: the series has the main picture. Each occurrence keeps its own copy, marked
-- cover_from_series while it follows the series. Changing one occurrence's picture only changes that
-- one; changing the series picture updates the upcoming occurrences that still follow it.

create or replace function public.default_cover(p_category text)
returns text language sql immutable set search_path = public as $$
  select 'https://images.unsplash.com/photo-' || case coalesce(p_category, 'hangout')
    when 'beach' then '1536869338989-e7ffd2297454'
    when 'sauna' then '1579457870378-16e766c0c266'
    when 'games' then '1746635732312-0083b7f9423f'
    when 'quiz' then '1558210598-89ba75b1724e'
    when 'movie' then '1758525862263-af89b090fb56'
    when 'gaming' then '1493711662062-fa541adb3fc8'
    when 'brunch' then '1789758385692-38432c7bc6f8'
    when 'dinner' then '1528605248644-14dd04022da1'
    when 'sport' then '1658723826297-fe4d1b1e6600'
    when 'ski' then '1459196198227-6655e22114d8'
    when 'travel' then '1511632765486-a01980e01a18'
    when 'outdoor' then '1629185752152-fe65698ddee4'
    when 'cabin' then '1504233529578-6d46baba6d34'
    when 'birthday' then '1699730185428-d11054059c7f'
    when 'christmas' then '1601118964938-228a89955311'
    when 'party' then '1699730164892-d7c433524ff3'
    when 'concert' then '1459749411175-04bf5292ceea'
    when 'family' then '1533777419517-3e4017e2e15a'
    else '1579457870378-16e766c0c266'
  end || '?auto=format&fit=crop&w=1200&q=80'
$$;

-- ---------------------------------------------------------------------------
-- Fill in a picture whenever one is missing
-- ---------------------------------------------------------------------------

create or replace function public.groups_ensure_image()
returns trigger language plpgsql set search_path = public as $$
begin
  if nullif(btrim(coalesce(new.image_url, '')), '') is null then
    new.image_url := public.default_cover(new.default_category);
  end if;
  return new;
end $$;
create trigger groups_ensure_image before insert or update of image_url on public.groups
  for each row execute function public.groups_ensure_image();

create or replace function public.events_ensure_cover()
returns trigger language plpgsql set search_path = public as $$
begin
  if nullif(btrim(coalesce(new.cover_image_url, '')), '') is null then
    new.cover_image_url := public.default_cover(new.category);
  end if;
  return new;
end $$;
create trigger events_ensure_cover before insert or update of cover_image_url on public.events
  for each row execute function public.events_ensure_cover();
create trigger event_series_ensure_cover before insert or update of cover_image_url on public.event_series
  for each row execute function public.events_ensure_cover();

update groups set image_url = public.default_cover(default_category) where nullif(btrim(coalesce(image_url, '')), '') is null;
update events set cover_image_url = public.default_cover(category) where nullif(btrim(coalesce(cover_image_url, '')), '') is null;
update event_series set cover_image_url = public.default_cover(category) where nullif(btrim(coalesce(cover_image_url, '')), '') is null;

alter table public.groups alter column image_url set not null;
alter table public.events alter column cover_image_url set not null;
alter table public.event_series alter column cover_image_url set not null;

-- ---------------------------------------------------------------------------
-- Series picture → occurrences
-- ---------------------------------------------------------------------------

alter table public.events add column cover_from_series boolean not null default false;

-- Joining a series: follow its picture when it is the same one.
-- Changing an occurrence's picture by hand: that occurrence now has its own.
create or replace function public.events_series_cover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.series_id is not null and old.series_id is null then
    new.cover_from_series := new.cover_image_url = (select cover_image_url from event_series where id = new.series_id);
  elsif new.cover_image_url is distinct from old.cover_image_url
        and coalesce(current_setting('planlegger.series_cover', true), '') <> 'on' then
    new.cover_from_series := false;
  end if;
  return new;
end $$;
create trigger events_series_cover before update of series_id, cover_image_url on public.events
  for each row execute function public.events_series_cover();
revoke all on function public.events_series_cover() from public, anon, authenticated;

update events e set cover_from_series = true
from event_series s
where e.series_id = s.id and e.cover_image_url = s.cover_image_url;

-- The organizer changes the series picture (from one of its rounds, p_event_id): it applies to
-- that round and to the coming ones that haven't been given their own picture. Past rounds keep theirs.
create or replace function public.set_series_cover(p_series_id uuid, p_url text, p_event_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from event_series where id = p_series_id and organizer_id = auth.uid()) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  update event_series set cover_image_url = p_url where id = p_series_id;
  perform set_config('planlegger.series_cover', 'on', true);
  update events set cover_image_url = (select cover_image_url from event_series where id = p_series_id), cover_from_series = true
  where series_id = p_series_id
    and (cover_from_series or id = p_event_id)
    and status not in ('cancelled', 'completed')
    and (selected_date is null or selected_date >= current_date or id = p_event_id);
  perform set_config('planlegger.series_cover', '', true);
end $$;
revoke all on function public.set_series_cover(uuid, text, uuid) from public, anon;
grant execute on function public.set_series_cover(uuid, text, uuid) to authenticated;
