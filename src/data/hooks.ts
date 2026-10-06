import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useIsSignedIn } from '@/state/session';
import { repo } from './index';
import type { GuestResponseInput, ProfilePatch } from './repository';
import type { AddMembersInput, CreateEventInput, CreateGroupInput, EventPatch, GroupPatch, GroupRole, NotificationPreferences } from './types';

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
