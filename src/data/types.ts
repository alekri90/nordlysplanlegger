/**
 * Domain models. Screens and components only ever see these types —
 * never raw database rows — so the backend can evolve independently.
 */

export type EventStatus = 'draft' | 'polling' | 'date_selected' | 'confirmed' | 'completed' | 'cancelled';
export type InviteStatus = 'invited' | 'opened' | 'responded' | 'attending' | 'declined';
export type DateMode = 'fixed' | 'poll' | 'undecided';
/** `evening` = "Etter kl. 18". `exact` uses `startTime`. */
export type TimeHint = 'any' | 'daytime' | 'evening' | 'exact';
export type Tier = 'free' | 'plus';
export type CategoryId = 'sauna' | 'poker' | 'dinner' | 'sport' | 'outdoor' | 'cabin' | 'party' | 'family' | 'hangout';

/** ISO calendar date, `YYYY-MM-DD`. Dates are kept timezone-free on purpose. */
export type ISODate = string;

/** Who can find you in search and open your profile. Visible fields are always just photo, name and @username. */
export type Discoverability = 'everyone' | 'friends_of_friends' | 'nobody';

/** Friendship as seen from the current user. */
export type FriendshipState = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends' | 'anonymous';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

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

/** A person in search results or suggestions. */
export interface PersonResult extends Person {
  username: string;
  friendship: FriendshipState;
  mutualFriends: number;
  mutualGroups: number;
  /** "Dere var sammen på Poker hos Thomas" */
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
}

export interface EventLocation {
  name: string;
  address?: string | null;
  detailsPending?: boolean;
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
  | 'group_added';

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
