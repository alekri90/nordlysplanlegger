import type { Price } from '@/lib/price';
import type { RepeatConfig } from '@/lib/recurrence';

/**
 * Domain models. Screens and components only ever see these types —
 * never raw database rows — so the backend can evolve independently.
 */

export type EventStatus = 'draft' | 'polling' | 'date_selected' | 'confirmed' | 'completed' | 'cancelled';
/** `waitlisted`: wants to come, but the event is full — moves up automatically when a place frees. */
export type InviteStatus = 'invited' | 'opened' | 'responded' | 'attending' | 'declined' | 'waitlisted';
export type DateMode = 'fixed' | 'poll' | 'undecided';
/** `evening` = "Etter kl. 18". `exact` uses `startTime`. */
export type TimeHint = 'any' | 'daytime' | 'evening' | 'exact';
export type Tier = 'free' | 'plus';
export type CategoryId =
  | 'beach' | 'sauna' | 'games' | 'quiz' | 'movie' | 'gaming' | 'brunch' | 'dinner' | 'sport' | 'ski'
  | 'travel' | 'outdoor' | 'cabin' | 'birthday' | 'christmas' | 'party' | 'concert' | 'family' | 'hangout';

/** ISO calendar date, `YYYY-MM-DD`. Dates are kept timezone-free on purpose. */
export type ISODate = string;

/** Who can find you in search and open your profile. Visible fields are always just photo, name and @username. */
export type Discoverability = 'everyone' | 'friends_of_friends' | 'nobody';

/** Friendship as seen from the current user. */
export type FriendshipState = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends' | 'anonymous';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'child_safety' | 'other';

/** What is being reported: a person, an event or a group (at least one). */
export interface ReportInput {
  reason: ReportReason;
  details?: string;
  userId?: string;
  eventId?: string;
  groupId?: string;
}

/** Your friendship with one person; requestId is set for an incoming request. */
export interface FriendshipInfo {
  userId: string;
  state: FriendshipState;
  requestId?: string | null;
}

export interface Person {
  /** User id for people with an account, guest id for guests. */
  id: string;
  name: string;
  avatarUrl?: string | null;
  username?: string | null;
  /** No account yet. */
  isGuest?: boolean;
}

export interface Profile extends Person {
  username: string;
  /** Private — only ever shown to the owner. */
  email?: string | null;
  bio?: string | null;
  discoverability: Discoverability;
  /** False until they've confirmed name/@username once (OAuth sign-ups). */
  onboarded: boolean;
  tier: Tier;
}

/** Your own phone number. Private: only used so people who have it in their contacts can find you. */
export interface MyPhone {
  /** E.164, e.g. +4791234567. */
  phone: string | null;
  discoverable: boolean;
}

/** A person in search results or suggestions. */
export interface PersonResult extends Person {
  username: string;
  friendship: FriendshipState;
  mutualFriends: number;
  mutualGroups: number;
  /** "Dere var sammen på Kortkveld hos Thomas" */
  context?: string | null;
}

export interface FriendRequest {
  id: string;
  person: Person;
  context?: string | null;
  mutualFriends: number;
  createdAt: string;
}

export interface PublicProfile {
  person: Person & { username: string };
  bio?: string | null;
  friendship: FriendshipState;
  /** Set when they've sent you a request you can accept. */
  requestId?: string | null;
  context?: string | null;
  /** Own profile only. */
  friendCount?: number | null;
  groupCount?: number | null;
  mutualFriends: Person[];
  mutualFriendCount: number;
  /** Only groups you are in too. */
  mutualGroups: { id: string; name: string; emoji?: string | null; imageUrl?: string | null }[];
}

export interface UsernameCheck {
  normalized: string;
  available: boolean;
  reason: 'taken' | 'too_short' | 'too_long' | 'invalid_chars' | 'invalid_dots' | 'reserved' | 'blocked' | null;
  suggestions: string[];
}

export interface SignUpInput {
  displayName: string;
  username: string;
  email: string;
}

