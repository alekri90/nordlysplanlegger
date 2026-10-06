import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { defaultCover } from '@/lib/categories';
import { periodLabelFor } from '@/lib/dates';
import { clearGuestSecret, getGuestSecret, getPendingClaimToken, setGuestName, setGuestSecret, setPendingClaimToken } from '@/lib/guestIdentity';
import { isLocalUri, readImageBytes } from '@/lib/upload';
import type { Repository } from '../repository';
import type {
  AppNotification,
  CategoryId,
  ClaimResult,
  Discoverability,
  EventMember,
  FriendshipState,
  Group,
  GroupEventRef,
  GroupMember,
  GroupRole,
  InviteView,
  NotificationPreferences,
  Person,
  PlannerEvent,
  Profile,
  PublicProfile,
  UsernameCheck,
} from '../types';
import { getSupabase } from './client';

// ---------------------------------------------------------------------------
// Row shapes (only the columns we select) and mappers → domain
// ---------------------------------------------------------------------------

type ProfileRow = { id: string; display_name: string; avatar_url: string | null; username?: string | null };

type EventRow = {
  id: string;
  title: string;
  category: string;
  cover_image_url: string | null;
  status: PlannerEvent['status'];
  date_mode: PlannerEvent['dateMode'];
  group_id: string | null;
  period_label: string | null;
  time_hint: PlannerEvent['timeHint'];
  start_time: string | null;
  selected_date: string | null;
  selected_option_id: string | null;
  description: string | null;
  created_at: string;
  locked_at: string | null;
  organizer: ProfileRow | null;
  location: { name: string; address: string | null; details_pending: boolean } | null;
  options: { id: string; date: string }[];
  members: {
    id: string;
    user_id: string | null;
    guest_id: string | null;
    display_name: string;
    role: EventMember['role'];
    status: EventMember['status'];
    responded_at: string | null;
    profile: ProfileRow | null;
    availability: { date_option_id: string; status: string }[];
  }[];
  invites: { token: string; revoked_at: string | null }[];
  images: { url: string; kind: string }[];
};

const EVENT_SELECT = `
  id, title, category, cover_image_url, status, date_mode, group_id, period_label, time_hint,
  start_time, selected_date, selected_option_id, description, created_at, locked_at,
  organizer:profiles!events_organizer_id_fkey(id, display_name, avatar_url, username),
  location:event_locations(name, address, details_pending),
  options:event_date_options!event_date_options_event_id_fkey(id, date),
  members:event_members(id, user_id, guest_id, display_name, role, status, responded_at,
    profile:profiles(id, display_name, avatar_url, username),
    availability:event_availability(date_option_id, status)),
  invites:event_invites(token, revoked_at),
  images:event_images(url, kind)
`;

const toPerson = (p: ProfileRow | null | undefined, fallbackName = 'Gjest', fallbackId = ''): Person => ({
  id: p?.id ?? fallbackId,
  name: p?.display_name || fallbackName,
  avatarUrl: p?.avatar_url ?? null,
  username: p?.username ?? null,
  isGuest: !p,
});

const toTime = (t: string | null) => (t ? t.slice(0, 5) : null);

function toEvent(r: EventRow): PlannerEvent {
  const category = (r.category as CategoryId) ?? 'hangout';
  return {
    id: r.id,
    title: r.title,
    category,
    coverImageUrl: r.cover_image_url ?? defaultCover(category),
    status: r.status,
    dateMode: r.date_mode,
    organizer: toPerson(r.organizer),
    groupId: r.group_id,
    periodLabel: r.period_label,
    timeHint: r.time_hint,
    startTime: toTime(r.start_time),
    selectedDate: r.selected_date,
    selectedOptionId: r.selected_option_id,
    location: r.location ? { name: r.location.name, address: r.location.address, detailsPending: r.location.details_pending } : null,
    description: r.description,
    options: [...(r.options ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)),
    members: (r.members ?? []).map((m) => ({
      id: m.id,
      person: toPerson(m.profile, m.display_name || 'Gjest', m.user_id ?? m.guest_id ?? m.id),
      userId: m.user_id,
      role: m.role,
      status: m.status,
      unavailableOptionIds: (m.availability ?? []).filter((a) => a.status === 'unavailable').map((a) => a.date_option_id),
      respondedAt: m.responded_at,
    })),
    inviteToken: r.invites?.find((i) => !i.revoked_at)?.token ?? '',
    photos: (r.images ?? []).filter((i) => i.kind === 'memory').map((i) => i.url),
    createdAt: r.created_at,
    lockedAt: r.locked_at,
  };
}

