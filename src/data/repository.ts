import type {
  AddMembersInput,
  AppNotification,
  ClaimResult,
  CreateEventInput,
  CreateGroupInput,
  Discoverability,
  EventPatch,
  FriendRequest,
  FriendshipState,
  Group,
  GroupPatch,
  GroupRole,
  GuestInvite,
  InviteSuggestion,
  InviteView,
  NotificationPreferences,
  Person,
  PersonResult,
  PlannerEvent,
  Profile,
  PublicProfile,
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
  /** One-screen sign-up. Returns `confirm_email` when the project requires e-mail confirmation first. */
  signUp(input: SignUpInput): Promise<'signed_in' | 'confirm_email'>;
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
  /** Realtime updates for one event (new answers etc.). */
  subscribeToEvent(eventId: string, onChange: () => void): () => void;
  /** Who you usually invite — only your own history in the app. */
  suggestInvitees(category?: string, title?: string): Promise<InviteSuggestion>;

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
  getPublicProfile(by: { username: string } | { userId: string }): Promise<PublicProfile | null>;
  sendFriendRequest(userId: string): Promise<FriendshipState>;
  respondFriendRequest(requestId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string): Promise<void>;
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
