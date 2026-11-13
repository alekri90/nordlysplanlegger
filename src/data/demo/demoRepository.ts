import AsyncStorage from '@react-native-async-storage/async-storage';

import { periodLabelFor } from '@/lib/dates';
import { dateStatus } from '@/lib/roleRequest';
import { normalizeUsername, usernameFormatProblem } from '@/lib/username';
import type { ProfilePatch, Repository } from '../repository';
import type {
  AppNotification,
  KitRef,
  Discoverability,
  EventMember,
  EventMessage,
  FriendshipState,
  Group,
  GroupMember,
  GuestInvite,
  NotificationPreferences,
  Person,
  PersonResult,
  PlannerEvent,
  Profile,
  UsernameCheck,
} from '../types';
import { createSeed, ME, PEOPLE, STRANGERS, type DemoFriendship, type DemoState } from './seed';

/**
 * In-memory implementation used when no backend is configured.
 * Mirrors the database rules (visibility, friendships, roles, guest claiming) so the demo
 * behaves like production.
 */

const SIGNED_IN_KEY = 'demo.signedIn';
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

type DirectoryEntry = Person & { username: string; discoverability: Discoverability };
/** password is null for accounts created with an e-mail code. */
type Account = { email: string; password: string | null; profile: Profile };

let state: DemoState = createSeed();
let prefs: NotificationPreferences = { invites: true, responses: true, dateLocked: true, reminders: true, groupNudges: true };
/** Accounts created through sign-up in this session (Emma is always available). */
let accounts: Account[] = [];
/** Notifications per user. */
let inbox = new Map<string, AppNotification[]>([[ME.id, state.notifications]]);
/** Guest seats that answered from this device — the demo equivalent of the device secret. */
let deviceGuestIds: string[] = [];
/** Personal invite links for guests without an account. */
let personalInvites: { token: string; eventId: string; guestId: string }[] = [];
/** Organizer updates on events (mirrors event_messages); seenBy mirrors messages_seen_at. */
const messages: (Omit<EventMessage, 'seenCount' | 'recipientCount'> & { eventId: string; seenBy: string[] })[] = [
  {
    id: 'msg-badstu-1',
    eventId: 'ev-badstu',
    body: 'Husk håndkle og badetøy! Vi møtes ved inngangen kl. 17:50 🧖‍♀️',
    createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    author: { id: ME.id, name: ME.name, avatarUrl: ME.avatarUrl },
    seenBy: ['u-maja', 'u-sofie', 'u-ida', 'u-nora'],
  },
];
/** People Emma has blocked (demo: only hides them from search and suggestions). */
const blockedIds = new Set<string>();
const authListeners = new Set<(p: Profile | null) => void>();
const friendListeners = new Set<() => void>();
let liveDemoPlayed = false;

/** Restore the demo session before anyone asks for it, so deep links don't bounce to welcome. */
const hydrated = AsyncStorage.getItem(SIGNED_IN_KEY)
  .then((v) => {
    if (v === '1') state.signedIn = true;
  })
  .catch(() => {});

function setSignedIn(v: boolean, profile?: Profile) {
  state.signedIn = v;
  if (profile) state.me = profile;
  AsyncStorage.setItem(SIGNED_IN_KEY, v ? '1' : '0').catch(() => {});
  authListeners.forEach((l) => l(v ? clone(state.me) : null));
}

const meId = () => state.me.id;

function notify(userId: string, n: Omit<AppNotification, 'id' | 'createdAt'>) {
  const list = inbox.get(userId) ?? [];
  list.unshift({ ...n, id: uid('n'), createdAt: now() });
  inbox.set(userId, list);
}

// ---------------------------------------------------------------------------
// Directory & social graph (mirrors can_view_profile, friendship_state, …)
// ---------------------------------------------------------------------------

function directory(): Map<string, DirectoryEntry> {
  const map = new Map<string, DirectoryEntry>();
  for (const p of Object.values(PEOPLE)) map.set(p.id, { ...p, username: p.username ?? p.id, discoverability: 'everyone' });
  for (const p of STRANGERS) map.set(p.id, p);
  for (const a of accounts) map.set(a.profile.id, a.profile);
  map.set(state.me.id, state.me);
  return map;
}

function findFriendship(a: string, b: string): DemoFriendship | undefined {
  return state.friendships.find((f) => (f.requesterId === a && f.addresseeId === b) || (f.requesterId === b && f.addresseeId === a));
}

function friendIds(id: string): string[] {
  return state.friendships
    .filter((f) => f.status === 'accepted' && (f.requesterId === id || f.addresseeId === id))
    .map((f) => (f.requesterId === id ? f.addresseeId : f.requesterId));
}

const isFriend = (a: string, b: string) => findFriendship(a, b)?.status === 'accepted';
const mutualFriends = (a: string, b: string) => friendIds(a).filter((x) => friendIds(b).includes(x));
const userMemberIds = (g: Group) => g.members.filter((m) => !m.isGuest).map((m) => m.id);
const mutualGroups = (a: string, b: string) => state.groups.filter((g) => userMemberIds(g).includes(a) && userMemberIds(g).includes(b));

function sharesContext(a: string, b: string): boolean {
  if (a === b) return true;
  const inEvent = state.events.some((e) => e.members.some((m) => m.userId === a) && e.members.some((m) => m.userId === b));
  return inEvent || mutualGroups(a, b).length > 0;
}

function canView(target: string): boolean {
  const p = directory().get(target);
  if (!p) return false;
  if (!state.signedIn) return p.discoverability === 'everyone';
  const me = meId();
  if (target === me || sharesContext(me, target)) return true;
  const f = findFriendship(me, target);
  if (f && f.status !== 'declined') return true;
  if (p.discoverability === 'everyone') return true;
  if (p.discoverability === 'friends_of_friends') return mutualFriends(me, target).length > 0;
  return false;
}

function friendshipState(other: string): FriendshipState {
  if (!state.signedIn) return 'anonymous';
  const me = meId();
  if (other === me) return 'self';
  const f = findFriendship(me, other);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  if (f.requesterId === me) return 'outgoing'; // a declined request still looks pending to the sender
  return f.status === 'pending' ? 'incoming' : 'none';
}

function contextLabel(other: string): string | null {
  const me = meId();
  const event = state.events
    .filter((e) => e.status !== 'cancelled' && e.members.some((m) => m.userId === me) && e.members.some((m) => m.userId === other))
    .sort((a, b) => (b.selectedDate ?? b.createdAt).localeCompare(a.selectedDate ?? a.createdAt))[0];
  if (event) return `Dere var sammen på ${event.title}`;
  const group = mutualGroups(me, other)[0];
  return group ? `Dere er begge i ${group.name}` : null;
}

function toResult(p: DirectoryEntry): PersonResult {
  return {
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    username: p.username,
    friendship: friendshipState(p.id),
    mutualFriends: mutualFriends(meId(), p.id).length,
    mutualGroups: mutualGroups(meId(), p.id).length,
    context: contextLabel(p.id),
  };
}

/** Whoever is "me" right now, with current name/photo, wherever they appear. */
function freshPerson<T extends Person>(p: T): T {
  if (p.id !== state.me.id) return p;
  return { ...p, name: state.me.name, avatarUrl: state.me.avatarUrl, username: state.me.username };
}

function presentEvent(e: PlannerEvent): PlannerEvent {
  const c = clone(e);
  c.organizer = freshPerson(c.organizer);
  c.members = c.members.map((m) => ({ ...m, person: freshPerson(m.person) }));
  c.activityRole = e.activityType ? demoActivityRole(e, e.organizer.id === meId() || !!e.members.find((m) => m.userId === meId())?.isCohost) : null;
  return c;
}

// --- Activity types: venues and role requests (mirrors role_requests in the database) ---
type DemoRoleRequest = import('../types').RoleRequest & { organizerId: string };
const roleRequests: DemoRoleRequest[] = [];
const venues: (import('../types').Venue & { ownerId: string })[] = [];

function demoSyncCancelled(r: DemoRoleRequest) {
  for (const d of r.dates) {
    const e = d.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
    d.eventCancelled = e?.status === 'cancelled';
    d.theme = e?.activityTheme ?? null;
  }
}

/** Someone else than the organizer is invited (then the event is not held back any more). */
const demoHasGuests = (e: PlannerEvent | undefined) => !!e && e.members.some((m) => m.role !== 'organizer');

/** Like is_role_holder(): I have the role on this event. */
function demoIsRoleHolder(e: PlannerEvent) {
  return roleRequests.some(
    (r) => r.status === 'open' && r.dates.some((d) => d.eventId === e.id && r.candidates.some((c) => c.id === d.assignedCandidateId && !!c.userId && c.userId === meId())),
  );
}

/** Give or take the role on a date; the title follows («Aufguss» ⇄ «Aufguss med Ola»). */
function demoSetAssigned(r: DemoRoleRequest, d: import('../types').RoleRequestDate, candidateId: string | null) {
  d.assignedCandidateId = candidateId;
  const e = r.mode === 'each' && d.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
  if (e && (e.title === r.title || e.title.startsWith(`${r.title} med `))) {
    const name = r.candidates.find((c) => c.id === candidateId)?.name.split(' ')[0];
    e.title = name ? `${r.title} med ${name}` : r.title;
  }
  if (candidateId) demoRoleAssigned(r, d);
}