/** What moved over when a guest's history was linked to their new account. */
export interface ClaimResult {
  events: number;
  groups: number;
}

/** Based only on the organizer's own history in the app. */
export interface InviteSuggestion {
  groupId: string | null;
  people: (Person & { times: number })[];
}

export interface DateOption {
  id: string;
  date: ISODate;
}

export interface EventMember {
  id: string;
  person: Person;
  /** Set when the member has an account. */
  userId?: string | null;
  role: 'organizer' | 'guest';
  status: InviteStatus;
  /** Options this member has marked as "kan ikke". */
  unavailableOptionIds: string[];
  respondedAt?: string | null;
  /** Medarrangør: can do what the organizer does. */
  isCohost?: boolean;
  /** Place in the waiting list (earliest first). */
  waitlistedAt?: string | null;
  /** False: has a place but doesn't share the cost (e.g. the sauna master). */
  paysShare?: boolean;
  /** First name of the organizer who set this answer («Satt av Pål»); cleared when they answer themselves. */
  answerSetBy?: string | null;
}

export interface EventLocation {
  name: string;
  address?: string | null;
  detailsPending?: boolean;
}

/** The repetition an event belongs to ("Hver måned · Vi finner dato sammen"). */
export interface EventSeriesInfo extends RepeatConfig {
  id: string;
  status: 'active' | 'paused' | 'ended';
}

export interface PlannerEvent {
  id: string;
  title: string;
  category: CategoryId;
  coverImageUrl: string;
  status: EventStatus;
  dateMode: DateMode;
  organizer: Person;
  groupId?: string | null;
  periodLabel?: string | null;
  timeHint: TimeHint;
  startTime?: string | null;
  selectedDate?: ISODate | null;
  selectedOptionId?: string | null;
  location?: EventLocation | null;
  description?: string | null;
  options: DateOption[];
  members: EventMember[];
  inviteToken: string;
  photos: string[];
  createdAt: string;
  lockedAt?: string | null;
  /** «Spontant»: today or tomorrow, «hvem er gira?». */
  spontaneous?: boolean;
  /** Places in total; null = no limit. */
  maxParticipants?: number | null;
  /** Places taken (people coming + places kept for the organizer side and fixed guests). */
  placesTaken?: number | null;
  /** Everyone taking part can invite, not only the organizer and co-hosts. */
  guestsCanInvite?: boolean;
  /** Shown to participants; payment happens outside the app. */
  price?: Price | null;
  /** With a price: places in use by people who pay a share / who don't. */
  payingPlaces?: number | null;
  nonPayingPlaces?: number | null;
  /** Set when this is one time of a recurring event. */
  series?: EventSeriesInfo | null;
  /** A concrete activity type ('aufguss'); null for a general activity. */
  activityType?: string | null;
  /** People in a role (the sauna master) on top of the participant places. */
  rolePlaces?: number;
  /** How many the venue holds in total, roles included; null = unknown. */
  venueCapacity?: number | null;
  /** Who has the role, and whether it is confirmed yet. */
  activityRole?: EventActivityRole | null;
  /** A theme for the evening («Eukalyptus»), set by the organizer or the one with the role. */
  activityTheme?: string | null;
  /** A building-block type's own fields (buy-in structure, menu, distance …). */
  activityDetails?: ActivityDetailsData | null;
}