type GroupRow = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  image_url: string | null;
  created_by: string;
  default_title: string | null;
  default_category: string | null;
  default_time_hint: PlannerEvent['timeHint'] | null;
  default_start_time: string | null;
  preferred_weekdays: number[] | null;
  created_at: string;
  last_activity_at: string;
  members: { id: string; user_id: string | null; guest_id: string | null; display_name: string; role: GroupRole; joined_at: string; profile: ProfileRow | null }[];
  events: { id: string; title: string; selected_date: string | null; status: PlannerEvent['status']; created_at: string }[];
};

const GROUP_SELECT = `
  id, name, emoji, description, image_url, created_by, default_title, default_category, default_time_hint,
  default_start_time, preferred_weekdays, created_at, last_activity_at,
  members:group_members(id, user_id, guest_id, display_name, role, joined_at, profile:profiles(id, display_name, avatar_url, username)),
  events(id, title, selected_date, status, created_at)
`;

const ROLE_ORDER: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };

function toGroup(r: GroupRow, meId: string | null): Group {
  const ref = (e: GroupRow['events'][number]): GroupEventRef => ({ id: e.id, title: e.title, date: e.selected_date, status: e.status });
  const upcoming = r.events
    .filter((e) => ['draft', 'polling', 'date_selected', 'confirmed'].includes(e.status))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const past = r.events
    .filter((e) => e.status === 'completed')
    .sort((a, b) => ((a.selected_date ?? '') < (b.selected_date ?? '') ? 1 : -1));
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    description: r.description,
    coverImageUrl: r.image_url ?? defaultCover((r.default_category as CategoryId) ?? 'hangout'),
    createdBy: r.created_by,
    myRole: r.members.find((m) => m.user_id === meId)?.role ?? null,
    members: [...r.members]
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || Number(!!a.guest_id) - Number(!!b.guest_id) || a.joined_at.localeCompare(b.joined_at))
      .map<GroupMember>((m) => ({
        ...toPerson(m.profile, m.display_name || 'Gjest', m.user_id ?? m.guest_id ?? m.id),
        isGuest: !m.user_id,
        memberId: m.id,
        role: m.role,
      })),
    defaults: {
      title: r.default_title,
      category: r.default_category as CategoryId | null,
      timeHint: r.default_time_hint,
      startTime: toTime(r.default_start_time),
      preferredWeekdays: r.preferred_weekdays ?? [],
    },
    nextEvent: upcoming[0] ? ref(upcoming[0]) : null,
    lastEvent: past[0] ? ref(past[0]) : null,
    pastEvents: past.map(ref),
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
  };
}

type PersonRow = { id: string; display_name: string; username: string; avatar_url: string | null };
const fromPersonRow = (p: PersonRow): Person => ({ id: p.id, name: p.display_name, username: p.username, avatarUrl: p.avatar_url });

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(friendlyError(error.message));
}

