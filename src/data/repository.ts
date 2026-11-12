import type { RepeatConfig } from '@/lib/recurrence';
import type {
  AddMembersInput,
  AppNotification,
  ClaimResult,
  ClearanceView,
  CreateClearanceInput,
  CreatedRoleRequest,
  CreateRoleRequestInput,
  DateClearance,
  MyRoleRequest,
  RoleRequest,
  RoleRequestView,
  Venue,
  CreateEventInput,
  CreateGroupInput,
  Discoverability,
  EventMessage,
  EventSeriesInfo,
  EventPatch,
  SeriesPeople,
  EventPeople,
  MyPhone,
  FriendRequest,
  FriendshipInfo,
  FriendshipState,
  Group,
  GroupInviteView,
  GroupPatch,
  GroupRole,
  GuestInvite,
  InviteStatus,
  InviteSuggestion,
  InviteView,
  NotificationPreferences,
  Person,
  PersonResult,
  PlannerEvent,
  Profile,
  PublicProfile,
  ReportInput,
  SignUpInput,
  SponsoredSuggestion,
  UsernameCheck,
} from './types';

export interface GuestResponseInput {
  name: string;
  unavailableOptionIds: string[];
}

export interface ProfilePatch {
  name?: string;
  username?: string;
  bio?: string | null;
  avatarUri?: string | null;
  discoverability?: Discoverability;
  onboarded?: boolean;
}

export interface Repository {
  readonly kind: 'demo' | 'supabase';

  // --- Session -------------------------------------------------------------
  getMe(): Promise<Profile | null>;
  /** Subscribe to sign-in / sign-out. Returns an unsubscribe function. */
  onAuthChange(cb: (profile: Profile | null) => void): () => void;
  /** E-mail is the only sign-in method: a one-time code (also creates the account), or a password. */
  sendOtp(target: { email: string }): Promise<void>;
  verifyOtp(target: { email: string }, code: string): Promise<void>;
  /** One-screen sign-up without a password: e-mails a code; finish with `verifyOtp` (same e-mail). */
  signUp(input: SignUpInput): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  /** Live availability + suggestions. Works before sign-up. */
  checkUsername(username: string, displayName?: string): Promise<UsernameCheck>;
  /**
   * Link answers given as a guest to the signed-in account — via the secret stored on this device,
   * and/or a personal invite link. Never by name.
   */
  claimGuest(opts?: { inviteToken?: string }): Promise<ClaimResult>;

  // --- Events --------------------------------------------------------------
  /** Everything the user organizes or is invited to, newest first. */
  listEvents(): Promise<PlannerEvent[]>;
  getEvent(id: string): Promise<PlannerEvent>;
  createEvent(input: CreateEventInput): Promise<{ eventId: string; inviteToken: string; groupId?: string | null; guests: GuestInvite[] }>;
  updateEvent(id: string, patch: EventPatch): Promise<void>;
  lockDate(eventId: string, optionId: string): Promise<void>;
  /** Start finding a date for an undecided event. */
  startPoll(eventId: string, optionDates: string[]): Promise<void>;
  setRsvp(eventId: string, attending: boolean): Promise<void>;
  cancelEvent(eventId: string): Promise<void>;
  /** Makes a just-created event the first time of a recurring series. */
  createEventSeries(eventId: string, config: RepeatConfig): Promise<string>;
  /** Change how often, date mode, confirmation; pause (paused), resume (active) or end (ended). */
  updateEventSeries(seriesId: string, patch: Partial<RepeatConfig> & { status?: EventSeriesInfo['status'] }): Promise<void>;
  /** New main picture for the series: this round and the coming ones that don't have their own. */
  setSeriesCover(seriesId: string, coverImageUrl: string, eventId: string): Promise<void>;
  /** Organizer only: co-hosts, fixed guests (always a place, private) and the limit for every round. */
  setSeriesPeople(seriesId: string, people: SeriesPeople): Promise<void>;
  /** Organizer only. */
  getSeriesPeople(seriesId: string): Promise<SeriesPeople>;
  /** «Minn på»: notifies everyone with an account who hasn't answered (not more than every 12 h). */
  remindPending(eventId: string): Promise<{ sent: number; withoutAccount: number }>;
  /** Organizer side: take someone off the guest list, quietly. */
  removeEventMember(memberId: string): Promise<void>;
  /** Organizer side: set someone's answer (they said so on SMS). Returns the result — 'waitlisted' when full. */
  setMemberAnswer(memberId: string, status: 'attending' | 'declined' | 'invited'): Promise<InviteStatus>;
  /** Organizer side: whether someone shares the cost. */
  setMemberPaysShare(memberId: string, paysShare: boolean): Promise<void>;
  /** Organizer side: invite friends to an event that already exists. Returns how many were added. */
  addEventMembers(eventId: string, userIds: string[]): Promise<number>;
  /** Organizer side: people without an account get personal links. */
  addEventGuests(eventId: string, names: string[], guests?: { guestId: string; name: string }[]): Promise<GuestInvite[]>;
  /** The invitation has been seen in the app (the organizer sees it, and a reminder follows if nobody answers). */
  markEventOpened(eventId: string): Promise<void>;
  /** Organizer only, single events (recurring ones use the series). */
  getEventPeople(eventId: string): Promise<EventPeople>;
  setEventPeople(eventId: string, people: EventPeople): Promise<void>;
  /** Newest first. */
  listEventMessages(eventId: string): Promise<EventMessage[]>;
  /** Organizer only; everyone else with an account is notified. */
  postEventMessage(eventId: string, body: string): Promise<void>;
  markEventMessagesSeen(eventId: string): Promise<void>;
  /** Share photos from the event with everyone in it (local image URIs). */
  addEventPhotos(eventId: string, uris: string[]): Promise<void>;
  /** Realtime updates for one event (new answers etc.). */
  subscribeToEvent(eventId: string, onChange: () => void): () => void;
  /** Who you usually invite — only your own history in the app. */
  suggestInvitees(category?: string, title?: string): Promise<InviteSuggestion>;

