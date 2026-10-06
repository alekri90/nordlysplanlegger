import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EventCard } from '@/components/event/EventCard';
import { GroupBubble } from '@/components/group/GroupBubble';
import { Avatar, Button, Card, EmptyState, ErrorState, EventListSkeleton, Icon, IconButton, PressableScale, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useEvents, useGroups, useNotifications } from '@/data/hooks';
import type { Group, PlannerEvent } from '@/data/types';
import { daysBetween, today } from '@/lib/dates';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

const UPCOMING_LIMIT = 4;

export default function Home() {
  const colors = useColors();
  const me = useMe();
  const events = useEvents();
  const groups = useGroups();
  const notifications = useNotifications();
  const resetDraft = useCreateDraft((s) => s.reset);
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { invitations, upcoming } = useMemo(() => splitEvents(events.data ?? [], me?.id), [events.data, me?.id]);
  const nudge = useMemo(() => findNudge(groups.data ?? []), [groups.data]);
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  const startCreate = () => {
    resetDraft();
    router.push('/create');
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([events.refetch(), groups.refetch(), notifications.refetch()]);
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <PressableScale onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Profil" hitSlop={8}>
            <Avatar name={me?.name ?? ''} uri={me?.avatarUrl} size={40} />
          </PressableScale>
          <IconButton icon="bell" accessibilityLabel="Varsler" badge={unread || false} onPress={() => router.push('/notifications')} />
        </View>

        <Animated.View entering={FadeInDown.duration(380)}>
          <Text variant="display" accessibilityRole="header">
            Hva skal vi{'\n'}finne på?
          </Text>
          <Button title="Lag noe" icon="plus" onPress={startCreate} style={{ marginTop: spacing.xl }} accessibilityHint="Lag et arrangement og finn en dato" />
        </Animated.View>

        {nudge ? (
          <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ marginTop: spacing.xl }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="refresh-cw" size={18} color="primary" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout">
                  {nudge.group.name} har ikke møttes på {nudge.weeks} uker
                </Text>
                <Text variant="footnote" color="textSecondary">
                  Skal vi finne neste dato?
                </Text>
              </View>
              <Button
                title="Finn dato"
                size="sm"
                variant="ink"
                onPress={() => {
                  prefillFromGroup(nudge.group, me?.id);
                  router.push('/create/dates');
                }}
              />
            </Card>
          </Animated.View>
        ) : null}

        {events.isError ? (
          <ErrorState onRetry={() => events.refetch()} />
        ) : events.isLoading ? (
          <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
            <Skeleton width={90} height={20} />
            <EventListSkeleton count={2} />
          </View>
        ) : (
          <>
            {invitations.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                <SectionHeader title="Du er invitert" />
                <View style={{ gap: spacing.md }}>
                  {invitations.map((e, i) => (
                    <Animated.View key={e.id} entering={FadeInDown.delay(100 + i * 60).duration(380)}>
                      <EventCard event={e} meId={me?.id} invite onPress={() => router.push(`/i/${e.inviteToken}`)} />
                    </Animated.View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.xxl }}>
              <SectionHeader
                title="Neste"
                action={upcoming.length > UPCOMING_LIMIT ? (showAll ? 'Vis færre' : 'Se alle') : undefined}
                onAction={() => setShowAll((v) => !v)}
              />
              {upcoming.length ? (
                <View style={{ gap: spacing.md }}>
                  {(showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT)).map((e, i) => (
                    <Animated.View key={e.id} entering={FadeInDown.delay(140 + i * 60).duration(380)}>
                      <EventCard event={e} meId={me?.id} onPress={() => router.push(`/event/${e.id}`)} />
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <Card muted padded={false}>
                  <EmptyState icon="sun" title="Ingenting planlagt ennå" body="Det er her det starter. Lag noe, så finner vi en dato som passer gjengen." />
                </Card>
              )}
            </View>
          </>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Dine gjenger" action={groups.data?.length ? 'Se alle' : undefined} onAction={() => router.push('/(tabs)/groups')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingRight: gutter }} style={{ marginHorizontal: -spacing.sm }}>
            {groups.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={64} height={64} rounded={radius.pill} style={{ marginHorizontal: spacing.sm }} />)
              : (groups.data ?? []).map((g) => <GroupBubble key={g.id} name={g.name} imageUrl={g.coverImageUrl} onPress={() => router.push(`/group/${g.id}`)} />)}
            <GroupBubble name="Ny gjeng" add onPress={() => router.push('/group/new')} />
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

const STATUS_ORDER: Record<string, number> = { confirmed: 0, date_selected: 0, polling: 1, draft: 2 };

/** Pending invitations first; then what's coming, with locked dates in date order. */
function splitEvents(events: PlannerEvent[], meId?: string) {
  const t = today();
  const invitations: PlannerEvent[] = [];
  const upcoming: PlannerEvent[] = [];
  for (const e of events) {
    if (e.status === 'completed' || e.status === 'cancelled') continue;
    if (e.selectedDate && e.selectedDate < t) continue;
    const mine = e.members.find((m) => m.userId === meId);
    if (e.status === 'polling' && mine?.role === 'guest' && (mine.status === 'invited' || mine.status === 'opened')) invitations.push(e);
    else upcoming.push(e);
  }
  upcoming.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.selectedDate ?? '').localeCompare(b.selectedDate ?? '') || b.createdAt.localeCompare(a.createdAt));
  return { invitations, upcoming };
}

/** A group that used to meet but has nothing planned for 6+ weeks. One gentle suggestion at a time. */
function findNudge(groups: Group[]): { group: Group; weeks: number } | null {
  const t = today();
  const candidates = groups
    .filter((g) => !g.nextEvent && g.lastEvent?.date)
    .map((g) => ({ group: g, days: daysBetween(g.lastEvent!.date!, t) }))
    .filter((x) => x.days >= 42)
    .sort((a, b) => b.days - a.days);
  return candidates[0] ? { group: candidates[0].group, weeks: Math.floor(candidates[0].days / 7) } : null;
}