function friendlyError(message: string) {
  if (message.includes('poll_closed')) return 'Datoen er allerede bestemt';
  if (message.includes('invite_not_found')) return 'Invitasjonen finnes ikke lenger';
  if (message.includes('name_required')) return 'Skriv navnet ditt først';
  if (message.includes('not_authenticated')) return 'Du må logge inn først';
  if (message.includes('username_') || message.includes('profiles_username_normalized_key')) return 'Brukernavnet er ikke tilgjengelig';
  if (message.includes('profile_not_found')) return 'Fant ikke personen';
  if (message.includes('not_group_admin')) return 'Bare admin kan gjøre dette';
  if (message.includes('not_group_member')) return 'Du er ikke med i gjengen';
  if (message.toLowerCase().includes('already registered')) return 'Det finnes allerede en konto med denne e-posten';
  if (message.toLowerCase().includes('invalid login credentials')) return 'Feil e-post eller passord';
  if (message.toLowerCase().includes('password should be')) return 'Passordet må ha minst 8 tegn';
  if (message.toLowerCase().includes('network')) return 'Ingen nettforbindelse';
  return message;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function loadProfile(userId: string, email?: string | null): Promise<Profile | null> {
  const sb = getSupabase();
  const [{ data: p }, { data: sub }] = await Promise.all([
    sb.from('profiles').select('id, display_name, avatar_url, username, bio, discoverability, onboarded_at').eq('id', userId).maybeSingle(),
    sb.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle(),
  ]);
  if (!p) return null;
  return {
    id: p.id,
    name: p.display_name,
    avatarUrl: p.avatar_url,
    username: p.username,
    bio: p.bio,
    discoverability: p.discoverability as Discoverability,
    onboarded: !!p.onboarded_at,
    email: email ?? null,
    tier: (sub?.tier as Profile['tier']) ?? 'free',
  };
}

/**
 * Link guest history to the signed-in account: the secret this device got when answering as a guest,
 * and a personal invite link they signed up from. Never by name.
 */
async function claimGuestHistory(inviteToken?: string): Promise<ClaimResult> {
  const sb = getSupabase();
  const total: ClaimResult = { events: 0, groups: 0 };
  const add = (r: unknown) => {
    const x = r as Partial<ClaimResult> | null;
    total.events += x?.events ?? 0;
    total.groups += x?.groups ?? 0;
  };
  const secret = await getGuestSecret();
  if (secret) {
    const { data, error } = await sb.rpc('claim_guest_identity', { p_guest_secret: secret });
    if (!error) {
      add(data);
      await clearGuestSecret();
    }
  }
  const token = inviteToken ?? (await getPendingClaimToken());
  if (token) {
    const { data, error } = await sb.rpc('claim_guest_invite', { p_token: token });
    if (!error) {
      add(data);
      await setPendingClaimToken(null);
    }
  }
  return total;
}

/** Detect the real image type from its first bytes (the web picker may return PNG/WebP). */
function imageType(bytes: ArrayBuffer): { mime: string; ext: string } {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return { mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0x47 && b[1] === 0x49) return { mime: 'image/gif', ext: 'gif' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

async function uploadImage(bucket: 'covers' | 'avatars', userId: string, uri: string): Promise<string> {
  const sb = getSupabase();
  const bytes = await readImageBytes(uri);
  const { mime, ext } = imageType(bytes);
  // A fresh, unique path per upload: plain insert only needs the INSERT storage policy
  // (upsert would additionally require SELECT + UPDATE policies).
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  fail(error);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Du må logge inn først');
  return id;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const supabaseRepository: Repository = {
  kind: 'supabase',

  async getMe() {
    const { data } = await getSupabase().auth.getSession();
    const user = data.session?.user;
    return user ? loadProfile(user.id, user.email) : null;
  },

  onAuthChange(cb) {
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside this callback (can deadlock the auth lock).
      setTimeout(async () => {
        if (!session?.user) return cb(null);
        if (event === 'SIGNED_IN') await claimGuestHistory();
        cb(await loadProfile(session.user.id, session.user.email));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async sendOtp(target) {
    const { error } = await getSupabase().auth.signInWithOtp({ email: target.email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    fail(error);
  },

  async verifyOtp(target, code) {
    const sb = getSupabase();
    const { error } = await sb.auth.verifyOtp({ email: target.email.trim().toLowerCase(), token: code, type: 'email' });
    fail(error);
  },

  async signUp(input) {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        // handle_new_user() reads these; the database validates and reserves the username.
        data: { display_name: input.displayName.trim(), username: input.username.trim() },
        emailRedirectTo: Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth-callback'),
      },
    });
    fail(error);
    return data.session ? 'signed_in' : 'confirm_email';
  },

  async signInWithPassword(email, password) {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    fail(error);
  },

  async signOut() {
    await getSupabase().auth.signOut();
  },

  async checkUsername(username, displayName) {
    const { data, error } = await getSupabase().rpc('check_username', { p_username: username, p_display_name: displayName ?? null });
    fail(error);
    return { normalized: data.normalized, available: data.available, reason: data.reason, suggestions: data.suggestions ?? [] } as UsernameCheck;
  },

  async claimGuest(opts) {
    return claimGuestHistory(opts?.inviteToken);
  },

  async deleteAccount() {
    const { error } = await getSupabase().rpc('delete_my_account');
    fail(error);
    await getSupabase().auth.signOut();
  },

  async updateProfile(patch) {
    const sb = getSupabase();
    const userId = await requireUserId();
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.display_name = patch.name.trim();
    if (patch.username !== undefined) update.username = patch.username.trim().replace(/^@+/, '');
    if (patch.bio !== undefined) update.bio = patch.bio?.trim() || null;
    if (patch.discoverability !== undefined) update.discoverability = patch.discoverability;
    if (patch.onboarded) update.onboarded_at = new Date().toISOString();
    if (patch.avatarUri !== undefined) {
      update.avatar_url = patch.avatarUri && isLocalUri(patch.avatarUri) ? await uploadImage('avatars', userId, patch.avatarUri) : patch.avatarUri;
    }
    const { error } = await sb.from('profiles').update(update).eq('id', userId);
    fail(error);
    return (await loadProfile(userId))!;
  },

  async listEvents() {
    const { data, error } = await getSupabase().from('events').select(EVENT_SELECT).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(100);
    fail(error);
    return (data as unknown as EventRow[]).map(toEvent);
  },

  async getEvent(id) {
    const { data, error } = await getSupabase().from('events').select(EVENT_SELECT).eq('id', id).single();
    fail(error);
    return toEvent(data as unknown as EventRow);
  },

  async createEvent(input) {
    const userId = await requireUserId();
    const cover = isLocalUri(input.coverImageUrl) ? await uploadImage('covers', userId, input.coverImageUrl) : input.coverImageUrl;
    const { data, error } = await getSupabase().rpc('create_event', {
      payload: {
        title: input.title.trim(),
        category: input.category,
        cover_image_url: cover,
        date_mode: input.dateMode,
        option_dates: input.optionDates,
        fixed_date: input.fixedDate ?? null,
        time_hint: input.timeHint,
        start_time: input.startTime ?? null,
        period_label: input.periodLabel ?? periodLabelFor(input.optionDates),
        group_id: input.groupId ?? null,
        member_user_ids: input.memberIds,
        guest_ids: input.guestIds ?? [],
        guest_names: input.guestNames ?? [],
        save_as_group_name: input.saveAsGroupName ?? null,
      },
    });
    fail(error);
    const r = data as { event_id: string; invite_token: string; group_id: string | null; guests: { guest_id: string; name: string; token: string }[] };
    return {
      eventId: r.event_id,
      inviteToken: r.invite_token,
      groupId: r.group_id,
      guests: (r.guests ?? []).map((g) => ({ guestId: g.guest_id, name: g.name, token: g.token })),
    };
  },

  async updateEvent(id, patch) {
    const sb = getSupabase();
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title.trim();
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.startTime !== undefined) update.start_time = patch.startTime;
    if (patch.timeHint !== undefined) update.time_hint = patch.timeHint;
    if (patch.coverImageUrl !== undefined) {
      update.cover_image_url = isLocalUri(patch.coverImageUrl) ? await uploadImage('covers', await requireUserId(), patch.coverImageUrl) : patch.coverImageUrl;
    }
    if (Object.keys(update).length) {
      const { error } = await sb.from('events').update(update).eq('id', id);
      fail(error);
    }
    if (patch.location !== undefined) {
      if (patch.location) {
        const { error } = await sb
          .from('event_locations')
          .upsert({ event_id: id, name: patch.location.name, address: patch.location.address ?? null, details_pending: !!patch.location.detailsPending }, { onConflict: 'event_id' });
        fail(error);
      } else {
        await sb.from('event_locations').delete().eq('event_id', id);
      }
    }
  },

  async lockDate(eventId, optionId) {
    const { error } = await getSupabase().rpc('lock_event_date', { p_event_id: eventId, p_option_id: optionId });
    fail(error);
  },

  async startPoll(eventId, optionDates) {
    const sb = getSupabase();
    const { error: insertError } = await sb.from('event_date_options').insert(optionDates.map((date) => ({ event_id: eventId, date })));
    fail(insertError);
    const { error } = await sb.from('events').update({ status: 'polling', date_mode: 'poll', period_label: periodLabelFor(optionDates) }).eq('id', eventId);
    fail(error);
  },

  async setRsvp(eventId, attending) {
    const userId = await requireUserId();
    const { error } = await getSupabase()
      .from('event_members')
      .update({ status: attending ? 'attending' : 'declined', responded_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('user_id', userId);
    fail(error);
  },

  async cancelEvent(eventId) {
    const { error } = await getSupabase().from('events').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', eventId);
    fail(error);
  },

  subscribeToEvent(eventId, onChange) {
    const sb = getSupabase();
    const channel = sb
      .channel(`event:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_members', filter: `event_id=eq.${eventId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_availability' }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  },

  async getInvite(token) {
    const sb = getSupabase();
    const secret = await getGuestSecret();
    const { data, error } = await sb.rpc('get_invite', { p_token: token, p_guest_secret: secret });
    fail(error);
    if (!data || data.cancelled) return null;
    sb.rpc('mark_invite_opened', { p_token: token }).then(() => {}, () => {});
    const e = data.event;
    const category = (e.category as CategoryId) ?? 'hangout';
    const view: InviteView = {
      token,
      event: {
        id: e.id,
        title: e.title,
        category,
        coverImageUrl: e.cover_image_url ?? defaultCover(category),
        status: e.status,
        dateMode: e.date_mode,
        periodLabel: e.period_label,
        timeHint: e.time_hint,
        startTime: toTime(e.start_time),
        selectedDate: e.selected_date,
        location: e.location ? { name: e.location.name, address: e.location.address, detailsPending: e.location.details_pending } : null,
        description: e.description,
        options: e.options ?? [],
      },
      organizer: { id: data.organizer?.id ?? '', name: data.organizer?.name ?? 'Arrangøren', avatarUrl: data.organizer?.avatar_url ?? null, username: data.organizer?.username ?? null },
      personal: !!data.personal,
      claimable: !!data.claimable,
      groupId: e.group_id ?? null,
      invitedCount: data.invited_count ?? 0,
      respondents: (data.respondents ?? []).map((p: { id: string; name: string; avatar_url: string | null }) => ({ id: p.id, name: p.name, avatarUrl: p.avatar_url })),
      myResponse: data.my_response
        ? {
            memberId: data.my_response.member_id,
            name: data.my_response.name,
            status: data.my_response.status,
            unavailableOptionIds: data.my_response.unavailable_option_ids ?? [],
          }
        : null,
    };
    return view;
  },

  async submitAvailability(token, input) {
    const secret = await getGuestSecret();
    const { data, error } = await getSupabase().rpc('submit_guest_response', {
      p_token: token,
      p_name: input.name,
      p_unavailable_option_ids: input.unavailableOptionIds,
      p_guest_secret: secret,
    });
    fail(error);
    if (data?.guest_secret) await setGuestSecret(data.guest_secret);
    if (input.name) await setGuestName(input.name);
  },

  async submitRsvp(token, attending, name) {
    const secret = await getGuestSecret();
    const { data, error } = await getSupabase().rpc('respond_rsvp', { p_token: token, p_attending: attending, p_name: name ?? null, p_guest_secret: secret });
    fail(error);
    if (data?.guest_secret) await setGuestSecret(data.guest_secret);
    if (name) await setGuestName(name);
  },

  async listGroups() {
    const meId = await currentUserId();
    const { data, error } = await getSupabase().from('groups').select(GROUP_SELECT).is('archived_at', null).order('last_activity_at', { ascending: false });
    fail(error);
    return (data as unknown as GroupRow[]).map((r) => toGroup(r, meId));
  },

  async getGroup(id) {
    const meId = await currentUserId();
    const { data, error } = await getSupabase().from('groups').select(GROUP_SELECT).eq('id', id).single();
    fail(error);
    return toGroup(data as unknown as GroupRow, meId);
  },

  async createGroup(input) {
    const userId = await requireUserId();
    const cover = input.coverImageUrl && isLocalUri(input.coverImageUrl) ? await uploadImage('covers', userId, input.coverImageUrl) : input.coverImageUrl;
    const { data, error } = await getSupabase().rpc('create_group', {
      p_name: input.name.trim(),
      p_emoji: input.emoji ?? null,
      p_image_url: cover || null,
      p_description: input.description ?? null,
      p_user_ids: input.userIds,
      p_guest_ids: input.guestIds ?? [],
      p_guest_names: input.guestNames ?? [],
    });
    fail(error);
    return this.getGroup(data as string);
  },

  async updateGroup(id, patch) {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.emoji !== undefined) update.emoji = patch.emoji;
    if (patch.description !== undefined) update.description = patch.description?.trim() || null;
    if (patch.coverImageUrl !== undefined) {
      update.image_url = isLocalUri(patch.coverImageUrl) ? await uploadImage('covers', await requireUserId(), patch.coverImageUrl) : patch.coverImageUrl;
    }
    // RLS only lets owners/admins update; zero rows means not allowed.
    const { data, error } = await getSupabase().from('groups').update(update).eq('id', id).select('id');
    fail(error);
    if (!data?.length) throw new Error('Bare admin kan endre gjengen');
  },

  async addGroupMembers(groupId, input) {
    const { data, error } = await getSupabase().rpc('add_group_members', {
      p_group_id: groupId,
      p_user_ids: input.userIds ?? [],
      p_guest_ids: input.guestIds ?? [],
      p_guest_names: input.guestNames ?? [],
    });
    fail(error);
    return data as number;
  },

  async removeGroupMember(_groupId, memberId) {
    const { error } = await getSupabase().rpc('remove_group_member', { p_member_id: memberId });
    fail(error);
  },

  async setGroupMemberRole(_groupId, memberId, role) {
    const { error } = await getSupabase().rpc('set_group_member_role', { p_member_id: memberId, p_role: role });
    fail(error);
  },

  async leaveGroup(groupId) {
    const { error } = await getSupabase().rpc('leave_group', { p_group_id: groupId });
    fail(error);
  },

  // --- People & friends ------------------------------------------------------

  async listRecentPeople() {
    const { data, error } = await getSupabase().rpc('list_recent_people', { p_limit: 40 });
    fail(error);
    return (data as PersonRow[]).map(fromPersonRow);
  },

  async listFriends() {
    const { data, error } = await getSupabase().rpc('list_friends');
    fail(error);
    return (data as PersonRow[]).map(fromPersonRow);
  },

  async listFriendRequests() {
    const { data, error } = await getSupabase().rpc('list_friend_requests');
    fail(error);
    type Row = PersonRow & { request_id: string; context: string | null; mutual_friends: number; created_at: string };
    return (data as Row[]).map((r) => ({ id: r.request_id, person: fromPersonRow(r), context: r.context, mutualFriends: r.mutual_friends, createdAt: r.created_at }));
  },

  async searchPeople(query) {
    const { data, error } = await getSupabase().rpc('search_people', { p_query: query, p_limit: 20 });
    fail(error);
    type Row = PersonRow & { friendship: FriendshipState; mutual_friends: number; mutual_groups: number };
    return (data as Row[]).map((r) => ({ ...fromPersonRow(r), username: r.username, friendship: r.friendship, mutualFriends: r.mutual_friends, mutualGroups: r.mutual_groups }));
  },

  async peopleYouMayKnow() {
    const { data, error } = await getSupabase().rpc('people_you_may_know', { p_limit: 10 });
    fail(error);
    type Row = PersonRow & { context: string | null; mutual_friends: number };
    return (data as Row[]).map((r) => ({ ...fromPersonRow(r), username: r.username, friendship: 'none' as const, mutualFriends: r.mutual_friends, mutualGroups: 0, context: r.context }));
  },

  async getPublicProfile(by) {
    const { data, error } = await getSupabase().rpc('get_public_profile', 'userId' in by ? { p_user: by.userId } : { p_username: by.username });
    fail(error);
    if (!data) return null;
    type Mini = { id: string; name: string; avatar_url: string | null; emoji?: string | null; image_url?: string | null };
    const profile: PublicProfile = {
      person: { id: data.id, name: data.display_name, username: data.username, avatarUrl: data.avatar_url },
      bio: data.bio,
      friendship: data.friendship,
      requestId: data.request_id,
      context: data.context,
      friendCount: data.friend_count,
      groupCount: data.group_count,
      mutualFriends: (data.mutual_friends as Mini[]).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatar_url })),
      mutualFriendCount: data.mutual_friend_count ?? 0,
      mutualGroups: (data.mutual_groups as Mini[]).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, imageUrl: g.image_url })),
    };
    return profile;
  },

  async sendFriendRequest(userId) {
    const { data, error } = await getSupabase().rpc('send_friend_request', { p_user: userId });
    fail(error);
    return data as FriendshipState;
  },

  async respondFriendRequest(requestId, accept) {
    const { error } = await getSupabase().rpc('respond_friend_request', { p_request_id: requestId, p_accept: accept });
    fail(error);
  },

  async removeFriend(userId) {
    const { error } = await getSupabase().rpc('remove_friend', { p_user: userId });
    fail(error);
  },

  subscribeToFriends(onChange) {
    const sb = getSupabase();
    // RLS limits realtime rows to friendships the user is part of.
    const channel = sb.channel('friendships').on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, onChange).subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  },

  async suggestInvitees(category, title) {
    const { data, error } = await getSupabase().rpc('suggest_invitees', { p_category: category ?? null, p_title: title ?? null });
    fail(error);
    type Row = { id: string; name: string; username: string; avatar_url: string | null; times: number };
    return { groupId: data.group_id ?? null, people: (data.people as Row[]).map((p) => ({ id: p.id, name: p.name, username: p.username, avatarUrl: p.avatar_url, times: p.times })) };
  },

  async listNotifications() {
    const { data, error } = await getSupabase()
      .from('notifications')
      .select('id, type, title, body, data, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);
    fail(error);
    type Row = { id: string; type: AppNotification['type']; title: string; body: string | null; data: { url?: string } | null; created_at: string; read_at: string | null; actor: ProfileRow | null };
    return (data as unknown as Row[]).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.data?.url ?? null,
      actor: n.actor ? toPerson(n.actor) : null,
      createdAt: n.created_at,
      readAt: n.read_at,
    }));
  },

  async markNotificationsRead() {
    const userId = await requireUserId();
    await getSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  },

  async getNotificationPreferences() {
    const userId = await requireUserId();
    const { data } = await getSupabase().from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
    const p: NotificationPreferences = {
      invites: data?.invites ?? true,
      responses: data?.responses ?? true,
      dateLocked: data?.date_locked ?? true,
      reminders: data?.reminders ?? true,
      groupNudges: data?.group_nudges ?? true,
    };
    return p;
  },

  async setNotificationPreferences(p) {
    const userId = await requireUserId();
    const { error } = await getSupabase()
      .from('notification_preferences')
      .update({ invites: p.invites, responses: p.responses, date_locked: p.dateLocked, reminders: p.reminders, group_nudges: p.groupNudges, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    fail(error);
  },

  async registerPushToken(token, platform) {
    const userId = await requireUserId();
    await getSupabase().from('push_tokens').upsert({ user_id: userId, token, platform, last_seen_at: new Date().toISOString() }, { onConflict: 'token' });
  },

  async listSponsored(placement, category) {
    let q = getSupabase().from('sponsored_placements').select('id, placement, sponsor_name, title, body, image_url, cta_label, cta_url').eq('placement', placement);
    if (category) q = q.or(`category.is.null,category.eq.${category}`);
    const { data } = await q.limit(3);
    return (data ?? []).map((s) => ({
      id: s.id,
      placement: s.placement,
      sponsorName: s.sponsor_name,
      title: s.title,
      body: s.body,
      imageUrl: s.image_url,
      ctaLabel: s.cta_label,
      ctaUrl: s.cta_url,
    }));
  },

  async exportMyData() {
    const me = await this.getMe();
    const [events, groups, notifications] = await Promise.all([this.listEvents(), this.listGroups(), this.listNotifications()]);
    return JSON.stringify({ exportedAt: new Date().toISOString(), profile: me, events, groups, notifications }, null, 2);
  },
};
