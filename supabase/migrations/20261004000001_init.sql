-- Nordlys Planlegger — initial schema
-- Users live in auth.users (Supabase Auth). Everything else is in public with RLS enabled.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.event_status as enum ('draft', 'polling', 'date_selected', 'confirmed', 'completed', 'cancelled');
create type public.invite_status as enum ('invited', 'opened', 'responded', 'attending', 'declined');
create type public.date_mode as enum ('fixed', 'poll', 'undecided');
create type public.time_hint as enum ('any', 'daytime', 'evening', 'exact');
create type public.member_role as enum ('organizer', 'guest');
create type public.group_role as enum ('owner', 'admin', 'member');
create type public.availability_status as enum ('unavailable', 'maybe');
create type public.subscription_tier as enum ('free', 'plus');
create type public.notification_type as enum (
  'invited', 'response_received', 'reminder_respond', 'all_can', 'date_locked',
  'event_updated', 'event_reminder', 'group_nudge', 'event_cancelled',
  'friend_request', 'friend_accepted', 'group_added'
);
create type public.calendar_provider as enum ('google', 'apple');
create type public.sponsored_placement as enum ('post_lock_venue', 'event_details', 'group_next');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles & subscriptions
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  locale text not null default 'nb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  tier public.subscription_tier not null default 'free',
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  provider text,              -- 'app_store' | 'play_store' | 'stripe' (later)
  provider_reference text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invites boolean not null default true,
  responses boolean not null default true,
  date_locked boolean not null default true,
  reminders boolean not null default true,
  group_nudges boolean not null default true,
  updated_at timestamptz not null default now()
);

-- New auth user → profile, free subscription, default notification preferences.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.subscriptions (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guests (no account)
-- ---------------------------------------------------------------------------
create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 60),
  secret_hash text unique,                   -- sha256 of the secret kept on the guest's device (null until they first answer)
  claimed_by_user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  image_url text,
  emoji text check (emoji is null or char_length(emoji) <= 8),
  description text check (description is null or char_length(description) <= 280),
  last_activity_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  default_title text,
  default_category text,
  default_time_hint public.time_hint,
  default_start_time time,
  preferred_weekdays smallint[] not null default '{}',   -- 0 = monday … 6 = sunday
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger groups_touch before update on public.groups
  for each row execute function public.touch_updated_at();

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_id uuid references public.guest_profiles (id) on delete cascade,
  display_name text not null default '',
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  check (num_nonnulls(user_id, guest_id) = 1)
);
create unique index group_members_user_uq on public.group_members (group_id, user_id) where user_id is not null;
create unique index group_members_guest_uq on public.group_members (group_id, guest_id) where guest_id is not null;
create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'hangout',
  cover_image_url text,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  status public.event_status not null default 'draft',
  date_mode public.date_mode not null default 'poll',
  period_label text,
  time_hint public.time_hint not null default 'any',
  start_time time,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  selected_date date,
  selected_option_id uuid,
  description text check (description is null or char_length(description) <= 2000),
  timezone text not null default 'Europe/Oslo',
  locked_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_organizer_idx on public.events (organizer_id);
create index events_group_idx on public.events (group_id);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create table public.event_locations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  place_ref text,               -- external place id (later)
  details_pending boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null default 'memory' check (kind in ('cover', 'memory')),
  url text not null,
  storage_path text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_images_event_idx on public.event_images (event_id);

create table public.event_date_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  date date not null,
  start_time time,
  created_at timestamptz not null default now(),
  unique (event_id, date)
);

alter table public.events
  add constraint events_selected_option_fk foreign key (selected_option_id)
  references public.event_date_options (id) on delete set null;

create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_id uuid references public.guest_profiles (id) on delete cascade,
  display_name text not null default '',
  role public.member_role not null default 'guest',
  status public.invite_status not null default 'invited',
  invited_via text not null default 'link' check (invited_via in ('link', 'group', 'app')),
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, guest_id) <= 1)
);
create unique index event_members_user_uq on public.event_members (event_id, user_id) where user_id is not null;
create unique index event_members_guest_uq on public.event_members (event_id, guest_id) where guest_id is not null;
create index event_members_user_idx on public.event_members (user_id);

