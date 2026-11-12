import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useIsSignedIn } from '@/state/session';
import { repo } from './index';
import type { GuestResponseInput, ProfilePatch } from './repository';
import { ACTIVITY_TYPES, type ActivityTypeId } from '@/lib/activities';
import { firstEventInput, nextEventInput, okDates, type ClearanceInviteMode } from '@/lib/clearance';
import { periodLabelFor } from '@/lib/dates';
import type { Price } from '@/lib/price';
import type { AddMembersInput, CreateClearanceInput, CreateEventInput, CreateGroupInput, DateClearance, EventPatch, GuestInvite, GroupPatch, GroupRole, MyPhone, NotificationPreferences, ReportInput, Venue } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export const keys = {
  events: ['events'] as const,
  event: (id: string) => ['event', id] as const,
  invite: (token: string) => ['invite', token] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  people: ['people'] as const,
  friends: ['friends'] as const,
  friendRequests: ['friendRequests'] as const,
  notifications: ['notifications'] as const,
  prefs: ['prefs'] as const,
};

/** Everything that depends on events/groups. Called after any write. */
function invalidateAll(qc: QueryClient) {
  return qc.invalidateQueries();
}

// --- Queries ---------------------------------------------------------------

export function useEvents() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.events, queryFn: () => repo.listEvents(), enabled: signedIn });
}

export function useEvent(id: string | undefined) {
  return useQuery({ queryKey: keys.event(id ?? ''), queryFn: () => repo.getEvent(id!), enabled: !!id });
}

/** Keeps an event fresh while it's on screen (new answers arrive live). */
export function useEventRealtime(id: string | undefined, onChange?: () => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    return repo.subscribeToEvent(id, () => {
      qc.invalidateQueries({ queryKey: keys.event(id) });
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.notifications });
      onChange?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qc]);
}

export function useInvite(token: string | undefined) {
  return useQuery({ queryKey: keys.invite(token ?? ''), queryFn: () => repo.getInvite(token!), enabled: !!token });
}

export function useGroups() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.groups, queryFn: () => repo.listGroups(), enabled: signedIn });
}

export function useGroup(id: string | undefined) {
  return useQuery({ queryKey: keys.group(id ?? ''), queryFn: () => repo.getGroup(id!), enabled: !!id });
}

/** People you've planned with, most recent first. */
export function useRecentPeople() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.people, queryFn: () => repo.listRecentPeople(), enabled: signedIn });
}

// --- Friends -----------------------------------------------------------------

export function useFriends() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.friends, queryFn: () => repo.listFriends(), enabled: signedIn });
}

export function useFriendRequests() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.friendRequests, queryFn: () => repo.listFriendRequests(), enabled: signedIn });
}

/** Keeps friend lists and requests live while mounted. */
export function useFriendsRealtime() {
  const qc = useQueryClient();
  const signedIn = useIsSignedIn();
  useEffect(() => {
    if (!signedIn) return;
    return repo.subscribeToFriends(() => {
      qc.invalidateQueries({ queryKey: keys.friends });
      qc.invalidateQueries({ queryKey: keys.friendRequests });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['search'] });
      qc.invalidateQueries({ queryKey: keys.notifications });
    });
  }, [qc, signedIn]);
}

export function useSearchPeople(query: string) {
  const signedIn = useIsSignedIn();
  const q = query.trim();
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => repo.searchPeople(q),
    enabled: signedIn && q.replace(/^@/, '').length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}

export function usePeopleYouMayKnow() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['pymk'], queryFn: () => repo.peopleYouMayKnow(), enabled: signedIn });
}

export function usePublicProfile(by: { username: string } | { userId: string } | null) {
  const key = by ? ('username' in by ? `@${by.username.toLowerCase()}` : by.userId) : '';
  return useQuery({ queryKey: ['profile', key], queryFn: () => repo.getPublicProfile(by!), enabled: !!by });
}

/** Invalidate everything that shows friendship state. */
function invalidateSocial(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.friends });
  qc.invalidateQueries({ queryKey: keys.friendRequests });
  qc.invalidateQueries({ queryKey: ['profile'] });
  qc.invalidateQueries({ queryKey: ['search'] });
  qc.invalidateQueries({ queryKey: ['pymk'] });
  qc.invalidateQueries({ queryKey: ['friendshipStates'] });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => repo.sendFriendRequest(userId), onSuccess: () => invalidateSocial(qc) });
}