/** What a building-block type stores on the event: its own fields as text. */
export interface ActivityDetailsData {
  fields?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Activity kits: diets, the bring list, rides and poker results for one event
// ---------------------------------------------------------------------------

/** Which event: by id when signed in, or by invite link for guests without an account. */
export type KitRef = { eventId?: string | null; token?: string | null };

export interface KitBringItem {
  id: string;
  label: string;
  /** First name of the one bringing it. */
  claimedBy: string | null;
  mine: boolean;
  addedByMe: boolean;
}

export interface KitRide {
  id: string;
  driver: string;
  mine: boolean;
  seats: number;
  from: string | null;
  passengers: string[];
  joined: boolean;
}

export interface KitPokerRow {
  memberId: string;
  name: string;
  buyIns: number;
  cashOutOre: number | null;
}

export interface EventKit {
  /** My member id; null when only looking (link not answered yet). */
  me: string | null;
  organizer: boolean;
  details: ActivityDetailsData | null;
  myDiet: string | null;
  /** Everyone's diets — only for the organizer side. */
  diets: { memberId: string; name: string; diet: string }[] | null;
  bring: KitBringItem[];
  rides: KitRide[];
  poker: KitPokerRow[];
}

// ---------------------------------------------------------------------------
// Activity types: a role confirmed per date (the sauna master), saved venues
// ---------------------------------------------------------------------------

/**
 * confirmed: someone has the role · choose: someone can, the organizer picks · unavailable: everyone
 * asked said no · pending: waiting for answers · cancelled: the event is cancelled.
 */
export type RoleDateStatus = 'confirmed' | 'choose' | 'unavailable' | 'pending' | 'cancelled';

export interface EventActivityRole {
  roleLabel: string;
  /** Only on the organizer side: the request to open. */
  requestId: string | null;
  /** 'partly': alternative dates where some have the role. */
  status: RoleDateStatus | 'partly';
  /** First name of the one with the role (for the chosen date). */
  name: string | null;
  /** «Inviter senere»: held back (not shown as an event) until the role is confirmed. */
  hold: boolean;
  /** I have the role (the sauna master looking at their own event). */
  mine: boolean;
  /** My answer page, when I have the role. */
  token: string | null;
  dates: { date: ISODate; status: RoleDateStatus; name: string | null }[];
}

export interface Venue {
  id: string;
  activityType: string;
  name: string;
  /** In total, roles included; null = unknown. */
  capacity: number | null;
}

export interface RoleCandidate {
  id: string;
  userId: string | null;
  name: string;
  /** Their personal link. */
  token: string;
  reply: string | null;
  answeredAt: string | null;
}

export interface RoleRequestDate {
  id: string;
  date: ISODate;
  eventId: string | null;
  assignedCandidateId: string | null;
  eventCancelled: boolean;
  /** Participants invited now (provisional) or later (held back until confirmed). */
  inviteNow: boolean;
  theme: string | null;
  /** Everyone asked about this date. answer: true «Kan» · false «Kan ikke» · null not answered. */
  answers: { candidateId: string; answer: boolean | null }[];
}

/** One request to one or more people (sauna masters) about a set of dates. */
export interface RoleRequest {
  id: string;
  activityType: string;
  roleKey: string;
  roleLabel: string;
  title: string;
  timeHint: TimeHint;
  startTime: string | null;
  placeName: string | null;
  note: string | null;
  /** each: every date is its own event · poll: alternative dates for one event. */
  mode: 'each' | 'poll';
  status: 'open' | 'cancelled';
  createdAt: string;
  dates: RoleRequestDate[];
  candidates: RoleCandidate[];
}

/** The page for the one asked (works without an account). */
export interface RoleRequestView {
  token: string;
  activityType: string;
  roleLabel: string;
  title: string;
  timeHint: TimeHint;
  startTime: string | null;
  placeName: string | null;
  note: string | null;
  name: string;
  reply: string | null;
  answeredAt: string | null;
  organizer: { name: string; avatarUrl: string | null };
  dates: { id: string; date: ISODate; answer: boolean | null; mine: boolean; taken: boolean; cancelled: boolean; theme: string | null; eventId: string | null }[];
}

export interface CreateRoleRequestInput {
  activityType: string;
  roleKey: string;
  roleLabel: string;
  title: string;
  timeHint: TimeHint;
  startTime: string | null;
  placeName: string | null;
  note: string | null;
  mode: 'each' | 'poll';
  dates: { date: ISODate; eventId: string | null; inviteNow?: boolean }[];
  /** Friends in the app (they get a notice), or names (the organizer shares their link). */
  candidates: { userId?: string | null; name: string }[];
}

export interface CreatedRoleRequest {
  id: string;
  candidates: { id: string; userId: string | null; name: string; token: string }[];
}

/** Requests sent to me in the app. */
export interface MyRoleRequest {
  token: string;
  title: string;
  roleLabel: string;
  organizerName: string;
  /** Dates still waiting for my answer. */
  open: number;
  /** Coming dates where I have the role. */
  mine: number;
}

export interface GroupDefaults {
  title?: string | null;
  category?: CategoryId | null;
  timeHint?: TimeHint | null;
  startTime?: string | null;
  /** 0 = monday … 6 = sunday */
  preferredWeekdays?: number[];
}

export interface GroupEventRef {
  id: string;
  title: string;
  date?: ISODate | null;
  status: EventStatus;
}

export type GroupRole = 'owner' | 'admin' | 'member';

export interface GroupMember extends Person {
  /** The membership row (used to remove someone). */
  memberId: string;
  role: GroupRole;
}

export interface Group {
  id: string;
  name: string;
  emoji?: string | null;
  description?: string | null;
  coverImageUrl: string;
  createdBy: string;
  /** The current user's role, null if not a member. */
  myRole: GroupRole | null;
  /** Registered members and guests (no account yet). */
  members: GroupMember[];
  defaults: GroupDefaults;
  lastEvent?: GroupEventRef | null;
  nextEvent?: GroupEventRef | null;
  pastEvents: GroupEventRef[];
  createdAt: string;
  lastActivityAt: string;
}

export type NotificationType =
  | 'invited'
  | 'response_received'
  | 'reminder_respond'
  | 'all_can'
  | 'date_locked'
  | 'event_updated'
  | 'event_reminder'
  | 'group_nudge'
  | 'event_cancelled'
  | 'friend_request'
  | 'friend_accepted'
  | 'group_added'
  | 'event_message';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** In-app route to open, e.g. `/event/123`. */
  url?: string | null;
  actor?: Person | null;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationPreferences {
  invites: boolean;
  responses: boolean;
  dateLocked: boolean;
  reminders: boolean;
  groupNudges: boolean;
}

/** What someone opening an invitation link is allowed to see. No contact data. */
export interface InvitePricing {
  price: Price | null;
  maxParticipants: number | null;
  placesTaken: number | null;
  payingPlaces: number | null;
  nonPayingPlaces: number | null;
}

export interface InviteView {
  token: string;
  event: Pick<
    PlannerEvent,
    'id' | 'title' | 'category' | 'coverImageUrl' | 'status' | 'dateMode' | 'periodLabel' | 'timeHint' | 'startTime' | 'selectedDate' | 'location' | 'description' | 'options'
  >;
  organizer: Person;
  /** Opened through a personal link (a guest seat made for this person). */
  personal: boolean;
  /** The personal seat can be linked to an account. */
  claimable: boolean;
  groupId?: string | null;
  invitedCount: number;
  respondents: Person[];
  /** Places and price, without names. */
  pricing?: InvitePricing | null;
  /** A concrete activity type, and whether its role is confirmed yet (else the event is provisional). */
  activity?: { activityType: string; rolePlaces: number; venueCapacity: number | null; theme: string | null; role: EventActivityRole | null } | null;
  myResponse?: {
    memberId: string;
    name: string;
    status: InviteStatus;
    unavailableOptionIds: string[];
  } | null;
}

export interface CreateEventInput {
  title: string;
  category: CategoryId;
  coverImageUrl: string;
  dateMode: DateMode;
  optionDates: ISODate[];
  fixedDate?: ISODate | null;
  timeHint: TimeHint;
  startTime?: string | null;
  periodLabel?: string | null;
  groupId?: string | null;
  /** People (with accounts) to invite directly. */
  memberIds: string[];
  /** Guests from the group (no account) — they get personal links. */
  guestIds?: string[];
  /** New people without an account, by name. */
  guestNames?: string[];
  /** Save the selected people as a new group for next time. */
  saveAsGroupName?: string | null;
  /** Optional, can also be added later. */
  location?: EventLocation | null;
  description?: string | null;
  /** «Spontant»: the invitation goes out as a time-sensitive notification. */
  spontaneous?: boolean;
}

/**
 * What the organizer chose in the create flow, kept with a date clearance until they invite.
 * The dates come from the key person's answer.
 */
export type ClearanceDraft = Omit<CreateEventInput, 'dateMode' | 'optionDates' | 'fixedDate' | 'periodLabel' | 'spontaneous'> & {
  maxParticipants?: number | null;
  guestsCanInvite?: boolean;
  price?: Price | null;
};

export interface ClearanceDay {
  date: ISODate;
  /** null: not answered yet. */
  ok: boolean | null;
}

/** «Avklar med noen først»: days proposed to one person before anyone is invited. */
export interface DateClearance {
  id: string;
  token: string;
  keyUserId: string | null;
  keyName: string;
  title: string;
  note: string | null;
  status: 'pending' | 'answered' | 'done' | 'cancelled';
  reply: string | null;
  answeredAt: string | null;
  days: ClearanceDay[];
  draft: ClearanceDraft;
  eventIds: string[];
  createdAt: string;
}

/** The key person's page (works without an account): what is asked, never who is invited. */
export interface ClearanceView {
  token: string;
  title: string;
  category: CategoryId;
  coverImageUrl: string | null;
  timeHint: TimeHint;
  startTime: string | null;
  placeName: string | null;
  note: string | null;
  keyName: string;
  status: DateClearance['status'];
  reply: string | null;
  organizer: { name: string; avatarUrl: string | null };
  days: ClearanceDay[];
}

export interface CreateClearanceInput {
  /** A friend in the app; otherwise only a name, and the organizer shares the link. */
  keyUserId?: string | null;
  keyName: string;
  note?: string | null;
  dates: ISODate[];
  draft: ClearanceDraft;
}

/** An update from the organizer on an event ("Vi møtes ved inngangen"). */
export interface EventMessage {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
  /** Only for the author: how many of the others have seen it. */
  seenCount?: number | null;
  recipientCount?: number | null;
}

export interface CreateGroupInput {
  name: string;
  emoji?: string | null;
  description?: string | null;
  coverImageUrl: string;
  userIds: string[];
  guestIds?: string[];
  guestNames?: string[];
}

export interface GroupPatch {
  name?: string;
  emoji?: string | null;
  description?: string | null;
  coverImageUrl?: string;
}

export interface AddMembersInput {
  userIds?: string[];
  guestIds?: string[];
  guestNames?: string[];
}

/** What someone opening a group invite link may see. First names only, no contact data. */
export interface GroupInviteView {
  token: string;
  group: Pick<Group, 'id' | 'name' | 'emoji' | 'description' | 'coverImageUrl'>;
  /** The member whose link this is. */
  inviter: Person;
  memberCount: number;
  /** A few members, the inviter first. */
  members: Person[];
  isMember: boolean;
}

/** Personal invite link for a guest without an account. */
export interface GuestInvite {
  guestId: string;
  name: string;
  token: string;
}

export interface EventPatch {
  title?: string;
  description?: string | null;
  startTime?: string | null;
  timeHint?: TimeHint;
  location?: EventLocation | null;
  coverImageUrl?: string;
  /** null removes the limit. */
  maxParticipants?: number | null;
  guestsCanInvite?: boolean;
  /** null removes the price. */
  price?: Price | null;
  activityType?: string | null;
  rolePlaces?: number;
  venueCapacity?: number | null;
}

/** Co-hosts and fixed places on a single (not recurring) event. Organizer only. */
export interface EventPeople {
  cohostIds: string[];
  reservedIds: string[];
}

/** Who always has a place on a recurring event, and how many can come. */
export interface SeriesPeople {
  cohostIds: string[];
  reservedIds: string[];
  maxParticipants: number | null;
}

/** Native sponsored content — model prepared, not shown in MVP. */
export interface SponsoredSuggestion {
  id: string;
  placement: 'post_lock_venue' | 'event_details' | 'group_next';
  sponsorName: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel: string;
  ctaUrl: string;
}
