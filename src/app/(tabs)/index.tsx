import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EventCard } from '@/components/event/EventCard';
import { splitEvents } from '@/components/event/EventSections';
import { GroupBubble } from '@/components/group/GroupBubble';
import { Button, Card, EmptyState, ErrorState, EventListSkeleton, Icon, IconButton, PressableScale, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useEvents, useGroups, useNotifications } from '@/data/hooks';
import type { Group } from '@/data/types';
import { daysBetween, today } from '@/lib/dates';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

/** Home is for what needs you and what's next; the full overview lives in Kalender. */
const NEXT_LIMIT = 3;

export default function Home() {
  const colors = useColors();
  const me = useMe();
  const events = useEvents();
  const groups = useGroups();
  const notifications = useNotifications();
  const resetDraft = useCreateDraft((s) => s.reset);
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const [refreshing, setRefreshing] = useState(false);

  const { invitations, upcoming, deciding } = useMemo(() => splitEvents(events.data ?? [], me?.id), [events.data, me?.id]);
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
        <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
            <Text variant="display" accessibilityRole="header" style={{ flex: 1 }}>
              Hva skal vi{'\n'}finne på?
            </Text>
            <IconButton icon="bell" accessibilityLabel="Varsler" badge={unread || false} onPress={() => router.push('/notifications')} />
          </View>
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
              <SectionHeader title="Neste" action={upcoming.length > NEXT_LIMIT ? 'Se alle' : undefined} onAction={() => router.push('/(tabs)/calendar')} />
              {upcoming.length ? (
                <View style={{ gap: spacing.md }}>
                  {upcoming.slice(0, NEXT_LIMIT).map((e, i) => (
                    <Animated.View key={e.id} entering={FadeInDown.delay(140 + i * 60).duration(380)}>
                      <EventCard event={e} meId={me?.id} onPress={() => router.push(`/event/${e.id}`)} />
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <Card muted padded={false}>
                  <EmptyState
                    icon="sun"
                    title={deciding.length ? 'Ingen dato satt ennå' : 'Ingenting planlagt ennå'}
                    body={deciding.length ? 'Når en dato er låst, dukker arrangementet opp her.' : 'Det er her det starter. Lag noe, så finner vi en dato som passer gjengen.'}
                  />
                </Card>
              )}
              {deciding.length ? (
                <PressableScale
                  onPress={() => router.push('/(tabs)/calendar')}
                  accessibilityRole="button"
                  accessibilityLabel={`Dato bestemmes, ${deciding.length}. Åpner kalenderen`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm }}
                >
                  <Icon name="clock" size={17} color="textSecondary" />
                  <Text variant="callout" style={{ flex: 1 }}>
                    Dato bestemmes ({deciding.length})
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    Se i kalenderen
                  </Text>
                  <Icon name="chevron-right" size={18} color="textTertiary" />
                </PressableScale>
              ) : null}
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