/** The role on an event, like activity_role() in the database. */
function demoActivityRole(e: PlannerEvent, organizer: boolean): import('../types').EventActivityRole | null {
  const r = roleRequests.find((x) => x.status === 'open' && x.dates.some((d) => d.eventId === e.id));
  if (!r) return null;
  demoSyncCancelled(r);
  const ds = r.dates
    .filter((d) => d.eventId === e.id)
    .map((d) => ({ date: d.date, status: dateStatus(d), name: r.candidates.find((c) => c.id === d.assignedCandidateId)?.name.split(' ')[0] ?? null }));
  const chosen = ds.find((d) => d.date === e.selectedDate) ?? (ds.length === 1 ? ds[0] : null);
  const mine = r.dates.filter((d) => d.eventId === e.id).map((d) => r.candidates.find((c) => c.id === d.assignedCandidateId)).find((c) => !!c?.userId && c.userId === meId());
  return {
    roleLabel: r.roleLabel,
    requestId: organizer ? r.id : null,
    status: chosen ? chosen.status : ds.some((d) => d.status === 'confirmed') ? 'partly' : 'pending',
    name: chosen?.name ?? null,
    hold: r.dates.filter((d) => d.eventId === e.id).every((d) => !d.inviteNow) && !ds.some((d) => d.status === 'confirmed') && !demoHasGuests(e),
    mine: !!mine,
    token: mine?.token ?? null,
    dates: ds,
  };
}

function demoRoleAssigned(r: DemoRoleRequest, d: import('../types').RoleRequestDate) {
  const c = r.candidates.find((x) => x.id === d.assignedCandidateId);
  if (!c) return;
  const day = d.date.slice(8, 10) + '.' + d.date.slice(5, 7);
  const e = r.mode === 'each' && d.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
  if (c.userId && c.userId !== r.organizerId) {
    notify(c.userId, { type: 'event_updated', title: `Du er ${r.roleLabel} ${day}`, body: `${e?.title ?? r.title} ligger nå i kalenderen din i appen.`, url: e ? `/event/${e.id}` : `/r/${c.token}` });
  }
  for (const m of e?.members ?? []) {
    if (m.userId && m.role !== 'organizer' && m.status !== 'declined') {
      notify(m.userId, { type: 'event_updated', title: `${e!.title} ${day} er bekreftet`, body: `${r.roleLabel[0].toUpperCase()}${r.roleLabel.slice(1)} er klar: ${c.name.split(' ')[0]}.`, url: `/event/${e!.id}` });
    }
  }
}

function demoCandidates(r: DemoRoleRequest, input: { userId?: string | null; name: string }[], dateIds: string[]) {
  const out: import('../types').CreatedRoleRequest['candidates'] = [];
  const myName = state.me.name.split(' ')[0];
  for (const p of input) {
    if (p.userId && !isFriend(meId(), p.userId)) {
      throw new Error('not_friend');
    }
    const name = (p.userId ? p.name.trim() || directory().get(p.userId)?.name : p.name.trim()) || '';
    if (!name) throw new Error('name_required');
    let c = p.userId ? r.candidates.find((x) => x.userId === p.userId) : undefined;
    if (!c) {
      c = { id: uid('cand'), userId: p.userId ?? null, name, token: uid('rolle'), reply: null, answeredAt: null };
      r.candidates.push(c);
    }
    for (const d of r.dates) if (dateIds.includes(d.id) && !d.answers.some((a) => a.candidateId === c!.id)) d.answers.push({ candidateId: c.id, answer: null });
    if (c.userId) notify(c.userId, { type: 'invited', title: `${myName} spør om du kan være ${r.roleLabel}`, body: `${r.title} · ${dateIds.length} ${dateIds.length === 1 ? 'dato' : 'datoer'} å se på`, url: `/r/${c.token}` });
    out.push({ id: c.id, userId: c.userId, name: c.name, token: c.token });
  }
  return out;
}

function presentGroup(g: Group): Group {
  const c = clone(g);
  c.members = c.members.map(freshPerson);
  c.myRole = c.members.find((m) => m.id === meId())?.role ?? null;
  return c;
}

const isMemberOf = (e: PlannerEvent) => e.organizer.id === meId() || e.members.some((m) => m.userId === meId());

// ---------------------------------------------------------------------------
// Events & groups helpers
// ---------------------------------------------------------------------------

/** Demo copy of the server's rule: people coming, plus the organizer side who always have a place. */
function demoPlacesTaken(e: PlannerEvent): number | null {
  if (!e.maxParticipants) return null;
  return e.members.filter((m) => m.status !== 'declined' && (m.status === 'attending' || m.role === 'organizer' || m.isCohost)).length;
}

/** A place came free: the first on the waiting list gets it. */
function demoPromote(e: PlannerEvent) {
  if (!e.maxParticipants) return;
  for (;;) {
    if ((demoPlacesTaken(e) ?? 0) >= e.maxParticipants) break;
    const next = e.members.filter((m) => m.status === 'waitlisted').sort((a, b) => (a.waitlistedAt ?? '').localeCompare(b.waitlistedAt ?? ''))[0];
    if (!next) break;
    next.status = 'attending';
    next.waitlistedAt = null;
  }
  demoRecount(e);
}

/** Places taken, and with a price who pays a share — the server counts these as computed fields. */
function demoRecount(e: PlannerEvent) {
  e.placesTaken = demoPlacesTaken(e);
  const placed = e.members.filter((m) => m.status !== 'declined' && (m.status === 'attending' || m.role === 'organizer' || m.isCohost));
  e.payingPlaces = e.price ? placed.filter((m) => m.paysShare !== false).length : null;
  e.nonPayingPlaces = e.price ? placed.filter((m) => m.paysShare === false).length : null;
}

type DemoClearance = import('../types').DateClearance & { organizerId: string };
const clearances: DemoClearance[] = [];

const seriesPeople = new Map<string, import('../types').SeriesPeople>();
const eventReserved = new Map<string, string[]>();
let demoPhone: import('../types').MyPhone = { phone: null, discoverable: true };

function findEvent(id: string) {
  const e = state.events.find((x) => x.id === id);
  if (!e) throw new Error('Fant ikke arrangementet');
  return e;
}

function findGroup(id: string) {
  const g = state.groups.find((x) => x.id === id);
  if (!g) throw new Error('Fant ikke gjengen');
  return g;
}

/**
 * Demo group links are readable (`<groupId>~<memberId>`) so they survive a reload; the real ones
 * are random. A link works while the member who shared it is still in the group.
 */
function resolveGroupInvite(token: string): { g: Group; inviter: GroupMember } | null {
  const [groupId, createdBy] = token.split('~');
  const g = state.groups.find((x) => x.id === groupId);
  const inviter = g?.members.find((m) => m.id === createdBy && !m.isGuest);
  return g && inviter ? { g, inviter } : null;
}

/** Resolves a public or personal invite link. */
function resolveToken(token: string): { event: PlannerEvent; guestId: string | null } | null {
  const personal = personalInvites.find((i) => i.token === token);
  if (personal) {
    const event = state.events.find((e) => e.id === personal.eventId);
    return event ? { event, guestId: personal.guestId } : null;
  }
  const event = state.events.find((x) => x.inviteToken === token);
  return event ? { event, guestId: null } : null;
}

/** The person answering an invitation: me when signed in, the personal guest seat, or this device's guest. */
function viewerMember(e: PlannerEvent, personalGuestId: string | null): EventMember | undefined {
  if (state.signedIn) {
    const mine = e.members.find((m) => m.userId === meId());
    if (mine) return mine;
  }
  if (personalGuestId) return e.members.find((m) => m.person.id === personalGuestId && !m.userId);
  return e.members.find((m) => !m.userId && deviceGuestIds.includes(m.person.id));
}

// --- Activity kits: diets, bring list, rides, poker (in memory, per event) ---
type DemoKit = {
  diets: Map<string, string>;
  bring: { id: string; label: string; claimedBy: string | null; addedBy: string | null }[];
  rides: { id: string; driverId: string; seats: number; from: string | null; passengers: string[] }[];
  poker: Map<string, { buyIns: number; cashOutOre: number | null }>;
};
const kits = new Map<string, DemoKit>();
const kitOf = (eventId: string): DemoKit => {
  let k = kits.get(eventId);
  if (!k) kits.set(eventId, (k = { diets: new Map(), bring: [], rides: [], poker: new Map() }));
  return k;
};

/** The event and who is asking, by id (signed in) or by invite link. */
function kitResolve(ref: KitRef): { e: PlannerEvent; me: EventMember | undefined; org: boolean } {
  const found = ref.token ? resolveToken(ref.token) : null;
  const e = found?.event ?? (ref.eventId ? findEvent(ref.eventId) : undefined);
  if (!e) throw new Error('not_found');
  const me = found ? viewerMember(e, found.guestId) : e.members.find((m) => m.userId === meId());
  const org = state.signedIn && (e.organizer.id === meId() || e.members.some((m) => m.userId === meId() && m.isCohost));
  return { e, me, org };
}

const kitFirst = (e: PlannerEvent, memberId: string | null) => {
  const m = memberId ? e.members.find((x) => x.id === memberId) : undefined;
  return m ? m.person.name.split(' ')[0] : 'Gjest';
};

function refreshGroupRefs() {
  for (const g of state.groups) {
    const evs = state.events.filter((e) => e.groupId === g.id);
    const ref = (e: PlannerEvent) => ({ id: e.id, title: e.title, date: e.selectedDate ?? null, status: e.status });
    const upcoming = evs.filter((e) => ['draft', 'polling', 'date_selected', 'confirmed'].includes(e.status));
    const past = evs.filter((e) => e.status === 'completed').sort((a, b) => ((a.selectedDate ?? '') < (b.selectedDate ?? '') ? 1 : -1));
    g.nextEvent = upcoming[0] ? ref(upcoming[0]) : null;
    g.lastEvent = past[0] ? ref(past[0]) : null;
    g.pastEvents = past.map(ref);
  }
}

const canAddPerson = (id: string) => id === meId() || isFriend(meId(), id) || sharesContext(meId(), id);

function knownGuest(id: string): GroupMember | undefined {
  for (const g of state.groups) {
    const m = g.members.find((x) => x.id === id && x.isGuest);
    if (m && userMemberIds(g).includes(meId())) return m;
  }
  for (const e of state.events) {
    const m = e.members.find((x) => x.person.id === id && !x.userId);
    if (m && isMemberOf(e)) return { ...m.person, isGuest: true, memberId: m.id, role: 'member' };
  }
  return undefined;
}