  // --- «Avklar med noen først» ----------------------------------------------
  /** Sends the proposed days to the key person. Nothing is created yet. */
  createDateClearance(input: CreateClearanceInput): Promise<{ id: string; token: string }>;
  /** The organizer's own, newest first (not stopped ones). */
  listDateClearances(): Promise<DateClearance[]>;
  getDateClearance(id: string): Promise<DateClearance | null>;
  /** The key person's page, through the link. */
  getClearanceByToken(token: string): Promise<ClearanceView | null>;
  answerDateClearance(token: string, okDates: string[], reply?: string | null): Promise<void>;
  /** The events are made; the answer is locked. */
  finishDateClearance(id: string, eventIds: string[]): Promise<void>;
  cancelDateClearance(id: string): Promise<void>;

  // --- Activity types: venues and a role confirmed per date (the sauna master) ---
  listVenues(activityType: string): Promise<Venue[]>;
  /** New when there's no id. A name already saved is updated. */
  saveVenue(venue: Omit<Venue, 'id'> & { id?: string }): Promise<Venue>;
  deleteVenue(id: string): Promise<void>;
  /** One request about all the dates; the events already exist. */
  createRoleRequest(input: CreateRoleRequestInput): Promise<CreatedRoleRequest>;
  /** The organizer's own open requests, newest first. */
  listRoleRequests(): Promise<RoleRequest[]>;
  getRoleRequest(id: string): Promise<RoleRequest | null>;
  /** The page for the one asked, through their link. */
  getRoleRequestByToken(token: string): Promise<RoleRequestView | null>;
  /** Per date id: true «Kan» · false «Kan ikke» · null not answered. Dates left out stay as they are. */
  answerRoleRequest(token: string, answers: Record<string, boolean | null>, reply?: string | null): Promise<void>;
  /** The organizer gives the role for a date to one who can (null: nobody). */
  assignRole(dateId: string, candidateId: string | null): Promise<void>;
  /** Ask someone else about some of the dates. */
  addRoleCandidates(requestId: string, candidates: { userId?: string | null; name: string }[], dateIds: string[]): Promise<CreatedRoleRequest>;
  cancelRoleRequest(id: string): Promise<void>;
  /** Requests sent to me in the app. */
  listMyRoleRequests(): Promise<MyRoleRequest[]>;

  // --- Invitations (work without an account) -------------------------------
  getInvite(token: string): Promise<InviteView | null>;
  submitAvailability(token: string, input: GuestResponseInput): Promise<void>;
  submitRsvp(token: string, attending: boolean, name?: string): Promise<void>;

  // --- People & friends ----------------------------------------------------
  /** People you have planned something with, most recent first ("Nylig"). */
  listRecentPeople(): Promise<Person[]>;
  listFriends(): Promise<Person[]>;
  listFriendRequests(): Promise<FriendRequest[]>;
  searchPeople(query: string): Promise<PersonResult[]>;
  peopleYouMayKnow(): Promise<PersonResult[]>;
  /** Which of these numbers (E.164) belong to someone in the app. The numbers are not stored. */
  matchContacts(phones: string[]): Promise<PersonResult[]>;
  getMyPhone(): Promise<MyPhone>;
  /** `phone: null` removes it. */
  setMyPhone(value: MyPhone): Promise<void>;
  getPublicProfile(by: { username: string } | { userId: string }): Promise<PublicProfile | null>;
  sendFriendRequest(userId: string): Promise<FriendshipState>;
  respondFriendRequest(requestId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  /** Blocked people disappear for each other and can't send requests or add each other. */
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  listBlocked(): Promise<Person[]>;
  /** Report a person, event or group to the owner of the app. */
  report(input: ReportInput): Promise<void>;
  /** For people you share a group or event with (others are left out). */
  getFriendshipStates(userIds: string[]): Promise<FriendshipInfo[]>;
  /** Realtime: incoming requests and accepted friendships. */
  subscribeToFriends(onChange: () => void): () => void;

  // --- Groups --------------------------------------------------------------
  listGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  updateGroup(id: string, patch: GroupPatch): Promise<void>;
  addGroupMembers(groupId: string, input: AddMembersInput): Promise<number>;
  removeGroupMember(groupId: string, memberId: string): Promise<void>;
  setGroupMemberRole(groupId: string, memberId: string, role: Exclude<GroupRole, 'owner'>): Promise<void>;
  leaveGroup(groupId: string): Promise<void>;
  /** The current member's own invite link token for the group. */
  getGroupInviteToken(groupId: string): Promise<string>;
  /** Works without an account (to show who's in it). Null when the link is no longer valid. */
  getGroupInvite(token: string): Promise<GroupInviteView | null>;
  /** Join through an invite link (needs an account). Returns the group id. */
  joinGroup(token: string): Promise<string>;

  // --- Notifications -------------------------------------------------------
  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  setNotificationPreferences(prefs: NotificationPreferences): Promise<void>;
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;

  // --- Later ---------------------------------------------------------------
  listSponsored(placement: SponsoredSuggestion['placement'], category?: string): Promise<SponsoredSuggestion[]>;
  exportMyData(): Promise<string>;
}