export function useRespondFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) => repo.respondFriendRequest(requestId, accept),
    onSuccess: () => invalidateSocial(qc),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => repo.removeFriend(userId), onSuccess: () => invalidateSocial(qc) });
}

export function useBlocked() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['blocked'], queryFn: () => repo.listBlocked(), enabled: signedIn });
}

/** Blocking changes what you see almost everywhere, so everything is refreshed. */
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => repo.blockUser(userId), onSuccess: () => invalidateAll(qc) });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => repo.unblockUser(userId), onSuccess: () => invalidateAll(qc) });
}

export function useReport() {
  return useMutation({ mutationFn: (input: ReportInput) => repo.report(input) });
}

/** Friendship with each of these people (e.g. the members of a group). */
export function useFriendshipStates(userIds: string[]) {
  const signedIn = useIsSignedIn();
  const ids = [...new Set(userIds)].sort();
  return useQuery({ queryKey: ['friendshipStates', ids.join(',')], queryFn: () => repo.getFriendshipStates(ids), enabled: signedIn && ids.length > 0 });
}

export function useInviteSuggestions(category: string | undefined, title: string | undefined) {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: ['suggest', category ?? '', (title ?? '').trim().toLowerCase()],
    queryFn: () => repo.suggestInvitees(category, title),
    enabled: signedIn,
    staleTime: 60_000,
  });
}

export function useNotifications() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: keys.notifications, queryFn: () => repo.listNotifications(), enabled: signedIn });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: keys.prefs, queryFn: () => repo.getNotificationPreferences() });
}

// --- Mutations ---------------------------------------------------------------

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateEventInput) => repo.createEvent(input), onSuccess: () => invalidateAll(qc) });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (patch: EventPatch) => repo.updateEvent(id, patch), onSuccess: () => invalidateAll(qc) });
}

export function useLockDate(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (optionId: string) => repo.lockDate(eventId, optionId), onSuccess: () => invalidateAll(qc) });
}

export function useStartPoll(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dates: string[]) => repo.startPoll(eventId, dates), onSuccess: () => invalidateAll(qc) });
}

export function useCreateEventSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, config }: { eventId: string; config: Parameters<typeof repo.createEventSeries>[1] }) => repo.createEventSeries(eventId, config),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetSeriesCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, coverImageUrl, eventId }: { seriesId: string; coverImageUrl: string; eventId: string }) => repo.setSeriesCover(seriesId, coverImageUrl, eventId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemindPending(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => repo.remindPending(eventId), onSuccess: () => qc.invalidateQueries({ queryKey: keys.event(eventId) }) });
}

export function useAddEventMembers(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userIds: string[]) => repo.addEventMembers(eventId, userIds), onSuccess: () => invalidateAll(qc) });
}

export function useMyPhone() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['myPhone'], queryFn: () => repo.getMyPhone(), enabled: signedIn });
}

export function useSetMyPhone() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (value: MyPhone) => repo.setMyPhone(value), onSuccess: (_d, value) => qc.setQueryData(['myPhone'], value) });
}

export function useRemoveEventMember() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (memberId: string) => repo.removeEventMember(memberId), onSuccess: () => invalidateAll(qc) });
}

export function useSetMemberAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: 'attending' | 'declined' | 'invited' }) => repo.setMemberAnswer(memberId, status),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetMemberPaysShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, paysShare }: { memberId: string; paysShare: boolean }) => repo.setMemberPaysShare(memberId, paysShare),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateEventSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, patch }: { seriesId: string; patch: Parameters<typeof repo.updateEventSeries>[1] }) => repo.updateEventSeries(seriesId, patch),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useEventMessages(eventId: string | undefined) {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['eventMessages', eventId ?? ''], queryFn: () => repo.listEventMessages(eventId!), enabled: signedIn && !!eventId });
}

export function usePostEventMessage(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => repo.postEventMessage(eventId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventMessages', eventId] }),
  });
}

/** Marks messages as seen when they've been shown (for the organizer's "sett av"). */
export function useMarkMessagesSeen(eventId: string | undefined, newestAt: string | undefined) {
  useEffect(() => {
    if (eventId && newestAt) repo.markEventMessagesSeen(eventId).catch(() => {});
  }, [eventId, newestAt]);
}