/** Moves a guest seat's history to the signed-in user. Mirrors merge_guest_into_user. */
function mergeGuest(guestId: string): { events: number; groups: number } {
  const me = state.me;
  let events = 0;
  let groups = 0;
  for (const e of state.events) {
    const seat = e.members.find((m) => m.person.id === guestId && !m.userId);
    if (!seat) continue;
    if (e.members.some((m) => m.userId === me.id)) {
      e.members = e.members.filter((m) => m !== seat);
    } else {
      seat.userId = me.id;
      seat.person = { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username };
    }
    events++;
  }
  for (const g of state.groups) {
    const idx = g.members.findIndex((m) => m.id === guestId && m.isGuest);
    if (idx < 0) continue;
    if (g.members.some((m) => m.id === me.id)) g.members.splice(idx, 1);
    else g.members[idx] = { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username, memberId: g.members[idx].memberId, role: g.members[idx].role };
    groups++;
  }
  personalInvites = personalInvites.filter((i) => i.guestId !== guestId);
  deviceGuestIds = deviceGuestIds.filter((x) => x !== guestId);
  return { events, groups };
}

function addGuestToEvent(e: PlannerEvent, guestId: string, name: string): GuestInvite {
  if (!e.members.some((m) => m.person.id === guestId)) {
    e.members.push({ id: uid('m'), person: { id: guestId, name, isGuest: true }, userId: null, role: 'guest', status: 'invited', unavailableOptionIds: [] });
  }
  let invite = personalInvites.find((i) => i.eventId === e.id && i.guestId === guestId);
  if (!invite) {
    invite = { token: uid('p'), eventId: e.id, guestId };
    personalInvites.push(invite);
  }
  return { guestId, name, token: invite.token };
}

function checkUsernameSync(username: string, displayName?: string): UsernameCheck {
  const normalized = normalizeUsername(username);
  const taken = (u: string) => [...directory().values()].some((p) => p.id !== meId() && normalizeUsername(p.username) === u);
  const problem = usernameFormatProblem(normalized);
  if (!problem && !taken(normalized)) return { normalized, available: true, reason: null, suggestions: [] };
  const words = (displayName ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const slug = (s: string) => s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9_.]/g, '');
  const first = slug(words[0] ?? normalized);
  const last = words.length > 1 ? slug(words[words.length - 1]) : '';
  const base = slug(normalized) || first;
  const candidates = [base + last.slice(0, 1), first.slice(0, 4) + last.slice(0, 1), base + (10 + Math.floor(Math.random() * 89)), `${first}.${last}`, `${base}_`, base + last.slice(0, 3)];
  const suggestions = [...new Set(candidates.map((c) => c.slice(0, 24)))].filter((c) => c !== normalized && !usernameFormatProblem(c) && !taken(c)).slice(0, 3);
  return { normalized, available: false, reason: problem ?? 'taken', suggestions };
}

// ---------------------------------------------------------------------------

