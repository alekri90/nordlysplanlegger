import { unsplash } from '@/lib/categories';
import { addDays, monthKey, monthName, today, weekday } from '@/lib/dates';
import type { AppNotification, Discoverability, EventMember, Group, GroupMember, Person, PlannerEvent, Profile } from '../types';

/**
 * Realistic demo data, generated relative to today so the app always looks alive.
 * Used when no Supabase project is configured.
 */

const portrait = (kind: 'women' | 'men', n: number) => `https://randomuser.me/api/portraits/${kind}/${n}.jpg`;

export const ME: Profile = {
  id: 'u-emma',
  name: 'Emma Larsen',
  username: 'emmal',
  avatarUrl: portrait('women', 44),
  bio: 'Badstu, poker og lange middager.',
  discoverability: 'everyone',
  onboarded: true,
  tier: 'free',
  email: 'emma@example.com',
};

export const PEOPLE: Record<string, Person> = {
  emma: ME,
  maja: { id: 'u-maja', name: 'Maja Nilsen', username: 'maja', avatarUrl: portrait('women', 68) },
  sofie: { id: 'u-sofie', name: 'Sofie Berg', username: 'sofieb', avatarUrl: portrait('women', 65) },
  ida: { id: 'u-ida', name: 'Ida Hansen', username: 'ida.h', avatarUrl: portrait('women', 12) },
  nora: { id: 'u-nora', name: 'Nora Johansen', username: 'noraj', avatarUrl: portrait('women', 33) },
  thea: { id: 'u-thea', name: 'Thea Olsen', username: 'thea', avatarUrl: portrait('women', 90) },
  ingrid: { id: 'u-ingrid', name: 'Ingrid Dahl', username: 'ingrid', avatarUrl: portrait('women', 50) },
  hanna: { id: 'u-hanna', name: 'Hanna Lie', username: 'hannalie', avatarUrl: portrait('women', 21) },
  marius: { id: 'u-marius', name: 'Marius Holm', username: 'marius', avatarUrl: portrait('men', 32) },
  jonas: { id: 'u-jonas', name: 'Jonas Strand', username: 'jonas.s', avatarUrl: portrait('men', 45) },
  henrik: { id: 'u-henrik', name: 'Henrik Moen', username: 'henrikm', avatarUrl: portrait('men', 52) },
  andreas: { id: 'u-andreas', name: 'Andreas Bakke', username: 'andreasb', avatarUrl: portrait('men', 11) },
  erik: { id: 'u-erik', name: 'Erik Lund', username: 'eriklund', avatarUrl: portrait('men', 75) },
  kristian: { id: 'u-kristian', name: 'Kristian Vik', username: 'kvik', avatarUrl: null },
  mamma: { id: 'u-mamma', name: 'Mamma', username: 'anne.larsen', avatarUrl: portrait('women', 79) },
  pappa: { id: 'u-pappa', name: 'Pappa', username: 'per.larsen', avatarUrl: portrait('men', 81) },
  lars: { id: 'u-lars', name: 'Lars Larsen', username: 'larsl', avatarUrl: portrait('men', 36) },
};

const P = PEOPLE;

/** People Emma hasn't planned with yet — only reachable through search (respecting their privacy). */
export const STRANGERS: (Person & { username: string; discoverability: Discoverability })[] = [
  { id: 'u-thomas', name: 'Thomas Berg', username: 'thomas', avatarUrl: portrait('men', 22), discoverability: 'everyone' },
  { id: 'u-petter', name: 'Petter Pokerface', username: 'pokerpetter', avatarUrl: portrait('men', 61), discoverability: 'everyone' },
  { id: 'u-martin', name: 'Martin Aas', username: 'martin', avatarUrl: portrait('men', 18), discoverability: 'friends_of_friends' },
  { id: 'u-alex', name: 'Alexander Kristensen', username: 'alexk', avatarUrl: portrait('men', 41), discoverability: 'everyone' },
  { id: 'u-silje', name: 'Silje Moe', username: 'siljem', avatarUrl: portrait('women', 26), discoverability: 'nobody' },
];