create table public.event_availability (
  id uuid primary key default gen_random_uuid(),
  event_member_id uuid not null references public.event_members (id) on delete cascade,
  date_option_id uuid not null references public.event_date_options (id) on delete cascade,
  status public.availability_status not null default 'unavailable',
  created_at timestamptz not null default now(),
  unique (event_member_id, date_option_id)
);
create index event_availability_option_idx on public.event_availability (date_option_id);

create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_by uuid references auth.users (id) on delete set null,
  channel text,                 -- 'sms' | 'whatsapp' | 'copy' … (analytics only)
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);
create index event_invites_event_idx on public.event_invites (event_id);

create table public.guest_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invite_id uuid references public.event_invites (id) on delete set null,
  guest_id uuid references public.guest_profiles (id) on delete set null,
  event_member_id uuid references public.event_members (id) on delete set null,
  display_name text not null,
  unavailable_option_ids uuid[] not null default '{}',
  rsvp text check (rsvp in ('attending', 'declined')),
  submitted_at timestamptz not null default now()
);
create index guest_responses_event_idx on public.guest_responses (event_id);

-- ---------------------------------------------------------------------------
-- Notifications & push
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  event_id uuid references public.events (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Prepared for later: calendar integrations & sponsored suggestions
-- ---------------------------------------------------------------------------
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.calendar_provider not null,
  scope text not null default 'free_busy' check (scope in ('free_busy')),  -- never full event details
  consent_at timestamptz not null,
  revoked_at timestamptz,
  vault_secret_id uuid,          -- OAuth tokens live in Supabase Vault, never in this table or the client
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  placement public.sponsored_placement not null,
  category text,                 -- matches events.category
  region text,                   -- e.g. 'oslo'
  sponsor_name text not null,
  title text not null,
  body text,
  image_url text,
  cta_label text not null default 'Se mer',
  cta_url text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer, locked search_path)
-- ---------------------------------------------------------------------------
create or replace function public.is_event_organizer(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event_id and e.organizer_id = auth.uid());
$$;

create or replace function public.is_event_member(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event_id and e.organizer_id = auth.uid())
      or exists (
        select 1 from event_members m
        left join guest_profiles g on g.id = m.guest_id
        where m.event_id = p_event_id and (m.user_id = auth.uid() or g.claimed_by_user_id = auth.uid())
      );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = p_group_id and g.created_by = auth.uid())
      or exists (select 1 from group_members m where m.group_id = p_group_id and m.user_id = auth.uid());
$$;

create or replace function public.shares_context_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_id = auth.uid()
      or exists (
        select 1 from event_members a
        join event_members b on b.event_id = a.event_id
        where a.user_id = auth.uid() and b.user_id = p_user_id
      )
      or exists (
        select 1 from group_members a
        join group_members b on b.group_id = a.group_id
        where a.user_id = auth.uid() and b.user_id = p_user_id
      );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.guest_profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_locations enable row level security;
alter table public.event_images enable row level security;
alter table public.event_date_options enable row level security;
alter table public.event_members enable row level security;
alter table public.event_availability enable row level security;
alter table public.event_invites enable row level security;
alter table public.guest_responses enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.sponsored_placements enable row level security;

-- profiles: visible to yourself and people you plan with. Contact data never lives here.
create policy profiles_select on public.profiles for select using (public.shares_context_with(id));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy subscriptions_select on public.subscriptions for select using (user_id = auth.uid());
-- Writes only via service role (store receipts / webhooks).

create policy prefs_select on public.notification_preferences for select using (user_id = auth.uid());
create policy prefs_update on public.notification_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- guest_profiles: only through RPCs; a claimed identity is visible to its owner.
create policy guests_select on public.guest_profiles for select using (claimed_by_user_id = auth.uid());