export function useAddEventPhotos(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (uris: string[]) => repo.addEventPhotos(eventId, uris), onSuccess: () => invalidateAll(qc) });
}

export function useSetRsvp(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (attending: boolean) => repo.setRsvp(eventId, attending), onSuccess: () => invalidateAll(qc) });
}

export function useCancelEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => repo.cancelEvent(eventId), onSuccess: () => invalidateAll(qc) });
}

export function useSubmitAvailability(token: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: GuestResponseInput) => repo.submitAvailability(token, input), onSuccess: () => invalidateAll(qc) });
}

export function useSubmitRsvp(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attending, name }: { attending: boolean; name?: string }) => repo.submitRsvp(token, attending, name),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateGroupInput) => repo.createGroup(input), onSuccess: () => invalidateAll(qc) });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (patch: ProfilePatch) => repo.updateProfile(patch), onSuccess: () => invalidateAll(qc) });
}

export function useUpdateGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (patch: GroupPatch) => repo.updateGroup(id, patch), onSuccess: () => invalidateAll(qc) });
}

export function useAddGroupMembers(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: AddMembersInput) => repo.addGroupMembers(id, input), onSuccess: () => invalidateAll(qc) });
}

export function useRemoveGroupMember(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (memberId: string) => repo.removeGroupMember(id, memberId), onSuccess: () => invalidateAll(qc) });
}

export function useSetGroupMemberRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Exclude<GroupRole, 'owner'> }) => repo.setGroupMemberRole(id, memberId, role),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useLeaveGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => repo.leaveGroup(id), onSuccess: () => invalidateAll(qc) });
}

/** My own invite link token for a group (stable, created on first use). */
export function useGroupInviteToken(groupId: string | undefined) {
  return useQuery({ queryKey: ['groupInviteToken', groupId ?? ''], queryFn: () => repo.getGroupInviteToken(groupId!), enabled: !!groupId, staleTime: Infinity });
}

export function useGroupInvite(token: string | undefined) {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['groupInvite', token ?? '', signedIn], queryFn: () => repo.getGroupInvite(token!), enabled: !!token });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (token: string) => repo.joinGroup(token), onSuccess: () => invalidateAll(qc) });
}

export function useSetNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: NotificationPreferences) => repo.setNotificationPreferences(p),
    onMutate: (p) => qc.setQueryData(keys.prefs, p),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => repo.markNotificationsRead(), onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }) });
}

// --- «Avklar med noen først» ------------------------------------------------

export function useDateClearances() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['dateClearances'], queryFn: () => repo.listDateClearances(), enabled: signedIn });
}

export function useDateClearance(id: string | undefined) {
  return useQuery({ queryKey: ['dateClearance', id], queryFn: () => repo.getDateClearance(id!), enabled: !!id });
}

export function useClearanceByToken(token: string | undefined) {
  return useQuery({ queryKey: ['clearanceView', token], queryFn: () => repo.getClearanceByToken(token!), enabled: !!token });
}

export function useCreateDateClearance() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateClearanceInput) => repo.createDateClearance(input), onSuccess: () => invalidateAll(qc) });
}

export function useAnswerDateClearance(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ okDates: ok, reply }: { okDates: string[]; reply?: string | null }) => repo.answerDateClearance(token, ok, reply),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCancelDateClearance() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repo.cancelDateClearance(id), onSuccess: () => invalidateAll(qc) });
}

/**
 * The key person has answered: make the event(s) from what the organizer chose in the create flow.
 * `inviteNow: false` makes them without inviting anyone yet (the organizer invites later).
 * The key person is on every event: with an account as co-host, otherwise as a guest who said yes.
 * Either way they don't share the cost when there is a price.
 */