export interface DemoFriendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

/** Emma's friends, two incoming requests, and a few friendships between others (for "felles venner"). */
function seedFriendships(): DemoFriendship[] {
  const f = (a: Person | string, b: Person | string, status: DemoFriendship['status'] = 'accepted', minutesAgo = 60 * 24 * 60): DemoFriendship => {
    const requesterId = typeof a === 'string' ? a : a.id;
    const addresseeId = typeof b === 'string' ? b : b.id;
    return { id: `f-${requesterId}-${addresseeId}`, requesterId, addresseeId, status, createdAt: iso(minutesAgo) };
  };
  return [
    f(ME, P.maja), f(P.sofie, ME), f(ME, P.ida), f(P.nora, ME), f(ME, P.marius), f(P.jonas, ME), f(ME, P.lars), f(P.erik, ME),
    // Incoming requests with context.
    f(P.henrik, ME, 'pending', 60 * 5),
    f(P.andreas, ME, 'pending', 60 * 26),
    // Among others → mutual friends.
    f(P.marius, 'u-thomas'), f(P.jonas, 'u-thomas'), f(P.erik, 'u-thomas'),
    f(P.marius, 'u-petter'), f(P.sofie, 'u-martin'), f(P.maja, P.thea), f(P.ida, P.thea),
    f(P.marius, P.jonas), f(P.sofie, P.maja),
  ];
}

const gm = (person: Person, role: GroupMember['role'] = 'member'): GroupMember => ({ ...person, memberId: `gm-${person.id}`, role });
const guest = (id: string, name: string): GroupMember => ({ id, name, isGuest: true, memberId: `gm-${id}`, role: 'member' });

/** Next date (strictly after `from` + minGap days) that falls on weekday `wd`. */
function nextWeekday(from: string, wd: number, minGap = 1): string {
  let d = addDays(from, minGap);
  while (weekday(d) !== wd) d = addDays(d, 1);
  return d;
}

const iso = (offsetMinutes: number) => new Date(Date.now() - offsetMinutes * 60_000).toISOString();

function member(
  eventId: string,
  person: Person,
  status: EventMember['status'],
  opts: { organizer?: boolean; unavailable?: string[] } = {},
): EventMember {
  return {
    id: `${eventId}-m-${person.id}`,
    person,
    userId: person.id,
    role: opts.organizer ? 'organizer' : 'guest',
    status,
    unavailableOptionIds: opts.unavailable ?? [],
    respondedAt: status === 'invited' || status === 'opened' ? null : iso(60 * 20),
  };
}

export interface DemoState {
  signedIn: boolean;
  me: Profile;
  friendships: DemoFriendship[];
  events: PlannerEvent[];
  groups: Group[];
  notifications: AppNotification[];
  /** Guest identity used when the invitation page is opened while signed out. */
  guestName: string | null;
}