-- groups
create policy groups_select on public.groups for select using (public.is_group_member(id));
create policy groups_insert on public.groups for insert with check (created_by = auth.uid());
create policy groups_update on public.groups for update using (public.is_group_member(id)) with check (public.is_group_member(id));
create policy groups_delete on public.groups for delete using (created_by = auth.uid());

create policy group_members_select on public.group_members for select using (public.is_group_member(group_id));
create policy group_members_insert on public.group_members for insert with check (public.is_group_member(group_id));
create policy group_members_delete on public.group_members for delete
  using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

-- events
create policy events_select on public.events for select using (public.is_event_member(id));
create policy events_insert on public.events for insert with check (organizer_id = auth.uid());
create policy events_update on public.events for update using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy events_delete on public.events for delete using (organizer_id = auth.uid());

create policy locations_select on public.event_locations for select using (public.is_event_member(event_id));
create policy locations_write on public.event_locations for all
  using (public.is_event_organizer(event_id)) with check (public.is_event_organizer(event_id));

create policy images_select on public.event_images for select using (public.is_event_member(event_id));
create policy images_insert on public.event_images for insert
  with check (public.is_event_member(event_id) and uploaded_by = auth.uid());
create policy images_delete on public.event_images for delete
  using (uploaded_by = auth.uid() or public.is_event_organizer(event_id));

create policy options_select on public.event_date_options for select using (public.is_event_member(event_id));
create policy options_write on public.event_date_options for all
  using (public.is_event_organizer(event_id)) with check (public.is_event_organizer(event_id));

create policy members_select on public.event_members for select using (public.is_event_member(event_id));
create policy members_insert on public.event_members for insert with check (public.is_event_organizer(event_id));
create policy members_update_self on public.event_members for update
  using (user_id = auth.uid() or public.is_event_organizer(event_id))
  with check (user_id = auth.uid() or public.is_event_organizer(event_id));
create policy members_delete on public.event_members for delete
  using (public.is_event_organizer(event_id) or user_id = auth.uid());

create policy availability_select on public.event_availability for select
  using (exists (select 1 from public.event_members m where m.id = event_member_id and public.is_event_member(m.event_id)));
create policy availability_write_self on public.event_availability for all
  using (exists (select 1 from public.event_members m where m.id = event_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.event_members m where m.id = event_member_id and m.user_id = auth.uid()));

-- Members may read the token (they can forward the link anyway); only the organizer can create/revoke.
create policy invites_select on public.event_invites for select using (public.is_event_member(event_id));
create policy invites_write on public.event_invites for all
  using (public.is_event_organizer(event_id)) with check (public.is_event_organizer(event_id));

create policy guest_responses_select on public.guest_responses for select using (public.is_event_organizer(event_id));

create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_all on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy calendar_select on public.calendar_connections for select using (user_id = auth.uid());
create policy calendar_delete on public.calendar_connections for delete using (user_id = auth.uid());