export const demoRepository: Repository = {
  kind: 'demo',

  async getMe() {
    await hydrated;
    await wait(50);
    return state.signedIn ? clone(state.me) : null;
  },

  onAuthChange(cb) {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },

  async sendOtp() {
    await wait(600);
  },

  async verifyOtp(target, code) {
    await wait(600);
    if (code.length < 6) throw new Error('Koden har 6–8 sifre');
    // Demo: a known e-mail signs in to that profile; any other e-mail signs in as Emma.
    const account = accounts.find((a) => a.email === target.email.trim().toLowerCase());
    setSignedIn(true, account?.profile ?? { ...ME });
  },

  async signUp(input) {
    await wait(700);
    const email = input.email.trim().toLowerCase();
    if (accounts.some((a) => a.email === email) || email === ME.email) throw new Error('Det finnes allerede en konto med denne e-posten');
    const check = checkUsernameSync(input.username, input.displayName);
    if (!check.available) throw new Error(`@${check.normalized} er opptatt`);
    const profile: Profile = {
      id: uid('u'),
      name: input.displayName.trim(),
      username: input.username.trim().replace(/^@+/, ''),
      avatarUrl: null,
      bio: null,
      discoverability: 'everyone',
      onboarded: true,
      tier: 'free',
      email,
    };
    // Signed in by verifyOtp with the e-mailed code.
    accounts.push({ email, password: null, profile });
  },

  async signInWithPassword(email, password) {
    await wait(500);
    const account = accounts.find((a) => a.email === email.trim().toLowerCase());
    if (account && account.password !== password) throw new Error('Feil e-post eller passord');
    // Demo: any other e-mail signs in as Emma.
    setSignedIn(true, account?.profile ?? { ...ME });
  },

  async signOut() {
    await wait(200);
    setSignedIn(false);
  },

  async deleteAccount() {
    await wait(600);
    state = createSeed();
    accounts = [];
    inbox = new Map([[ME.id, state.notifications]]);
    deviceGuestIds = [];
    personalInvites = [];
    setSignedIn(false);
  },

  async updateProfile(patch: ProfilePatch) {
    await wait();
    if (patch.username !== undefined) {
      const check = checkUsernameSync(patch.username, patch.name ?? state.me.name);
      if (!check.available) throw new Error(check.reason === 'taken' ? `@${check.normalized} er opptatt` : 'Ugyldig brukernavn');
      state.me.username = patch.username.trim().replace(/^@+/, '');
    }
    if (patch.name !== undefined) state.me.name = patch.name.trim();
    if (patch.avatarUri !== undefined) state.me.avatarUrl = patch.avatarUri;
    if (patch.bio !== undefined) state.me.bio = patch.bio;
    if (patch.discoverability !== undefined) state.me.discoverability = patch.discoverability;
    if (patch.onboarded) state.me.onboarded = true;
    const account = accounts.find((a) => a.profile.id === state.me.id);
    if (account) account.profile = state.me;
    return clone(state.me);
  },

  async checkUsername(username, displayName) {
    await wait(180);
    return checkUsernameSync(username, displayName);
  },

  async claimGuest(opts) {
    await wait(300);
    if (!state.signedIn) return { events: 0, groups: 0 };
    const total = { events: 0, groups: 0 };
    const ids = new Set(deviceGuestIds);
    const personal = opts?.inviteToken ? personalInvites.find((i) => i.token === opts.inviteToken) : undefined;
    if (personal) ids.add(personal.guestId);
    for (const id of ids) {
      const r = mergeGuest(id);
      total.events += r.events;
      total.groups += r.groups;
    }
    state.guestName = null;
    refreshGroupRefs();
    return total;
  },

  async listEvents() {
    await wait();
    return state.events.filter((e) => e.status !== 'cancelled' && (isMemberOf(e) || demoIsRoleHolder(e))).map(presentEvent);
  },

  async getEvent(id) {
    await wait(160);
    return presentEvent(findEvent(id));
  },

  async createEvent(input) {
    await wait(650);
    const id = uid('ev');
    const token = uid('t');
    let groupId = input.groupId ?? null;
    const dir = directory();
    const people = [...new Set(input.memberIds)]
      .filter((pid) => pid !== meId() && canAddPerson(pid))
      .map((pid) => dir.get(pid))
      .filter((p): p is DirectoryEntry => !!p);

    if (!groupId && input.saveAsGroupName) {
      const g = await this.createGroup({ name: input.saveAsGroupName, coverImageUrl: input.coverImageUrl, userIds: people.map((p) => p.id), guestIds: input.guestIds });
      const stored = findGroup(g.id);
      stored.defaults = { title: input.title, category: input.category, timeHint: input.timeHint, startTime: input.startTime ?? null };
      groupId = g.id;
    }

    const options = input.dateMode === 'poll' ? [...input.optionDates].sort().map((date) => ({ id: uid('o'), date })) : [];
    const fixed = input.dateMode === 'fixed';
    const me = state.me;
    const event: PlannerEvent = {
      id,
      title: input.title,
      category: input.category,
      coverImageUrl: input.coverImageUrl,
      status: fixed ? 'confirmed' : input.dateMode === 'poll' ? 'polling' : 'draft',
      dateMode: input.dateMode,
      spontaneous: !!input.spontaneous,
      organizer: { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username },
      groupId,
      periodLabel: input.periodLabel ?? periodLabelFor(input.optionDates),
      timeHint: input.timeHint,
      startTime: input.startTime ?? null,
      selectedDate: fixed ? input.fixedDate ?? null : null,
      location: input.location ?? null,
      description: input.description ?? null,
      options,
      members: [
        { id: uid('m'), person: { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username }, userId: me.id, role: 'organizer', status: fixed ? 'attending' : 'responded', unavailableOptionIds: [], respondedAt: now() },
        ...people.map<EventMember>((p) => ({ id: uid('m'), person: { id: p.id, name: p.name, avatarUrl: p.avatarUrl, username: p.username }, userId: p.id, role: 'guest', status: 'invited', unavailableOptionIds: [] })),
      ],
      inviteToken: token,
      photos: [],
      createdAt: now(),
      lockedAt: fixed ? now() : null,
    };
    state.events.unshift(event);

    const guests: GuestInvite[] = [];
    for (const gid of input.guestIds ?? []) {
      const g = knownGuest(gid);
      if (g) guests.push(addGuestToEvent(event, g.id, g.name));
    }
    for (const name of input.guestNames ?? []) {
      if (name.trim()) guests.push(addGuestToEvent(event, uid('guest'), name.trim().slice(0, 60)));
    }
    refreshGroupRefs();
    return { eventId: id, inviteToken: token, groupId, guests };
  },

  async updateEvent(id, patch) {
    await wait();
    const e = findEvent(id);
    Object.assign(e, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.startTime !== undefined && { startTime: patch.startTime }),
      ...(patch.timeHint !== undefined && { timeHint: patch.timeHint }),
      ...(patch.location !== undefined && { location: patch.location }),
      ...(patch.coverImageUrl !== undefined && { coverImageUrl: patch.coverImageUrl }),
      ...(patch.maxParticipants !== undefined && { maxParticipants: patch.maxParticipants }),
      ...(patch.guestsCanInvite !== undefined && { guestsCanInvite: patch.guestsCanInvite }),
      ...(patch.price !== undefined && { price: patch.price }),
      ...(patch.activityType !== undefined && { activityType: patch.activityType }),
      ...(patch.rolePlaces !== undefined && { rolePlaces: patch.rolePlaces }),
      ...(patch.venueCapacity !== undefined && { venueCapacity: patch.venueCapacity }),
    });
    if (e.activityType && e.venueCapacity && e.maxParticipants && e.maxParticipants + (e.rolePlaces ?? 0) > e.venueCapacity) {
      throw new Error(`Det er bare plass til ${e.venueCapacity} totalt`);
    }
    demoPromote(e);
    demoRecount(e);
  },

  async lockDate(eventId, optionId) {
    await wait(500);
    const e = findEvent(eventId);
    const option = e.options.find((o) => o.id === optionId);
    if (!option) throw new Error('Fant ikke datoen');
    e.status = 'confirmed';
    e.selectedOptionId = optionId;
    e.selectedDate = option.date;
    e.lockedAt = now();
    if (e.timeHint === 'evening' && !e.startTime) e.startTime = '18:00';
    for (const m of e.members) {
      if (m.role === 'organizer' || m.status === 'responded') {
        m.status = m.unavailableOptionIds.includes(optionId) ? 'declined' : 'attending';
      }
    }
    refreshGroupRefs();
  },

  async startPoll(eventId, optionDates) {
    await wait(400);
    const e = findEvent(eventId);
    e.options = [...optionDates].sort().map((date) => ({ id: uid('o'), date }));
    e.status = 'polling';
    e.dateMode = 'poll';
    e.periodLabel = periodLabelFor(optionDates);
    // «Jeg er med» still has to answer the dates; «Ikke denne gangen» stays out.
    for (const m of e.members) if (m.role === 'guest' && m.status === 'attending') m.status = 'invited';
    refreshGroupRefs();
  },

  async setRsvp(eventId, attending) {
    await wait();
    const e = findEvent(eventId);
    const m = e.members.find((x) => x.userId === meId());
    if (m) {
      const wasComing = m.status === 'attending';
      const full = !!e.maxParticipants && (e.status === 'confirmed' || e.status === 'date_selected') && (demoPlacesTaken(e) ?? 0) >= e.maxParticipants;
      m.status = attending ? (full && !wasComing && m.role !== 'organizer' && !m.isCohost ? 'waitlisted' : 'attending') : 'declined';
      m.waitlistedAt = m.status === 'waitlisted' ? now() : null;
      m.respondedAt = now();
      m.answerSetBy = null;
      if (wasComing && !attending) demoPromote(e);
      demoRecount(e);
    }
  },

  async cancelEvent(eventId) {
    await wait();
    findEvent(eventId).status = 'cancelled';
    refreshGroupRefs();
  },

  async createEventSeries(eventId, config) {
    await wait(200);
    const e = findEvent(eventId);
    if (e.organizer.id !== meId()) throw new Error('Bare arrangøren kan gjenta arrangementet');
    // Demo: the series is shown on the event; new rounds are made by the server job in production.
    e.series = { ...config, id: uid('series'), status: 'active' };
    return e.series.id;
  },

  async setSeriesPeople(seriesId, people) {
    await wait(200);
    seriesPeople.set(seriesId, people);
    for (const e of state.events) {
      if (e.series?.id !== seriesId) continue;
      e.maxParticipants = people.maxParticipants;
      for (const m of e.members) m.isCohost = !!m.userId && people.cohostIds.includes(m.userId);
      demoRecount(e);
    }
  },

  async getSeriesPeople(seriesId) {
    await wait(100);
    return seriesPeople.get(seriesId) ?? { cohostIds: [], reservedIds: [], maxParticipants: null };
  },

  async remindPending(eventId) {
    await wait(300);
    const pending = findEvent(eventId).members.filter((m) => m.role === 'guest' && (m.status === 'invited' || m.status === 'opened'));
    return { sent: pending.filter((m) => m.userId).length, withoutAccount: pending.filter((m) => !m.userId).length };
  },

  async addEventMembers(eventId, userIds) {
    await wait(300);
    const e = findEvent(eventId);
    const dir = directory();
    let added = 0;
    for (const id of new Set(userIds)) {
      const p = dir.get(id);
      if (!p || id === meId() || !canAddPerson(id) || e.members.some((m) => m.userId === id)) continue;
      e.members.push({ id: uid('m'), person: { id: p.id, name: p.name, avatarUrl: p.avatarUrl, username: p.username }, userId: p.id, role: 'guest', status: 'invited', unavailableOptionIds: [] });
      added++;
    }
    return added;
  },

  async addEventGuests(eventId, names, guests = []) {
    await wait(200);
    const e = findEvent(eventId);
    return [...guests.map((g) => addGuestToEvent(e, g.guestId, g.name)), ...names.map((name) => addGuestToEvent(e, uid('guest'), name.trim().slice(0, 60)))];
  },

  async markEventOpened(eventId) {
    const mine = findEvent(eventId).members.find((m) => m.userId === meId());
    if (mine?.status === 'invited') mine.status = 'opened';
  },

  async removeEventMember(memberId) {
    await wait(200);
    for (const e of state.events) {
      const was = e.members.find((m) => m.id === memberId);
      if (!was) continue;
      e.members = e.members.filter((m) => m.id !== memberId);
      if (was.status === 'attending') demoPromote(e);
      demoRecount(e);
    }
  },

  async setMemberAnswer(memberId, status) {
    await wait(200);
    const e = state.events.find((x) => x.members.some((m) => m.id === memberId));
    const m = e?.members.find((x) => x.id === memberId);
    if (!e || !m || m.role === 'organizer') throw new Error('member_not_found');
    const wasPlaced = m.status === 'attending';
    const full = !!e.maxParticipants && (demoPlacesTaken(e) ?? 0) >= e.maxParticipants;
    m.status = status === 'attending' && full && !wasPlaced && !m.isCohost ? 'waitlisted' : status;
    m.waitlistedAt = m.status === 'waitlisted' ? now() : null;
    m.respondedAt = status === 'invited' ? null : now();
    m.answerSetBy = status === 'invited' ? null : freshPerson(e.organizer).name.split(' ')[0];
    if (wasPlaced && m.status !== 'attending') demoPromote(e);
    demoRecount(e);
    return m.status;
  },

  async setMemberPaysShare(memberId, paysShare) {
    await wait(150);
    for (const e of state.events) {
      const m = e.members.find((x) => x.id === memberId);
      if (!m) continue;
      m.paysShare = paysShare;
      demoRecount(e);
    }
  },

  async getEventPeople(eventId) {
    await wait(100);
    const e = findEvent(eventId);
    return { cohostIds: e.members.filter((m) => m.isCohost && m.userId).map((m) => m.userId!), reservedIds: eventReserved.get(eventId) ?? [] };
  },

  async setEventPeople(eventId, people) {
    await wait(200);
    const e = findEvent(eventId);
    for (const m of e.members) m.isCohost = !!m.userId && people.cohostIds.includes(m.userId);
    eventReserved.set(eventId, people.reservedIds);
    demoRecount(e);
  },

  async setSeriesCover(seriesId, coverImageUrl, eventId) {
    await wait(200);
    // Demo: only the round you're looking at; the server also updates the coming rounds.
    findEvent(eventId).coverImageUrl = coverImageUrl;
    void seriesId;
  },

  async updateEventSeries(seriesId, patch) {
    await wait(200);
    for (const e of state.events) if (e.series?.id === seriesId) e.series = { ...e.series, ...patch };
  },

  async listEventMessages(eventId) {
    await wait(150);
    const e = findEvent(eventId);
    if (!isMemberOf(e)) return [];
    const others = e.members.filter((m) => m.userId && m.userId !== e.organizer.id && m.status !== 'declined');
    return clone(messages.filter((m) => m.eventId === eventId))
      .reverse()
      .map(({ eventId: _e, seenBy, ...m }) => ({
        ...m,
        author: freshPerson(m.author),
        seenCount: m.author.id === meId() ? others.filter((o) => seenBy.includes(o.userId!)).length : null,
        recipientCount: m.author.id === meId() ? others.length : null,
      }));
  },

  async postEventMessage(eventId, body) {
    await wait(300);
    const e = findEvent(eventId);
    if (e.organizer.id !== meId()) throw new Error('Bare arrangøren kan sende beskjeder');
    if (!body.trim()) throw new Error('Skriv en beskjed først');
    const me = state.me;
    messages.push({ id: uid('msg'), eventId, body: body.trim().slice(0, 1000), createdAt: now(), author: { id: me.id, name: me.name, avatarUrl: me.avatarUrl }, seenBy: [] });
  },

  async markEventMessagesSeen(eventId) {
    for (const m of messages) if (m.eventId === eventId && !m.seenBy.includes(meId())) m.seenBy.push(meId());
  },

  async addEventPhotos(eventId, uris) {
    await wait(500);
    const e = findEvent(eventId);
    if (!isMemberOf(e)) throw new Error('Du er ikke med på arrangementet');
    e.photos.push(...uris);
  },


  subscribeToEvent(eventId, onChange) {
    // Simulate a live answer arriving while the organizer looks at the results.
    if (eventId !== 'ev-poker' || liveDemoPlayed) return () => {};
    const timer = setTimeout(() => {
      const e = state.events.find((x) => x.id === eventId);
      const henrik = e?.members.find((m) => m.person.id === PEOPLE.henrik.id);
      if (!e || !henrik || henrik.status === 'responded') return;
      liveDemoPlayed = true;
      henrik.status = 'responded';
      henrik.respondedAt = now();
      henrik.unavailableOptionIds = [e.options[5]?.id, e.options[0]?.id].filter(Boolean) as string[];
      notify(e.organizer.id, { type: 'response_received', title: 'Henrik har svart på Kortkveld', body: '6 av 8 har svart', url: `/event/${eventId}`, actor: PEOPLE.henrik });
      onChange();
    }, 5000);
    return () => clearTimeout(timer);
  },

  async suggestInvitees(category, title) {
    await wait(120);
    const mine = state.groups.filter((g) => userMemberIds(g).includes(meId()));
    const t = (title ?? '').toLowerCase();
    const byTitle = t.length >= 3 ? mine.find((g) => t.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(t.split(' ')[0])) : undefined;
    const byCategory = category
      ? mine.find((g) => g.defaults.category === category || state.events.some((e) => e.groupId === g.id && e.category === category))
      : undefined;
    const counts = new Map<string, { person: Person; times: number }>();
    for (const e of state.events) {
      if (e.organizer.id !== meId() || e.status === 'cancelled' || (category && e.category !== category)) continue;
      for (const m of e.members) {
        if (!m.userId || m.userId === meId()) continue;
        const c = counts.get(m.userId) ?? { person: m.person, times: 0 };
        c.times++;
        counts.set(m.userId, c);
      }
    }
    const people = [...counts.values()]
      .filter((c) => c.times >= 2)
      .sort((a, b) => b.times - a.times)
      .slice(0, 8)
      .map((c) => ({ ...c.person, times: c.times }));
    return clone({ groupId: (byTitle ?? byCategory)?.id ?? null, people });
  },

  async createDateClearance(input) {
    await wait(300);
    const id = uid('cl');
    const key = input.keyUserId ? directory().get(input.keyUserId) : undefined;
    const c: DemoClearance = {
      id,
      token: uid('avklar'),
      organizerId: meId(),
      keyUserId: input.keyUserId ?? null,
      keyName: input.keyName.trim() || key?.name || 'Gjest',
      title: input.draft.title,
      note: input.note?.trim() || null,
      status: 'pending',
      reply: null,
      answeredAt: null,
      days: [...new Set(input.dates)].sort().map((date) => ({ date, ok: null })),
      draft: clone(input.draft),
      eventIds: [],
      createdAt: now(),
    };
    clearances.unshift(c);
    if (c.keyUserId) {
      notify(c.keyUserId, { type: 'invited', title: `${state.me.name.split(' ')[0]} lurer på hvilke dager som passer`, body: c.title, url: `/a/${c.token}` });
    }
    return { id, token: c.token };
  },

  async listDateClearances() {
    await wait(120);
    return clone(clearances.filter((c) => c.organizerId === meId() && c.status !== 'cancelled'));
  },

  async getDateClearance(id) {
    await wait(120);
    const c = clearances.find((x) => x.id === id && (x.organizerId === meId() || x.keyUserId === meId()));
    return c ? clone(c) : null;
  },

  async getClearanceByToken(token) {
    await wait(200);
    const c = clearances.find((x) => x.token === token && x.status !== 'cancelled');
    if (!c) return null;
    const organizer = freshPerson(directory().get(c.organizerId) ?? state.me);
    return clone({
      token,
      title: c.title,
      category: c.draft.category,
      coverImageUrl: c.draft.coverImageUrl,
      timeHint: c.draft.timeHint,
      startTime: c.draft.startTime ?? null,
      placeName: c.draft.location?.name ?? null,
      note: c.note,
      keyName: c.keyName,
      status: c.status,
      reply: c.reply,
      organizer: { name: organizer.name.split(' ')[0], avatarUrl: organizer.avatarUrl ?? null },
      days: c.days,
    });
  },

  async answerDateClearance(token, okDates, reply) {
    await wait(300);
    const c = clearances.find((x) => x.token === token && x.status !== 'cancelled');
    if (!c) throw new Error('not_found');
    if (c.status === 'done') throw new Error('already_done');
    for (const d of c.days) d.ok = okDates.includes(d.date);
    c.status = 'answered';
    c.answeredAt = now();
    c.reply = reply?.trim() || null;
    const ok = c.days.filter((d) => d.ok).length;
    notify(c.organizerId, {
      type: 'response_received',
      title: `${c.keyName.split(' ')[0]} har svart på ${c.title}`,
      body: ok === c.days.length ? 'Alle dagene passer.' : ok ? `${ok} av ${c.days.length} dager passer.` : 'Ingen av dagene passet.',
      url: `/avklaring/${c.id}`,
    });
  },

  async finishDateClearance(id, eventIds) {
    await wait(120);
    const c = clearances.find((x) => x.id === id && x.organizerId === meId());
    if (!c || c.status === 'done' || c.status === 'cancelled') throw new Error('not_found');
    c.status = 'done';
    c.eventIds = eventIds;
  },

  async cancelDateClearance(id) {
    await wait(120);
    const c = clearances.find((x) => x.id === id && x.organizerId === meId());
    if (!c || c.status === 'done' || c.status === 'cancelled') throw new Error('not_found');
    c.status = 'cancelled';
  },

  async listVenues(activityType) {
    await wait(100);
    return clone(venues.filter((v) => v.ownerId === meId() && v.activityType === activityType).sort((a, b) => a.name.localeCompare(b.name)).map(({ ownerId: _o, ...v }) => v));
  },

  async saveVenue(venue) {
    await wait(150);
    const name = venue.name.trim();
    let v = venues.find((x) => x.ownerId === meId() && (x.id === venue.id || (x.activityType === venue.activityType && x.name.toLowerCase() === name.toLowerCase())));
    if (v) Object.assign(v, { name, capacity: venue.capacity ?? null });
    else {
      v = { id: uid('venue'), ownerId: meId(), activityType: venue.activityType, name, capacity: venue.capacity ?? null };
      venues.push(v);
    }
    const { ownerId: _o, ...out } = v;
    return clone(out);
  },

  async deleteVenue(id) {
    await wait(100);
    const i = venues.findIndex((v) => v.id === id && v.ownerId === meId());
    if (i >= 0) venues.splice(i, 1);
  },

  async createRoleRequest(input) {
    await wait(250);
    if (!input.dates.length) throw new Error('bad_dates');
    if (!input.candidates.length) throw new Error('bad_candidates');
    const r: DemoRoleRequest = {
      id: uid('rr'),
      organizerId: meId(),
      activityType: input.activityType,
      roleKey: input.roleKey,
      roleLabel: input.roleLabel,
      title: input.title,
      timeHint: input.timeHint,
      startTime: input.startTime,
      placeName: input.placeName,
      note: input.note?.trim() || null,
      mode: input.mode,
      status: 'open',
      createdAt: now(),
      dates: [...input.dates]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((d) => ({ id: uid('rd'), date: d.date, eventId: d.eventId, assignedCandidateId: null, eventCancelled: false, inviteNow: d.inviteNow ?? true, theme: null, answers: [] })),
      candidates: [],
    };
    roleRequests.unshift(r);
    const candidates = demoCandidates(r, input.candidates, r.dates.map((d) => d.id));
    return { id: r.id, candidates };
  },

  async listRoleRequests() {
    await wait(120);
    const mine = roleRequests.filter((r) => r.organizerId === meId() && r.status === 'open');
    mine.forEach(demoSyncCancelled);
    return clone(mine.map(({ organizerId: _o, ...r }) => r));
  },

  async getRoleRequest(id) {
    await wait(120);
    const r = roleRequests.find((x) => x.id === id && x.organizerId === meId());
    if (!r) return null;
    demoSyncCancelled(r);
    const { organizerId: _o, ...out } = r;
    return clone(out);
  },

  async getRoleRequestByToken(token) {
    await wait(200);
    const r = roleRequests.find((x) => x.status === 'open' && x.candidates.some((c) => c.token === token));
    if (!r) return null;
    demoSyncCancelled(r);
    const c = r.candidates.find((x) => x.token === token)!;
    const organizer = freshPerson(directory().get(r.organizerId) ?? state.me);
    return clone({
      token,
      activityType: r.activityType,
      roleLabel: r.roleLabel,
      title: r.title,
      timeHint: r.timeHint,
      startTime: r.startTime,
      placeName: r.placeName,
      note: r.note,
      name: c.name,
      reply: c.reply,
      answeredAt: c.answeredAt,
      organizer: { name: organizer.name.split(' ')[0], avatarUrl: organizer.avatarUrl ?? null },
      dates: r.dates
        .filter((d) => d.answers.some((a) => a.candidateId === c.id))
        .map((d) => ({
          id: d.id,
          date: d.date,
          answer: d.answers.find((a) => a.candidateId === c.id)!.answer,
          mine: d.assignedCandidateId === c.id,
          taken: !!d.assignedCandidateId && d.assignedCandidateId !== c.id,
          cancelled: d.eventCancelled,
          theme: d.assignedCandidateId === c.id ? d.theme : null,
          eventId: d.assignedCandidateId === c.id && r.mode === 'each' && !!c.userId ? d.eventId : null,
        })),
    });
  },

  async answerRoleRequest(token, answers, reply) {
    await wait(300);
    const r = roleRequests.find((x) => x.status === 'open' && x.candidates.some((c) => c.token === token));
    if (!r) throw new Error('not_found');
    demoSyncCancelled(r);
    const c = r.candidates.find((x) => x.token === token)!;
    let dropped = 0;
    let got = 0;
    let ready = 0;
    for (const [dateId, answer] of Object.entries(answers)) {
      const d = r.dates.find((x) => x.id === dateId);
      const a = d?.answers.find((x) => x.candidateId === c.id);
      if (!d || !a || d.eventCancelled) continue;
      a.answer = answer;
      if (answer !== true && d.assignedCandidateId === c.id) {
        demoSetAssigned(r, d, null);
        dropped++;
      } else if (answer === true && !d.assignedCandidateId && d.answers.length === 1) {
        demoSetAssigned(r, d, c.id);
        got++;
        if (!d.inviteNow && !demoHasGuests(state.events.find((x) => x.id === d.eventId))) ready++;
      }
    }
    c.reply = reply?.trim() || null;
    c.answeredAt = now();
    const mine = r.dates.filter((d) => d.answers.some((a) => a.candidateId === c.id));
    const ok = mine.filter((d) => d.answers.find((a) => a.candidateId === c.id)?.answer === true).length;
    notify(r.organizerId, {
      type: 'response_received',
      title: `${c.name.split(' ')[0]} har svart på ${r.title}`,
      body: (ok === 0 ? 'Kan ingen av datoene.' : ok === mine.length ? 'Kan alle datoene.' : `Kan ${ok} av ${mine.length} datoer.`) +
        (got ? ` ${got} ${got === 1 ? 'dato er bekreftet.' : 'datoer er bekreftet.'}` : '') +
        (ready ? ' Du kan invitere deltagere nå.' : '') +
        (dropped ? ` Kan likevel ikke ${dropped} ${dropped === 1 ? 'dato' : 'datoer'} hen hadde.` : ''),
      url: `/rolle/${r.id}`,
    });
  },

  async assignRole(dateId, candidateId) {
    await wait(150);
    const r = roleRequests.find((x) => x.organizerId === meId() && x.status === 'open' && x.dates.some((d) => d.id === dateId));
    const d = r?.dates.find((x) => x.id === dateId);
    if (!r || !d) throw new Error('not_found');
    if (candidateId && !d.answers.some((a) => a.candidateId === candidateId && a.answer === true)) throw new Error('candidate_cannot');
    if (d.assignedCandidateId === candidateId) return;
    demoSetAssigned(r, d, candidateId);
  },

  async addRoleCandidates(requestId, candidates, dateIds) {
    await wait(200);
    const r = roleRequests.find((x) => x.id === requestId && x.organizerId === meId() && x.status === 'open');
    if (!r) throw new Error('not_found');
    const ids = dateIds.filter((id) => r.dates.some((d) => d.id === id));
    if (!ids.length) throw new Error('bad_dates');
    return { id: r.id, candidates: demoCandidates(r, candidates, ids) };
  },

  async cancelRoleRequest(id) {
    await wait(120);
    const r = roleRequests.find((x) => x.id === id && x.organizerId === meId() && x.status === 'open');
    if (!r) throw new Error('not_found');
    r.status = 'cancelled';
    // Events held back for it (nobody invited, never shown) go with it.
    for (const d of r.dates) {
      const e = d.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
      if (e && !d.inviteNow && !d.assignedCandidateId && !demoHasGuests(e)) e.status = 'cancelled';
    }
  },

  async setActivityTheme(eventId, theme) {
    await wait(150);
    const e = findEvent(eventId);
    if (!(e.organizer.id === meId() || e.members.some((m) => m.userId === meId() && m.isCohost) || demoIsRoleHolder(e))) throw new Error('not_allowed');
    e.activityTheme = theme?.trim() || null;
  },

  async setActivityDetails(eventId, type, details, bring) {
    await wait(150);
    const e = findEvent(eventId);
    if (e.organizer.id !== meId()) throw new Error('not_allowed');
    if (e.activityType && e.activityType !== type) throw new Error('type_locked');
    e.activityType = type;
    e.activityDetails = details;
    const k = kitOf(eventId);
    if (bring?.length && !k.bring.length) {
      for (const label of bring.map((b) => b.trim()).filter(Boolean)) k.bring.push({ id: uid('bring'), label, claimedBy: null, addedBy: null });
    }
  },

  async getEventKit(ref) {
    await wait(100);
    const { e, me, org } = kitResolve(ref);
    if (!ref.token && !me && !org) return null;
    const k = kitOf(e.id);
    return {
      me: me?.id ?? null,
      organizer: org,
      details: e.activityDetails ?? null,
      myDiet: me ? (k.diets.get(me.id) ?? null) : null,
      diets: org ? [...k.diets].map(([memberId, diet]) => ({ memberId, name: kitFirst(e, memberId), diet })).sort((a, b) => a.name.localeCompare(b.name)) : null,
      bring: k.bring.map((b) => ({ id: b.id, label: b.label, claimedBy: b.claimedBy ? kitFirst(e, b.claimedBy) : null, mine: !!me && b.claimedBy === me.id, addedByMe: !!me && b.addedBy === me.id })),
      rides: k.rides.map((r) => ({
        id: r.id,
        driver: kitFirst(e, r.driverId),
        mine: !!me && r.driverId === me.id,
        seats: r.seats,
        from: r.from,
        passengers: r.passengers.map((p) => kitFirst(e, p)),
        joined: !!me && r.passengers.includes(me.id),
      })),
      poker: me || org ? [...k.poker].map(([memberId, p]) => ({ memberId, name: kitFirst(e, memberId), buyIns: p.buyIns, cashOutOre: p.cashOutOre })).sort((a, b) => a.name.localeCompare(b.name)) : [],
    };
  },

  async kitSetDiet(ref, diet) {
    await wait(100);
    const { e, me } = kitResolve(ref);
    if (!me) throw new Error('not_member');
    const k = kitOf(e.id);
    if (diet?.trim()) k.diets.set(me.id, diet.trim().slice(0, 200));
    else k.diets.delete(me.id);
  },

  async kitBring(ref, action, input) {
    await wait(100);
    const { e, me, org } = kitResolve(ref);
    if (!me && !org) throw new Error('not_member');
    const k = kitOf(e.id);
    if (action === 'add') {
      const label = input.label?.trim();
      if (!label) throw new Error('bad_label');
      k.bring.push({ id: uid('bring'), label: label.slice(0, 80), claimedBy: org ? null : (me?.id ?? null), addedBy: me?.id ?? null });
      return;
    }
    const item = k.bring.find((b) => b.id === input.itemId);
    if (!item) throw new Error('not_found');
    if (action === 'claim') {
      if (!me) throw new Error('not_member');
      if (item.claimedBy && item.claimedBy !== me.id) throw new Error('taken');
      item.claimedBy = me.id;
    } else if (action === 'unclaim') {
      if (!(org || item.claimedBy === me?.id)) throw new Error('not_allowed');
      item.claimedBy = null;
    } else {
      if (!(org || (item.addedBy && item.addedBy === me?.id))) throw new Error('not_allowed');
      k.bring = k.bring.filter((b) => b.id !== item.id);
    }
  },

  async kitRide(ref, action, input) {
    await wait(100);
    const { e, me } = kitResolve(ref);
    if (!me) throw new Error('not_member');
    const k = kitOf(e.id);
    const leave = () => k.rides.forEach((r) => (r.passengers = r.passengers.filter((p) => p !== me.id)));
    if (action === 'offer') {
      if (!input.seats || input.seats < 1 || input.seats > 8) throw new Error('bad_seats');
      leave();
      const mine = k.rides.find((r) => r.driverId === me.id);
      if (mine && mine.passengers.length > input.seats) throw new Error('seats_taken');
      if (mine) Object.assign(mine, { seats: input.seats, from: input.from?.trim() || null });
      else k.rides.push({ id: uid('ride'), driverId: me.id, seats: input.seats, from: input.from?.trim() || null, passengers: [] });
    } else if (action === 'cancel') {
      k.rides = k.rides.filter((r) => r.driverId !== me.id);
    } else if (action === 'join') {
      const r = k.rides.find((x) => x.id === input.rideId);
      if (!r) throw new Error('not_found');
      if (r.driverId === me.id || k.rides.some((x) => x.driverId === me.id)) throw new Error('is_driver');
      if (r.passengers.filter((p) => p !== me.id).length >= r.seats) throw new Error('full');
      leave();
      r.passengers.push(me.id);
    } else {
      leave();
    }
  },

  async kitPokerSet(eventId, memberId, buyIns, cashOutOre) {
    await wait(100);
    const e = findEvent(eventId);
    if (e.organizer.id !== meId()) throw new Error('not_allowed');
    if (!e.members.some((m) => m.id === memberId)) throw new Error('not_found');
    const k = kitOf(eventId);
    if (buyIns === null) k.poker.delete(memberId);
    else k.poker.set(memberId, { buyIns, cashOutOre: cashOutOre ?? null });
  },

  async setRoleTheme(token, dateId, theme) {
    await wait(150);
    const r = roleRequests.find((x) => x.status === 'open' && x.candidates.some((c) => c.token === token));
    const c = r?.candidates.find((x) => x.token === token);
    const d = r?.dates.find((x) => x.id === dateId && x.assignedCandidateId === c?.id);
    const e = d?.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
    if (!e) throw new Error('not_found');
    e.activityTheme = theme?.trim() || null;
    notify(r!.organizerId, { type: 'event_updated', title: `${e.title} ${d!.date.slice(8, 10)}.${d!.date.slice(5, 7)} har fått tema`, body: e.activityTheme ?? '', url: `/event/${e.id}` });
  },

  async listMyRoleRequests() {
    await wait(120);
    const t = new Date().toISOString().slice(0, 10);
    return roleRequests
      .filter((r) => r.status === 'open')
      .flatMap((r) => {
        demoSyncCancelled(r);
        const c = r.candidates.find((x) => x.userId === meId());
        if (!c) return [];
        const organizer = directory().get(r.organizerId) ?? state.me;
        return [{
          token: c.token,
          title: r.title,
          roleLabel: r.roleLabel,
          organizerName: organizer.name.split(' ')[0],
          open: r.dates.filter((d) => !d.eventCancelled && d.date >= t && d.answers.some((a) => a.candidateId === c.id && a.answer === null)).length,
          mine: r.dates.filter((d) => d.assignedCandidateId === c.id && d.date >= t).length,
        }];
      });
  },

  async getInvite(token) {
    await wait(260);
    const resolved = resolveToken(token);
    if (!resolved) return null;
    const { event: e, guestId } = resolved;
    const me = viewerMember(e, guestId);
    return clone({
      token,
      personal: !!guestId,
      claimable: !!guestId && e.members.some((m) => m.person.id === guestId && !m.userId),
      groupId: e.groupId ?? null,
      event: {
        id: e.id,
        title: e.title,
        category: e.category,
        coverImageUrl: e.coverImageUrl,
        status: e.status,
        dateMode: e.dateMode,
        periodLabel: e.periodLabel,
        timeHint: e.timeHint,
        startTime: e.startTime,
        selectedDate: e.selectedDate,
        location: e.location,
        description: e.description,
        options: e.options,
      },
      organizer: { ...freshPerson(e.organizer), name: freshPerson(e.organizer).name.split(' ')[0] },
      invitedCount: e.members.length,
      respondents: e.members
        .filter((m) => m.role === 'organizer' || ['responded', 'attending'].includes(m.status))
        .map((m) => ({ ...freshPerson(m.person), name: freshPerson(m.person).name.split(' ')[0] })),
      pricing: { price: e.price ?? null, maxParticipants: e.maxParticipants ?? null, placesTaken: e.placesTaken ?? null, payingPlaces: e.payingPlaces ?? null, nonPayingPlaces: e.nonPayingPlaces ?? null },
      activity: e.activityType
        ? { activityType: e.activityType, rolePlaces: e.rolePlaces ?? 0, venueCapacity: e.venueCapacity ?? null, theme: e.activityTheme ?? null, role: demoActivityRole(e, false) }
        : null,
      myResponse: me ? { memberId: me.id, name: me.person.name, status: me.status, unavailableOptionIds: me.unavailableOptionIds } : null,
    });
  },

  async submitAvailability(token, input) {
    await wait(550);
    const resolved = resolveToken(token);
    if (!resolved) throw new Error('Invitasjonen finnes ikke lenger');
    const { event: e, guestId } = resolved;
    if (e.status !== 'polling' && e.status !== 'draft') throw new Error('Datoen er allerede bestemt');
    if (state.signedIn && guestId) mergeGuest(guestId);
    let m = viewerMember(e, state.signedIn ? null : guestId);
    if (!m) {
      const name = input.name.trim();
      if (!state.signedIn && !name) throw new Error('Skriv navnet ditt først');
      const me = state.me;
      m = {
        id: uid('m'),
        person: state.signedIn ? { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username } : { id: uid('guest'), name, avatarUrl: null, isGuest: true },
        userId: state.signedIn ? me.id : null,
        role: 'guest',
        status: 'invited',
        unavailableOptionIds: [],
      };
      e.members.push(m);
    }
    if (!state.signedIn) {
      if (input.name.trim()) m.person.name = input.name.trim();
      state.guestName = m.person.name;
      if (!deviceGuestIds.includes(m.person.id)) deviceGuestIds.push(m.person.id);
    }
    m.unavailableOptionIds = input.unavailableOptionIds.filter((id) => e.options.some((o) => o.id === id));
    m.status = 'responded';
    m.respondedAt = now();
    notify(e.organizer.id, { type: 'response_received', title: `${m.person.name.split(' ')[0]} har svart på ${e.title}`, url: `/event/${e.id}`, actor: m.person });
  },

  async submitRsvp(token, attending, name) {
    await wait(400);
    const resolved = resolveToken(token);
    if (!resolved) throw new Error('Invitasjonen finnes ikke lenger');
    const { event: e, guestId } = resolved;
    if (state.signedIn && guestId) mergeGuest(guestId);
    let m = viewerMember(e, state.signedIn ? null : guestId);
    if (!m) {
      const me = state.me;
      m = {
        id: uid('m'),
        person: state.signedIn ? { id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username } : { id: uid('guest'), name: (name ?? 'Gjest').trim(), avatarUrl: null, isGuest: true },
        userId: state.signedIn ? me.id : null,
        role: 'guest',
        status: 'invited',
        unavailableOptionIds: [],
      };
      e.members.push(m);
    }
    if (!state.signedIn) {
      if (name?.trim()) m.person.name = name.trim();
      state.guestName = m.person.name;
      if (!deviceGuestIds.includes(m.person.id)) deviceGuestIds.push(m.person.id);
    }
    m.status = attending ? 'attending' : 'declined';
    m.respondedAt = now();
  },

  // --- People & friends ------------------------------------------------------

  async listRecentPeople() {
    await wait(120);
    const seen = new Map<string, { person: Person; at: string }>();
    const bump = (p: Person, at: string) => {
      if (p.id === meId() || p.isGuest) return;
      const prev = seen.get(p.id);
      if (!prev || prev.at < at) seen.set(p.id, { person: freshPerson(p), at });
    };
    for (const e of state.events) if (isMemberOf(e)) for (const m of e.members) if (m.userId) bump(m.person, e.createdAt);
    for (const g of state.groups) if (userMemberIds(g).includes(meId())) for (const m of g.members) if (!m.isGuest) bump(m, g.lastActivityAt);
    return clone([...seen.values()].sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.person));
  },

  async listFriends() {
    await wait(140);
    const dir = directory();
    return clone(
      friendIds(meId())
        .map((id) => dir.get(id))
        .filter((p): p is DirectoryEntry => !!p)
        .map(({ id, name, avatarUrl, username }) => ({ id, name, avatarUrl, username }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    );
  },

  async listFriendRequests() {
    await wait(140);
    const dir = directory();
    return clone(
      state.friendships
        .filter((f) => f.addresseeId === meId() && f.status === 'pending')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((f) => {
          const p = dir.get(f.requesterId)!;
          return {
            id: f.id,
            person: { id: p.id, name: p.name, avatarUrl: p.avatarUrl, username: p.username },
            context: contextLabel(p.id),
            mutualFriends: mutualFriends(meId(), p.id).length,
            createdAt: f.createdAt,
          };
        }),
    );
  },

  async searchPeople(query) {
    await wait(200);
    const q = query.trim();
    const norm = normalizeUsername(q);
    if (norm.length < 2) return [];
    const usernameOnly = q.startsWith('@');
    const results = [...directory().values()]
      .filter((p) => p.id !== meId())
      .filter((p) => normalizeUsername(p.username).startsWith(norm) || (!usernameOnly && p.name.toLowerCase().includes(q.toLowerCase())))
      .filter((p) => canView(p.id))
      .map(toResult)
      .sort(
        (a, b) =>
          Number(normalizeUsername(b.username) === norm) - Number(normalizeUsername(a.username) === norm) ||
          Number(b.friendship === 'friends') - Number(a.friendship === 'friends') ||
          b.mutualFriends - a.mutualFriends ||
          a.name.localeCompare(b.name, 'nb'),
      );
    return clone(results.slice(0, 20));
  },

  async matchContacts(phones) {
    await wait(300);
    // Demo: a few people «are» in your contacts.
    if (!phones.length) return [];
    const dir = directory();
    return clone(['u-thea', ...STRANGERS.slice(0, 2).map((p) => p.id)].map((id) => dir.get(id)).filter((p): p is DirectoryEntry => !!p).map(toResult));
  },

  async getMyPhone() {
    await wait(100);
    return { ...demoPhone };
  },

  async setMyPhone(value) {
    await wait(200);
    demoPhone = { ...value };
  },

  async peopleYouMayKnow() {
    await wait(200);
    const me = meId();
    const scores = new Map<string, number>();
    const add = (id: string, s: number) => id !== me && scores.set(id, (scores.get(id) ?? 0) + s);
    for (const e of state.events) if (isMemberOf(e)) for (const m of e.members) if (m.userId) add(m.userId, 3);
    for (const g of state.groups) if (userMemberIds(g).includes(me)) for (const id of userMemberIds(g)) add(id, 2);
    for (const f of friendIds(me)) for (const fof of friendIds(f)) add(fof, 1);
    const dir = directory();
    return clone(
      [...scores.entries()]
        .filter(([id]) => !findFriendship(me, id) && canView(id) && dir.has(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => {
          const r = toResult(dir.get(id)!);
          return { ...r, context: r.context ?? `${r.mutualFriends} felles venner` };
        }),
    );
  },

  async getPublicProfile(by) {
    await wait(180);
    const dir = directory();
    const p =
      'userId' in by ? dir.get(by.userId) : [...dir.values()].find((x) => normalizeUsername(x.username) === normalizeUsername(by.username));
    if (!p || !canView(p.id)) return null;
    const self = state.signedIn && p.id === meId();
    const incoming = state.friendships.find((f) => f.requesterId === p.id && f.addresseeId === meId() && f.status === 'pending');
    const mutual = state.signedIn && !self ? mutualFriends(meId(), p.id) : [];
    return clone({
      person: { id: p.id, name: p.name, avatarUrl: p.avatarUrl, username: p.username },
      bio: (p as Partial<Profile>).bio ?? null,
      friendship: friendshipState(p.id),
      requestId: incoming?.id ?? null,
      context: state.signedIn && !self ? contextLabel(p.id) : null,
      friendCount: self ? friendIds(meId()).length : null,
      groupCount: self ? state.groups.filter((g) => userMemberIds(g).includes(meId())).length : null,
      mutualFriends: mutual
        .map((id) => dir.get(id))
        .filter((x): x is DirectoryEntry => !!x)
        .slice(0, 8)
        .map(({ id, name, avatarUrl, username }) => ({ id, name, avatarUrl, username })),
      mutualFriendCount: mutual.length,
      mutualGroups: state.signedIn && !self ? mutualGroups(meId(), p.id).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, imageUrl: g.coverImageUrl })) : [],
    });
  },

  async sendFriendRequest(userId) {
    await wait(300);
    if (!state.signedIn) throw new Error('Du må logge inn først');
    if (userId === meId() || !canView(userId)) throw new Error('Fant ikke personen');
    const existing = findFriendship(meId(), userId);
    const meName = state.me.name.split(' ')[0];
    if (existing) {
      if (existing.status === 'accepted') return 'friends';
      if (existing.addresseeId === meId()) {
        existing.status = 'accepted';
        notify(userId, { type: 'friend_accepted', title: `${meName} og du er nå venner`, url: `/@${state.me.username}` });
        friendListeners.forEach((l) => l());
        return 'friends';
      }
      return 'outgoing';
    }
    const f: DemoFriendship = { id: uid('f'), requesterId: meId(), addresseeId: userId, status: 'pending', createdAt: now() };
    state.friendships.push(f);
    // Demo: people you already know say yes after a moment.
    if (sharesContext(meId(), userId) || mutualFriends(meId(), userId).length > 0) {
      setTimeout(() => {
        if (f.status !== 'pending') return;
        f.status = 'accepted';
        const other = directory().get(userId);
        notify(meId(), { type: 'friend_accepted', title: `${other?.name.split(' ')[0] ?? 'Noen'} godtok venneforespørselen din`, url: `/@${other?.username}`, actor: other });
        friendListeners.forEach((l) => l());
      }, 4000);
    }
    return 'outgoing';
  },

  async respondFriendRequest(requestId, accept) {
    await wait(250);
    const f = state.friendships.find((x) => x.id === requestId && x.addresseeId === meId() && x.status === 'pending');
    if (!f) throw new Error('Forespørselen finnes ikke lenger');
    f.status = accept ? 'accepted' : 'declined';
    if (accept) notify(f.requesterId, { type: 'friend_accepted', title: `${state.me.name.split(' ')[0]} godtok venneforespørselen din`, url: `/@${state.me.username}` });
    friendListeners.forEach((l) => l());
  },

  async removeFriend(userId) {
    await wait(250);
    state.friendships = state.friendships.filter((f) => f !== findFriendship(meId(), userId));
    friendListeners.forEach((l) => l());
  },

  subscribeToFriends(onChange) {
    friendListeners.add(onChange);
    return () => friendListeners.delete(onChange);
  },

  async blockUser(userId) {
    await wait(250);
    blockedIds.add(userId);
    state.friendships = state.friendships.filter((f) => f !== findFriendship(meId(), userId));
    friendListeners.forEach((l) => l());
  },

  async unblockUser(userId) {
    await wait(200);
    blockedIds.delete(userId);
  },

  async listBlocked() {
    await wait(150);
    const dir = directory();
    return [...blockedIds].map((id) => dir.get(id)).filter((p): p is DirectoryEntry => !!p).map((p) => ({ id: p.id, name: p.name, username: p.username, avatarUrl: p.avatarUrl }));
  },

  async report() {
    await wait(400);
  },

  async getFriendshipStates(userIds) {
    await wait(150);
    if (!state.signedIn) return [];
    const me = meId();
    return [...new Set(userIds)]
      .filter((id) => id === me || sharesContext(me, id) || friendshipState(id) !== 'none')
      .map((id) => {
        const f = findFriendship(me, id);
        return { userId: id, state: friendshipState(id), requestId: f?.status === 'pending' && f.addresseeId === me ? f.id : null };
      });
  },

  // --- Groups ------------------------------------------------------------------

  async listGroups() {
    await wait();
    refreshGroupRefs();
    return state.groups
      .filter((g) => userMemberIds(g).includes(meId()))
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .map(presentGroup);
  },

  async getGroup(id) {
    await wait(160);
    refreshGroupRefs();
    const g = findGroup(id);
    if (!userMemberIds(g).includes(meId())) throw new Error('Fant ikke gjengen');
    return presentGroup(g);
  },

  async createGroup(input) {
    await wait(450);
    const me = state.me;
    const g: Group = {
      id: uid('g'),
      name: input.name.trim(),
      emoji: input.emoji ?? null,
      description: input.description?.trim() || null,
      coverImageUrl: input.coverImageUrl,
      createdBy: me.id,
      myRole: 'owner',
      members: [{ id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username, memberId: uid('gm'), role: 'owner' }],
      defaults: {},
      pastEvents: [],
      createdAt: now(),
      lastActivityAt: now(),
    };
    state.groups.unshift(g);
    await this.addGroupMembers(g.id, { userIds: input.userIds, guestIds: input.guestIds, guestNames: input.guestNames });
    return presentGroup(g);
  },

  async updateGroup(id, patch) {
    await wait();
    const g = findGroup(id);
    if (!['owner', 'admin'].includes(g.members.find((m) => m.id === meId())?.role ?? '')) throw new Error('Bare admin kan endre gjengen');
    if (patch.name !== undefined) g.name = patch.name.trim();
    if (patch.emoji !== undefined) g.emoji = patch.emoji;
    if (patch.description !== undefined) g.description = patch.description;
    if (patch.coverImageUrl !== undefined) g.coverImageUrl = patch.coverImageUrl;
  },

  async addGroupMembers(groupId, input) {
    await wait(300);
    const g = findGroup(groupId);
    if (!userMemberIds(g).includes(meId())) throw new Error('Du er ikke med i gjengen');
    const dir = directory();
    let added = 0;
    for (const id of input.userIds ?? []) {
      const p = dir.get(id);
      if (!p || g.members.some((m) => m.id === id) || !canAddPerson(id)) continue;
      g.members.push({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, username: p.username, memberId: uid('gm'), role: 'member' });
      if (id !== meId()) notify(id, { type: 'group_added', title: `${state.me.name.split(' ')[0]} la deg til i ${g.name}`, url: `/group/${g.id}` });
      added++;
    }
    for (const id of input.guestIds ?? []) {
      const guestMember = knownGuest(id);
      if (!guestMember || g.members.some((m) => m.id === id)) continue;
      g.members.push({ ...guestMember, memberId: uid('gm'), role: 'member' });
      added++;
    }
    for (const name of input.guestNames ?? []) {
      if (!name.trim()) continue;
      g.members.push({ id: uid('guest'), name: name.trim().slice(0, 60), isGuest: true, memberId: uid('gm'), role: 'member' });
      added++;
    }
    g.lastActivityAt = now();
    return added;
  },

  async removeGroupMember(groupId, memberId) {
    await wait(250);
    const g = findGroup(groupId);
    const target = g.members.find((m) => m.memberId === memberId);
    if (!target) return;
    if (target.id === meId()) return this.leaveGroup(groupId);
    const myRole = g.members.find((m) => m.id === meId())?.role;
    if (!(myRole === 'owner' || myRole === 'admin') || target.role === 'owner') throw new Error('Bare admin kan fjerne medlemmer');
    g.members = g.members.filter((m) => m !== target);
  },

  async setGroupMemberRole(groupId, memberId, role) {
    await wait(200);
    const g = findGroup(groupId);
    const myRole = g.members.find((m) => m.id === meId())?.role;
    const target = g.members.find((m) => m.memberId === memberId);
    if (!target || target.isGuest || target.role === 'owner' || !(myRole === 'owner' || myRole === 'admin')) throw new Error('Kan ikke endre rollen');
    target.role = role;
  },

  async leaveGroup(groupId) {
    await wait(300);
    const g = findGroup(groupId);
    const mine = g.members.find((m) => m.id === meId());
    if (!mine) throw new Error('Du er ikke med i gjengen');
    g.members = g.members.filter((m) => m !== mine);
    const users = g.members.filter((m) => !m.isGuest);
    if (!users.length) {
      state.groups = state.groups.filter((x) => x !== g);
      return;
    }
    if (mine.role === 'owner' || g.createdBy === meId()) {
      const next = users.find((m) => m.role === 'admin') ?? users[0];
      next.role = 'owner';
      g.createdBy = next.id;
    }
  },

  async getGroupInviteToken(groupId) {
    await wait(120);
    const g = findGroup(groupId);
    if (!userMemberIds(g).includes(meId())) throw new Error('Du er ikke med i gjengen');
    return `${groupId}~${meId()}`;
  },

  async getGroupInvite(token) {
    await wait(200);
    const resolved = resolveGroupInvite(token);
    if (!resolved) return null;
    const { g, inviter } = resolved;
    const members = [...g.members].sort((a, b) => Number(b.id === inviter.id) - Number(a.id === inviter.id) || Number(!!a.isGuest) - Number(!!b.isGuest));
    return {
      token,
      group: { id: g.id, name: g.name, emoji: g.emoji, description: g.description, coverImageUrl: g.coverImageUrl },
      inviter: { id: inviter.id, name: inviter.name.split(' ')[0], avatarUrl: inviter.avatarUrl },
      memberCount: g.members.length,
      members: members.slice(0, 6).map((m) => ({ id: m.id, name: m.name.split(' ')[0], avatarUrl: m.avatarUrl })),
      isMember: state.signedIn && userMemberIds(g).includes(meId()),
    };
  },

  async joinGroup(token) {
    await wait(350);
    if (!state.signedIn) throw new Error('Du må logge inn først');
    const resolved = resolveGroupInvite(token);
    if (!resolved) throw new Error('Invitasjonen finnes ikke lenger');
    const { g, inviter } = resolved;
    if (!userMemberIds(g).includes(meId())) {
      const me = state.me;
      g.members.push({ id: me.id, name: me.name, avatarUrl: me.avatarUrl, username: me.username, memberId: uid('gm'), role: 'member' });
      g.lastActivityAt = now();
      notify(inviter.id, { type: 'group_added', title: `${me.name.split(' ')[0] || 'Noen'} ble med i ${g.name}`, url: `/group/${g.id}` });
    }
    return g.id;
  },

  // --- Notifications -----------------------------------------------------------

  async listNotifications() {
    await wait(160);
    return clone(inbox.get(meId()) ?? []);
  },

  async markNotificationsRead() {
    (inbox.get(meId()) ?? []).forEach((n) => (n.readAt = n.readAt ?? now()));
  },

  async getNotificationPreferences() {
    return { ...prefs };
  },

  async setNotificationPreferences(p) {
    prefs = { ...p };
  },

  async registerPushToken() {},

  async listSponsored() {
    return [];
  },

  async exportMyData() {
    return JSON.stringify(
      {
        profile: state.me,
        friends: friendIds(meId()),
        events: state.events.filter(isMemberOf),
        groups: state.groups.filter((g) => userMemberIds(g).includes(meId())),
      },
      null,
      2,
    );
  },
};