export function createSeed(): DemoState {
  const t = today();

  // --- Badstu med jentene: confirmed, next Saturday at 18 -------------------
  const badstuDate = nextWeekday(t, 5, 4);
  const badstuOptions = [addDays(badstuDate, -1), badstuDate, addDays(badstuDate, 6), addDays(badstuDate, 7)].map((date, i) => ({
    id: `ev-badstu-o${i}`,
    date,
  }));
  const badstu: PlannerEvent = {
    id: 'ev-badstu',
    title: 'Badstu med jentene',
    category: 'sauna',
    coverImageUrl: unsplash('1579457870378-16e766c0c266'),
    status: 'confirmed',
    dateMode: 'poll',
    organizer: ME,
    groupId: 'g-jentene',
    periodLabel: monthName(monthKey(badstuDate)),
    timeHint: 'exact',
    startTime: '18:00',
    selectedDate: badstuDate,
    selectedOptionId: 'ev-badstu-o1',
    location: { name: 'Sørenga sjøbad', address: 'Oslo', detailsPending: true },
    description: 'Vi tar badstu, kaldbad og mat etterpå. Ta med håndkle og badetøy!',
    options: badstuOptions,
    members: [
      member('ev-badstu', ME, 'attending', { organizer: true }),
      member('ev-badstu', P.maja, 'attending'),
      member('ev-badstu', P.sofie, 'attending'),
      member('ev-badstu', P.ida, 'attending', { unavailable: ['ev-badstu-o0'] }),
      member('ev-badstu', P.nora, 'attending'),
      member('ev-badstu', P.thea, 'attending', { unavailable: ['ev-badstu-o3'] }),
      member('ev-badstu', P.ingrid, 'attending'),
      member('ev-badstu', P.hanna, 'declined', { unavailable: ['ev-badstu-o1', 'ev-badstu-o2'] }),
    ],
    inviteToken: 'badstu-demo',
    photos: [],
    createdAt: iso(60 * 24 * 9),
    lockedAt: iso(60 * 24 * 3),
  };

  // --- Pokerkveld: polling, 5 of 8 answered ----------------------------------
  const firstFri = nextWeekday(t, 4, 4);
  const pokerDates = [0, 1, 7, 8, 14, 15, 21, 22].map((d) => addDays(firstFri, d));
  const po = pokerDates.map((date, i) => ({ id: `ev-poker-o${i}`, date }));
  const poker: PlannerEvent = {
    id: 'ev-poker',
    title: 'Pokerkveld',
    category: 'poker',
    coverImageUrl: unsplash('1780091891244-8e6d48ce53a4'),
    status: 'polling',
    dateMode: 'poll',
    organizer: ME,
    groupId: 'g-poker',
    periodLabel: monthName(monthKey(pokerDates[0])),
    timeHint: 'evening',
    startTime: null,
    location: { name: 'Hos Marius', address: 'Grünerløkka' },
    description: 'Buy-in 200 kr. Marius fikser snacks, resten tar med drikke.',
    options: po,
    members: [
      member('ev-poker', ME, 'responded', { organizer: true, unavailable: [po[0].id] }),
      member('ev-poker', P.marius, 'responded', { unavailable: [po[2].id, po[6].id] }),
      member('ev-poker', P.jonas, 'responded', { unavailable: [po[0].id, po[4].id] }),
      member('ev-poker', P.andreas, 'responded', { unavailable: [po[2].id, po[7].id] }),
      member('ev-poker', P.erik, 'responded', { unavailable: [po[1].id, po[6].id] }),
      member('ev-poker', P.henrik, 'opened'),
      member('ev-poker', P.kristian, 'invited'),
      member('ev-poker', P.sofie, 'invited'),
    ],
    inviteToken: 'poker-demo',
    photos: [],
    createdAt: iso(60 * 26),
  };

  // --- Middag: date not decided yet ------------------------------------------
  const nextMonth = monthKey(addDays(`${monthKey(t)}-28`, 7));
  const middag: PlannerEvent = {
    id: 'ev-middag',
    title: 'Middag',
    category: 'dinner',
    coverImageUrl: unsplash('1528605248644-14dd04022da1'),
    status: 'draft',
    dateMode: 'undecided',
    organizer: ME,
    groupId: null,
    periodLabel: monthName(nextMonth),
    timeHint: 'evening',
    options: [],
    members: [
      member('ev-middag', ME, 'responded', { organizer: true }),
      member('ev-middag', P.maja, 'invited'),
      member('ev-middag', P.marius, 'invited'),
      member('ev-middag', P.ida, 'invited'),
    ],
    inviteToken: 'middag-demo',
    photos: [],
    createdAt: iso(60 * 5),
  };

  // --- Padel: Sofie invited me, I haven't answered ---------------------------
  const padelStart = nextWeekday(t, 1, 1);
  const padelDates = [1, 2, 3, 8, 9, 10].map((d) => addDays(padelStart, d));
  const pa = padelDates.map((date, i) => ({ id: `ev-padel-o${i}`, date }));
  const padel: PlannerEvent = {
    id: 'ev-padel',
    title: 'Padel',
    category: 'sport',
    coverImageUrl: unsplash('1658723826297-fe4d1b1e6600'),
    status: 'polling',
    dateMode: 'poll',
    organizer: P.sofie,
    groupId: 'g-padel',
    periodLabel: 'Neste to uker',
    timeHint: 'evening',
    location: { name: 'Padel Oslo, Økern' },
    description: 'Dobbel, 90 minutter. Jeg booker bane når vi har dato.',
    options: pa,
    members: [
      member('ev-padel', P.sofie, 'responded', { organizer: true }),
      member('ev-padel', ME, 'invited'),
      member('ev-padel', P.marius, 'responded', { unavailable: [pa[1].id] }),
      member('ev-padel', P.jonas, 'invited'),
    ],
    inviteToken: 'padel-demo',
    photos: [],
    createdAt: iso(90),
  };

  // --- Past events -----------------------------------------------------------
  const pokerPastDate = addDays(t, -20);
  const pokerPast: PlannerEvent = {
    ...poker,
    id: 'ev-poker-past',
    status: 'completed',
    selectedDate: pokerPastDate,
    selectedOptionId: 'ev-poker-past-o0',
    startTime: '19:00',
    timeHint: 'exact',
    options: [{ id: 'ev-poker-past-o0', date: pokerPastDate }],
    members: poker.members.map((m) => ({ ...m, id: m.id.replace('ev-poker', 'ev-poker-past'), status: 'attending', unavailableOptionIds: [] })),
    inviteToken: 'poker-past-demo',
    photos: [unsplash('1746635732312-0083b7f9423f', 800), unsplash('1774660980275-3a2e7100a1fa', 800)],
    createdAt: iso(60 * 24 * 35),
    lockedAt: iso(60 * 24 * 28),
  };

  const familyPastDate = addDays(t, -49);
  const familyPast: PlannerEvent = {
    id: 'ev-family-past',
    title: 'Søndagsmiddag',
    category: 'family',
    coverImageUrl: unsplash('1533777419517-3e4017e2e15a'),
    status: 'completed',
    dateMode: 'fixed',
    organizer: ME,
    groupId: 'g-familien',
    timeHint: 'exact',
    startTime: '16:00',
    selectedDate: familyPastDate,
    location: { name: 'Hjemme hos mamma og pappa', address: 'Bærum' },
    options: [],
    members: [ME, P.mamma, P.pappa, P.lars].map((p, i) => member('ev-family-past', p, 'attending', { organizer: i === 0 })),
    inviteToken: 'family-past-demo',
    photos: [],
    createdAt: iso(60 * 24 * 60),
  };

  const ref = (e: PlannerEvent) => ({ id: e.id, title: e.title, date: e.selectedDate ?? null, status: e.status });

  const groups: Group[] = [
    {
      id: 'g-jentene',
      name: 'Jentene',
      emoji: '🧖‍♀️',
      description: 'Badstu, vin og prat.',
      createdBy: ME.id,
      myRole: 'owner',
      lastActivityAt: iso(60 * 24 * 3),
      coverImageUrl: unsplash('1758599669742-e90b390b50bc', 600),
      members: [gm(ME, 'owner'), gm(P.maja, 'admin'), ...[P.sofie, P.ida, P.nora, P.thea, P.ingrid, P.hanna].map((p) => gm(p))],
      defaults: { title: 'Badstu med jentene', category: 'sauna', timeHint: 'evening', preferredWeekdays: [4, 5] },
      lastEvent: null,
      nextEvent: ref(badstu),
      pastEvents: [],
      createdAt: iso(60 * 24 * 200),
    },
    {
      id: 'g-poker',
      name: 'Pokerklubben',
      emoji: '🃏',
      description: 'Første fredag i måneden, buy-in 200.',
      createdBy: P.marius.id,
      myRole: 'admin',
      lastActivityAt: iso(60 * 26),
      coverImageUrl: unsplash('1774660980275-3a2e7100a1fa', 600),
      members: [gm(P.marius, 'owner'), gm(ME, 'admin'), ...[P.jonas, P.henrik, P.andreas, P.erik, P.kristian, P.sofie].map((p) => gm(p)), guest('guest-ole', 'Ole'), guest('guest-sindre', 'Sindre')],
      defaults: { title: 'Pokerkveld', category: 'poker', timeHint: 'evening', preferredWeekdays: [4, 5] },
      lastEvent: ref(pokerPast),
      nextEvent: ref(poker),
      pastEvents: [ref(pokerPast)],
      createdAt: iso(60 * 24 * 400),
    },
    {
      id: 'g-padel',
      name: 'Padel',
      emoji: '🎾',
      description: null,
      createdBy: P.sofie.id,
      myRole: 'member',
      lastActivityAt: iso(90),
      coverImageUrl: unsplash('1612534847738-b3af9bc31f0c', 600),
      members: [gm(P.sofie, 'owner'), gm(ME), gm(P.marius), gm(P.jonas)],
      defaults: { title: 'Padel', category: 'sport', timeHint: 'evening', preferredWeekdays: [1, 2, 3] },
      lastEvent: null,
      nextEvent: ref(padel),
      pastEvents: [],
      createdAt: iso(60 * 24 * 90),
    },
    {
      id: 'g-familien',
      name: 'Familien',
      emoji: '🏡',
      description: 'Søndagsmiddager hos mamma og pappa.',
      createdBy: ME.id,
      myRole: 'owner',
      lastActivityAt: iso(60 * 24 * 49),
      coverImageUrl: unsplash('1556025329-d40ee6fcaa94', 600),
      members: [gm(ME, 'owner'), gm(P.mamma), gm(P.pappa), gm(P.lars)],
      defaults: { title: 'Søndagsmiddag', category: 'family', timeHint: 'exact', startTime: '16:00', preferredWeekdays: [6] },
      lastEvent: ref(familyPast),
      nextEvent: null,
      pastEvents: [ref(familyPast)],
      createdAt: iso(60 * 24 * 500),
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'n0',
      type: 'friend_request',
      title: 'Henrik vil legge deg til som venn',
      body: 'Dere var sammen på Pokerkveld',
      url: '/friends/requests',
      actor: P.henrik,
      createdAt: iso(60 * 5),
    },
    {
      id: 'n1',
      type: 'invited',
      title: 'Sofie inviterte deg til Padel',
      body: 'Hvilke dager kan du ikke?',
      url: '/i/padel-demo',
      actor: P.sofie,
      createdAt: iso(90),
    },
    {
      id: 'n2',
      type: 'response_received',
      title: 'Erik har svart på Pokerkveld',
      body: '5 av 8 har svart',
      url: '/event/ev-poker',
      actor: P.erik,
      createdAt: iso(60 * 3),
    },
    {
      id: 'n3',
      type: 'reminder_respond',
      title: '3 personer mangler å svare',
      body: 'Pokerkveld',
      url: '/event/ev-poker',
      createdAt: iso(60 * 7),
    },
    {
      id: 'n4',
      type: 'group_nudge',
      title: 'Familien har ikke møttes på 7 uker',
      body: 'Skal vi finne neste dato?',
      url: '/group/g-familien',
      createdAt: iso(60 * 24),
      readAt: iso(60 * 20),
    },
    {
      id: 'n5',
      type: 'date_locked',
      title: `Du låste ${badstuDate.slice(8, 10).replace(/^0/, '')}. ${monthName(monthKey(badstuDate), false)}`,
      body: 'Badstu med jentene · 7 kommer',
      url: '/event/ev-badstu',
      actor: ME,
      createdAt: iso(60 * 24 * 3),
      readAt: iso(60 * 24 * 3),
    },
  ];

  return {
    signedIn: false,
    me: { ...ME },
    friendships: seedFriendships(),
    events: [padel, badstu, poker, middag, pokerPast, familyPast],
    groups,
    notifications,
    guestName: null,
  };
}