export async function inviteFromClearance(c: DateClearance, mode: ClearanceInviteMode, inviteNow = true) {
  const dates = okDates(c.days);
  if (!dates.length) throw new Error('Ingen av dagene passet');
  const key = c.keyUserId;
  const keyGuestName = key ? null : c.keyName.trim().slice(0, 60);
  const people = inviteNow ? c.draft : { ...c.draft, groupId: null, memberIds: [], guestIds: [], guestNames: [], saveAsGroupName: null };
  const draft = {
    ...people,
    memberIds: key && !people.memberIds.includes(key) ? [...people.memberIds, key] : people.memberIds,
    guestNames: keyGuestName ? [...(people.guestNames ?? []), keyGuestName] : people.guestNames,
  };
  const first = await repo.createEvent(firstEventInput(draft, dates, mode));
  const made = [first];
  if (mode === 'each') for (const date of dates.slice(1)) made.push(await repo.createEvent(nextEventInput(draft, date, first)));
  const keyGuestId = keyGuestName ? first.guests.find((g) => g.name === keyGuestName)?.guestId : undefined;
  const fixed = mode === 'each' || dates.length === 1;
  for (const r of made) {
    if (draft.maxParticipants || draft.guestsCanInvite || draft.price) {
      await repo.updateEvent(r.eventId, {
        ...(draft.maxParticipants && { maxParticipants: draft.maxParticipants }),
        ...(draft.guestsCanInvite && { guestsCanInvite: true }),
        ...(draft.price && { price: draft.price }),
      });
    }
    if (key) await repo.setEventPeople(r.eventId, { cohostIds: [key], reservedIds: [] });
    if (draft.price || (keyGuestId && fixed)) {
      const m = (await repo.getEvent(r.eventId)).members.find((x) => (key ? x.userId === key : x.person.id === keyGuestId));
      if (m && draft.price) await repo.setMemberPaysShare(m.id, false);
      // A key person without the app already said these days work.
      if (m && keyGuestId && fixed) await repo.setMemberAnswer(m.id, 'attending');
    }
  }
  await repo.finishDateClearance(c.id, made.map((r) => r.eventId));
  return { first, count: made.length };
}

export function useInviteFromClearance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clearance, mode, inviteNow = true }: { clearance: DateClearance; mode: ClearanceInviteMode; inviteNow?: boolean }) => inviteFromClearance(clearance, mode, inviteNow),
    onSuccess: () => invalidateAll(qc),
  });
}

/**
 * Invite the same people to several events at once (all the days from a clearance). Guests without
 * an account are made once and get a personal link for each event.
 */
export async function inviteToEvents(eventIds: string[], userIds: string[], guestNames: string[]) {
  let added = 0;
  const links: { eventId: string; guests: GuestInvite[] }[] = [];
  let guests: { guestId: string; name: string }[] = [];
  for (const [i, eventId] of eventIds.entries()) {
    if (userIds.length) {
      const n = await repo.addEventMembers(eventId, userIds);
      if (i === 0) added = n;
    }
    const g = i === 0 ? await repo.addEventGuests(eventId, guestNames) : await repo.addEventGuests(eventId, [], guests);
    if (i === 0) guests = g.map(({ guestId, name }) => ({ guestId, name }));
    if (g.length) links.push({ eventId, guests: g });
  }
  return { added, links };
}

// --- Activity types: venues and a role confirmed per date (Aufguss: the sauna master) ---------

export function useVenues(activityType: string | null | undefined) {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['venues', activityType], queryFn: () => repo.listVenues(activityType!), enabled: signedIn && !!activityType });
}

export function useSaveVenue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: Omit<Venue, 'id'> & { id?: string }) => repo.saveVenue(v), onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }) });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repo.deleteVenue(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }) });
}

export function useRoleRequests() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['roleRequests'], queryFn: () => repo.listRoleRequests(), enabled: signedIn });
}

export function useRoleRequest(id: string | undefined) {
  return useQuery({ queryKey: ['roleRequest', id], queryFn: () => repo.getRoleRequest(id!), enabled: !!id });
}

export function useRoleRequestByToken(token: string | undefined) {
  return useQuery({ queryKey: ['roleRequestView', token], queryFn: () => repo.getRoleRequestByToken(token!), enabled: !!token });
}

export function useMyRoleRequests() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: ['myRoleRequests'], queryFn: () => repo.listMyRoleRequests(), enabled: signedIn });
}

export function useAnswerRoleRequest(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answers, reply }: { answers: Record<string, boolean | null>; reply?: string | null }) => repo.answerRoleRequest(token, answers, reply),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ dateId, candidateId }: { dateId: string; candidateId: string | null }) => repo.assignRole(dateId, candidateId), onSuccess: () => invalidateAll(qc) });
}