create policy sponsored_select on public.sponsored_placements for select
  using (active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- ---------------------------------------------------------------------------
-- Date ranking (mirrors src/lib/ranking.ts). Organizer counts as available.
-- ---------------------------------------------------------------------------
create or replace view public.event_date_scores with (security_invoker = true) as
with respondents as (
  select m.event_id, count(*) filter (where m.role = 'organizer' or m.status not in ('invited', 'opened')) as responded,
         count(*) as invited
  from public.event_members m
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
group by o.id, o.event_id, o.date, r.invited, r.responded;

-- ---------------------------------------------------------------------------
-- RPC: create an event in one transaction
-- payload: { title, category, cover_image_url, date_mode, option_dates[], fixed_date,
--            time_hint, start_time, period_label, group_id, member_user_ids[], save_as_group_name }
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
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_group_id is not null and not public.is_group_member(v_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  v_status := case v_mode when 'poll' then 'polling' when 'fixed' then 'confirmed' else 'draft' end;

  -- Optionally save the selected people as a new group for next time.
  if v_group_id is null and coalesce(payload ->> 'save_as_group_name', '') <> '' then
    insert into groups (name, created_by, image_url, default_title, default_category, default_time_hint, default_start_time)
    values (payload ->> 'save_as_group_name', v_uid, payload ->> 'cover_image_url', payload ->> 'title',
            payload ->> 'category', (payload ->> 'time_hint')::public.time_hint, nullif(payload ->> 'start_time', '')::time)
    returning id into v_group_id;
    insert into group_members (group_id, user_id, display_name, role)
    select v_group_id, v_uid, display_name, 'owner' from profiles where id = v_uid;
    insert into group_members (group_id, user_id, display_name)
    select v_group_id, p.id, p.display_name
    from profiles p
    where p.id in (select (jsonb_array_elements_text(coalesce(payload -> 'member_user_ids', '[]'::jsonb)))::uuid)
      and public.shares_context_with(p.id) and p.id <> v_uid
    on conflict do nothing;
  end if;

  insert into events (title, category, cover_image_url, organizer_id, group_id, status, date_mode,
                      period_label, time_hint, start_time, selected_date, locked_at)
  values (
    payload ->> 'title',
    coalesce(payload ->> 'category', 'hangout'),
    payload ->> 'cover_image_url',
    v_uid,
    v_group_id,
    v_status,
    v_mode,
    payload ->> 'period_label',
    coalesce((payload ->> 'time_hint')::public.time_hint, 'any'),
    nullif(payload ->> 'start_time', '')::time,
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

  -- Members: explicit people + everyone with an account in the chosen group.
  for v_member in
    select distinct x from (
      select (jsonb_array_elements_text(coalesce(payload -> 'member_user_ids', '[]'::jsonb)))::uuid as x
      union
      select gm.user_id from group_members gm where gm.group_id = v_group_id and gm.user_id is not null
    ) s where x is not null and x <> v_uid
  loop
    if public.shares_context_with(v_member) then
      insert into event_members (event_id, user_id, display_name, invited_via)
      select v_event_id, p.id, p.display_name, case when v_group_id is null then 'app' else 'group' end
      from profiles p where p.id = v_member
      on conflict do nothing;
    end if;
  end loop;

  insert into event_invites (event_id, created_by) values (v_event_id, v_uid) returning token into v_token;

  -- Notify invited users with accounts.
  insert into notifications (user_id, type, event_id, actor_id, title, data)
  select m.user_id, 'invited', v_event_id, v_uid,
         coalesce(v_name, 'Noen') || ' inviterte deg til ' || (payload ->> 'title'),
         jsonb_build_object('url', '/event/' || v_event_id)
  from event_members m where m.event_id = v_event_id and m.role = 'guest' and m.user_id is not null;

  update groups set updated_at = now() where id = v_group_id;

  return jsonb_build_object('event_id', v_event_id, 'invite_token', v_token, 'group_id', v_group_id);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: public invitation view (no auth required). Exposes only what a guest needs.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite(p_token text, p_guest_secret text default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_invite event_invites;
  v_event events;
  v_guest_id uuid;
  v_member event_members;
  v_result jsonb;
begin
  select * into v_invite from event_invites
  where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  select * into v_event from events where id = v_invite.event_id;
  if v_event.status = 'cancelled' then return jsonb_build_object('cancelled', true, 'title', v_event.title); end if;

  if auth.uid() is not null then
    select * into v_member from event_members where event_id = v_event.id and user_id = auth.uid();
  elsif p_guest_secret is not null then
    select id into v_guest_id from guest_profiles where secret_hash = encode(digest(p_guest_secret, 'sha256'), 'hex');
    select * into v_member from event_members where event_id = v_event.id and guest_id = v_guest_id;
  end if;

  select jsonb_build_object(
    'token', p_token,
    'event', jsonb_build_object(
      'id', v_event.id, 'title', v_event.title, 'category', v_event.category,
      'cover_image_url', v_event.cover_image_url, 'status', v_event.status,
      'date_mode', v_event.date_mode, 'period_label', v_event.period_label,
      'time_hint', v_event.time_hint, 'start_time', v_event.start_time,
      'selected_date', v_event.selected_date, 'description', v_event.description,
      'location', (select jsonb_build_object('name', l.name, 'address', l.address, 'details_pending', l.details_pending)
                   from event_locations l where l.event_id = v_event.id),
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'date', o.date) order by o.date)
                           from event_date_options o where o.event_id = v_event.id), '[]'::jsonb)
    ),
    'organizer', (select jsonb_build_object('id', p.id, 'name', split_part(p.display_name, ' ', 1), 'avatar_url', p.avatar_url)
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
  ) into v_result;

  return v_result;
end $$;

-- Marks the invite as opened for known members (best effort, separate from the stable read).
create or replace function public.mark_invite_opened(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update event_members m set status = 'opened', opened_at = now()
  from event_invites i
  where i.token = p_token and m.event_id = i.event_id and m.user_id = auth.uid() and m.status = 'invited';
  update event_invites set use_count = use_count + 1 where token = p_token;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: submit availability (works with or without an account)
-- Returns the guest secret so the device can edit/claim later.
-- ---------------------------------------------------------------------------
create or replace function public.submit_guest_response(
  p_token text,
  p_name text,
  p_unavailable_option_ids uuid[],
  p_guest_secret text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite event_invites;
  v_event events;
  v_uid uuid := auth.uid();
  v_guest_id uuid;
  v_secret text := p_guest_secret;
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
    insert into event_members (event_id, user_id, display_name, invited_via)
    values (v_event.id, v_uid, v_name, 'link')
    on conflict (event_id, user_id) where user_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  else
    if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
    if v_secret is not null then
      select id into v_guest_id from guest_profiles where secret_hash = encode(digest(v_secret, 'sha256'), 'hex');
    end if;
    if v_guest_id is null then
      v_secret := encode(gen_random_bytes(24), 'hex');
      insert into guest_profiles (display_name, secret_hash)
      values (v_name, encode(digest(v_secret, 'sha256'), 'hex'))
      returning id into v_guest_id;
    else
      update guest_profiles set display_name = v_name where id = v_guest_id;
    end if;
    insert into event_members (event_id, guest_id, display_name, invited_via)
    values (v_event.id, v_guest_id, v_name, 'link')
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
  values (v_event.id, v_invite.id, v_guest_id, v_member_id, v_name, coalesce(p_unavailable_option_ids, '{}'));

  -- Tell the organizer. Collapse into one notification per event while unread.
  select count(*) filter (where status in ('invited', 'opened')), count(*) into v_pending, v_total
  from event_members where event_id = v_event.id;

  insert into notifications (user_id, type, event_id, title, body, data)
  values (v_event.organizer_id, 'response_received', v_event.id,
          v_name || ' har svart på ' || v_event.title,
          case when v_pending = 0 then 'Alle har svart. Se beste dato.' else (v_total - v_pending) || ' av ' || v_total || ' har svart' end,
          jsonb_build_object('url', '/event/' || v_event.id));

  -- Everyone answered and one date works for all → celebrate.
  if v_pending = 0 and exists (
    select 1 from event_date_scores s where s.event_id = v_event.id and s.unavailable = 0
  ) then
    insert into notifications (user_id, type, event_id, title, data)
    select v_event.organizer_id, 'all_can', v_event.id,
           'Alle kan ' || to_char(s.date, 'FMDD.') || ' ' || (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from s.date)::int],
           jsonb_build_object('url', '/event/' || v_event.id)
    from event_date_scores s where s.event_id = v_event.id and s.unavailable = 0
    order by s.date limit 1;
  end if;

  return jsonb_build_object('member_id', v_member_id, 'guest_secret', case when v_uid is null then v_secret end);
end $$;

-- RSVP for events with a fixed/locked date.
create or replace function public.respond_rsvp(p_token text, p_attending boolean, p_name text default null, p_guest_secret text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite event_invites;
  v_uid uuid := auth.uid();
  v_guest_id uuid;
  v_secret text := p_guest_secret;
  v_member_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  select * into v_invite from event_invites where token = p_token and revoked_at is null;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;

  if v_uid is not null then
    if v_name = '' then select display_name into v_name from profiles where id = v_uid; end if;
    insert into event_members (event_id, user_id, display_name) values (v_invite.event_id, v_uid, v_name)
    on conflict (event_id, user_id) where user_id is not null do update set display_name = excluded.display_name
    returning id into v_member_id;
  else
    if v_secret is not null then
      select id into v_guest_id from guest_profiles where secret_hash = encode(digest(v_secret, 'sha256'), 'hex');
    end if;
    if v_guest_id is null then
      if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
      v_secret := encode(gen_random_bytes(24), 'hex');
      insert into guest_profiles (display_name, secret_hash) values (v_name, encode(digest(v_secret, 'sha256'), 'hex'))
      returning id into v_guest_id;
    end if;
    insert into event_members (event_id, guest_id, display_name) values (v_invite.event_id, v_guest_id, coalesce(nullif(v_name, ''), 'Gjest'))
    on conflict (event_id, guest_id) where guest_id is not null do update set display_name = coalesce(nullif(v_name, ''), event_members.display_name)
    returning id into v_member_id;
  end if;

  update event_members set status = case when p_attending then 'attending' else 'declined' end::public.invite_status,
                           responded_at = now()
  where id = v_member_id;

  insert into guest_responses (event_id, invite_id, guest_id, event_member_id, display_name, rsvp)
  values (v_invite.event_id, v_invite.id, v_guest_id, v_member_id, coalesce(nullif(v_name, ''), 'Gjest'),
          case when p_attending then 'attending' else 'declined' end);

  return jsonb_build_object('member_id', v_member_id, 'guest_secret', case when v_uid is null then v_secret end);
end $$;

-- A guest who later signs up links earlier answers to their account.
create or replace function public.claim_guest_identity(p_guest_secret text)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_guest_id uuid;
  v_count int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  update guest_profiles set claimed_by_user_id = auth.uid(), claimed_at = now()
  where secret_hash = encode(digest(p_guest_secret, 'sha256'), 'hex') and claimed_by_user_id is null
  returning id into v_guest_id;
  if v_guest_id is null then return 0; end if;

  -- Move memberships to the user unless the user is already a member of that event.
  update event_members m set user_id = auth.uid(), guest_id = null
  where m.guest_id = v_guest_id
    and not exists (select 1 from event_members x where x.event_id = m.event_id and x.user_id = auth.uid());
  get diagnostics v_count = row_count;
  update group_members m set user_id = auth.uid(), guest_id = null
  where m.guest_id = v_guest_id
    and not exists (select 1 from group_members x where x.group_id = m.group_id and x.user_id = auth.uid());
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: lock a date (organizer) → confirmed + notify everyone with an account
-- ---------------------------------------------------------------------------
create or replace function public.lock_event_date(p_event_id uuid, p_option_id uuid, p_start_time time default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_date date;
  v_name text;
begin
  select * into v_event from events where id = p_event_id and organizer_id = auth.uid() for update;
  if not found then raise exception 'not_organizer' using errcode = '42501'; end if;
  select date into v_date from event_date_options where id = p_option_id and event_id = p_event_id;
  if v_date is null then raise exception 'option_not_found' using errcode = 'P0002'; end if;

  update events set status = 'confirmed', selected_option_id = p_option_id, selected_date = v_date,
                    start_time = coalesce(p_start_time, start_time), locked_at = now()
  where id = p_event_id;

  -- Respondents who could make it are attending; those who couldn't are declined.
  update event_members m set status = case
      when exists (select 1 from event_availability a where a.event_member_id = m.id and a.date_option_id = p_option_id and a.status = 'unavailable')
      then 'declined' else 'attending' end::public.invite_status
  where m.event_id = p_event_id and (m.status = 'responded' or m.role = 'organizer');

  select split_part(display_name, ' ', 1) into v_name from profiles where id = auth.uid();
  insert into notifications (user_id, type, event_id, actor_id, title, body, data)
  select m.user_id, 'date_locked', p_event_id, auth.uid(),
         coalesce(v_name, 'Arrangøren') || ' har låst ' || to_char(v_date, 'FMDD.') || ' ' ||
           (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from v_date)::int],
         v_event.title,
         jsonb_build_object('url', '/event/' || p_event_id)
  from event_members m where m.event_id = p_event_id and m.user_id is not null and m.user_id <> auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Account deletion: anonymise answers in other people's events, then delete the user.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  -- Keep the shape of other people's polls, but drop the identity.

  update event_members m set user_id = null, guest_id = null, display_name = 'En gjest'
  where m.user_id = v_uid and m.role = 'guest'
    and exists (select 1 from events e where e.id = m.event_id and e.organizer_id <> v_uid);

  delete from auth.users where id = v_uid;   -- cascades to profile, own events, groups, tokens, notifications
end $$;

-- ---------------------------------------------------------------------------
-- Gentle nudges (run daily with pg_cron). At most one per event / group per 48h.
-- ---------------------------------------------------------------------------
create or replace function public.generate_nudges()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- "3 personer mangler å svare" to organizers of polls older than a day.
  insert into notifications (user_id, type, event_id, title, body, data)
  select e.organizer_id, 'reminder_respond', e.id,
         pending.n || case when pending.n = 1 then ' person mangler' else ' personer mangler' end || ' å svare',
         e.title, jsonb_build_object('url', '/event/' || e.id)
  from events e
  join lateral (select count(*) as n from event_members m where m.event_id = e.id and m.status in ('invited', 'opened')) pending on true
  where e.status = 'polling' and e.created_at < now() - interval '1 day' and pending.n > 0
    and not exists (select 1 from notifications x where x.event_id = e.id and x.type = 'reminder_respond'
                    and x.created_at > now() - interval '48 hours');

  -- Mark past confirmed events as completed.
  update events set status = 'completed', completed_at = now()
  where status = 'confirmed' and selected_date < (now() at time zone timezone)::date;

  -- "Pokerklubben har ikke møttes på 7 uker" — only for groups that have met before and have nothing planned.
  insert into notifications (user_id, type, group_id, title, body, data)
  select g.created_by, 'group_nudge', g.id,
         g.name || ' har ikke møttes på ' || ((current_date - last.d) / 7) || ' uker',
         'Skal vi finne neste dato?', jsonb_build_object('url', '/group/' || g.id)
  from groups g
  join lateral (select max(e.selected_date) as d from events e where e.group_id = g.id and e.status in ('confirmed', 'completed')) last on true
  where g.archived_at is null and last.d is not null and last.d < current_date - 42
    and not exists (select 1 from events e where e.group_id = g.id and e.status in ('draft', 'polling', 'confirmed') and coalesce(e.selected_date, current_date) >= current_date)
    and not exists (select 1 from notifications x where x.group_id = g.id and x.type = 'group_nudge'
                    and x.created_at > now() - interval '14 days');
end $$;

-- Requires the pg_cron extension (enable in Dashboard → Database → Extensions).
-- select cron.schedule('planlegger-nudges', '0 9 * * *', $$select public.generate_nudges()$$);

-- ---------------------------------------------------------------------------
-- Grants for RPCs
-- ---------------------------------------------------------------------------
revoke all on function public.create_event(jsonb) from public, anon;
grant execute on function public.create_event(jsonb) to authenticated;
grant execute on function public.get_invite(text, text) to anon, authenticated;
grant execute on function public.mark_invite_opened(text) to anon, authenticated;
grant execute on function public.submit_guest_response(text, text, uuid[], text) to anon, authenticated;
grant execute on function public.respond_rsvp(text, boolean, text, text) to anon, authenticated;
revoke all on function public.claim_guest_identity(text) from public, anon;
grant execute on function public.claim_guest_identity(text) to authenticated;
revoke all on function public.lock_event_date(uuid, uuid, time) from public, anon;
grant execute on function public.lock_event_date(uuid, uuid, time) to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.generate_nudges() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: organizer sees answers arrive live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.event_members, public.event_availability, public.notifications;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('covers', 'covers', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "covers: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