export function useAddRoleCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, candidates, dateIds }: { requestId: string; candidates: { userId?: string | null; name: string }[]; dateIds: string[] }) =>
      repo.addRoleCandidates(requestId, candidates, dateIds),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCancelRoleRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repo.cancelRoleRequest(id), onSuccess: () => invalidateAll(qc) });
}

/** Everything the create flow collected for an activity type such as Aufguss. */
export interface ActivityPlanInput {
  activityType: ActivityTypeId;
  /** each: every date is its own possible event · poll: alternative dates for one event. */
  mode: 'each' | 'poll';
  dates: string[];
  /** Title, picture, time, place and the participants chosen (used only where they are invited now). */
  event: Omit<CreateEventInput, 'dateMode' | 'optionDates' | 'fixedDate' | 'periodLabel' | 'spontaneous'>;
  /** The dates where the participants are invited now; the others are made without invitations. */
  inviteDates: string[];
  maxParticipants: number | null;
  price: Price | null;
  guestsCanInvite: boolean;
  venueCapacity: number | null;
  candidates: { userId?: string | null; name: string }[];
  note: string | null;
}

/**
 * Makes the events (provisional until the role is confirmed), with places, price and the venue,
 * invites the participants only where asked to, and sends one request about every date.
 */
export async function createActivityPlan(input: ActivityPlanInput) {
  const type = ACTIVITY_TYPES[input.activityType];
  const dates = [...new Set(input.dates)].sort();
  if (!dates.length) throw new Error('Velg minst én dato');
  if (!input.candidates.length) throw new Error(`Velg hvem som skal spørres som ${type.role.lower}`);
  const nobody = { groupId: null, memberIds: [], guestIds: [], guestNames: [], saveAsGroupName: null };
  const made: { date: string | null; eventId: string; inviteToken: string; guests: GuestInvite[]; invited: boolean }[] = [];
  let firstInvited: { groupId?: string | null; guests: { guestId: string }[] } | null = null;
  try {
    if (input.mode === 'poll') {
      const invited = input.inviteDates.length > 0;
      const r = await repo.createEvent({ ...input.event, ...(invited ? {} : nobody), dateMode: 'poll', optionDates: dates, fixedDate: null, periodLabel: periodLabelFor(dates) });
      made.push({ date: null, ...r, invited });
    } else {
      for (const date of dates) {
        const invited = input.inviteDates.includes(date);
        // The guests and group made for the first invited date are reused, not made again.
        const people = !invited
          ? nobody
          : firstInvited
            ? { groupId: firstInvited.groupId ?? input.event.groupId ?? null, guestIds: [...new Set([...(input.event.guestIds ?? []), ...firstInvited.guests.map((g) => g.guestId)])], guestNames: [], saveAsGroupName: null }
            : {};
        const r = await repo.createEvent({ ...input.event, ...people, dateMode: 'fixed', fixedDate: date, optionDates: [] });
        if (invited && !firstInvited) firstInvited = r;
        made.push({ date, ...r, invited });
      }
    }
    for (const m of made) {
      await repo.updateEvent(m.eventId, {
        activityType: type.id,
        rolePlaces: 1,
        venueCapacity: input.venueCapacity,
        ...(input.maxParticipants && { maxParticipants: input.maxParticipants }),
        ...(input.price && { price: input.price }),
        ...(input.guestsCanInvite && { guestsCanInvite: true }),
      });
    }
    const request = await repo.createRoleRequest({
      activityType: type.id,
      roleKey: type.role.key,
      roleLabel: type.role.lower,
      title: input.event.title,
      timeHint: input.event.timeHint,
      startTime: input.event.startTime ?? null,
      placeName: input.event.location?.name ?? null,
      note: input.note,
      mode: input.mode,
      dates: dates.map((date) => ({ date, eventId: (made.find((m) => m.date === date) ?? made[0]).eventId })),
      candidates: input.candidates,
    });
    return { requestId: request.id, candidates: request.candidates, events: made };
  } catch (e) {
    // Nothing half-made: events without a request are taken away again.
    await Promise.all(made.map((m) => repo.cancelEvent(m.eventId).catch(() => {})));
    throw e;
  }
}

export function useCreateActivityPlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: ActivityPlanInput) => createActivityPlan(input), onSuccess: () => invalidateAll(qc) });
}
