import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EventCard } from '@/components/event/EventCard';
import { GroupBubble } from '@/components/group/GroupBubble';
import { Button, Card, Divider, EmptyState, ErrorState, EventListSkeleton, Icon, IconButton, PressableScale, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useEvents, useGroups, useNotifications } from '@/data/hooks';
import type { Group, PlannerEvent } from '@/data/types';
import { thumb } from '@/lib/categories';
import { daysBetween, today } from '@/lib/dates';
import { eventDateLine } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

const UPCOMING_LIMIT = 4;
const PAST_LIMIT = 5;

export default function Home() {
  const colors = useColors();
  const me = useMe();
  const events = useEvents();
  const groups = useGroups();
  const notifications = useNotifications();
  const resetDraft = useCreateDraft((s) => s.reset);
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const duplicateEvent = useCreateDraft((s) => s.duplicateEvent);
  const [showAll, setShowAll] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [decidingOpen, setDecidingOpen] = useState(true);
  const [allPast, setAllPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { invitations, upcoming, deciding, past } = useMemo(() => splitEvents(events.data ?? [], me?.id), [events.data, me?.id]);
  const nudge = useMemo(() => findNudge(groups.data ?? []), [groups.data]);
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  const startCreate = () => {
    resetDraft();
    router.push('/create');
  };

  const doAgain = (e: PlannerEvent) => {
    duplicateEvent(e, me?.id);
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
                  <EmptyState
                    icon="sun"
                    title={deciding.length ? 'Ingen dato satt ennå' : 'Ingenting planlagt ennå'}
                    body={deciding.length ? 'Når en dato er låst, dukker arrangementet opp her.' : 'Det er her det starter. Lag noe, så finner vi en dato som passer gjengen.'}
                  />
                </Card>
              )}
            </View>

            {deciding.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                <FoldHeader title="Dato bestemmes" count={deciding.length} open={decidingOpen} onToggle={() => setDecidingOpen((v) => !v)} />
                {decidingOpen ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
                    {deciding.map((e, i) => (
                      <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                        <EventCard event={e} meId={me?.id} onPress={() => router.push(`/event/${e.id}`)} />
                      </Animated.View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {past.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                <FoldHeader title="Tidligere" count={past.length} open={pastOpen} onToggle={() => setPastOpen((v) => !v)} />
                {pastOpen ? (
                  <Card style={{ marginTop: spacing.sm, paddingVertical: spacing.xs }}>
                    {(allPast ? past : past.slice(0, PAST_LIMIT)).map((e, i) => (
                      <View key={e.id}>
                        {i ? <Divider /> : null}
                        <PastRow event={e} onPress={() => router.push(`/event/${e.id}`)} onAgain={() => doAgain(e)} />
                      </View>
                    ))}
                    {past.length > PAST_LIMIT && !allPast ? (
                      <>
                        <Divider />
                        <PressableScale onPress={() => setAllPast(true)} style={{ paddingVertical: spacing.md, alignItems: 'center' }} accessibilityRole="button">
                          <Text variant="callout" color="textSecondary">
                            Vis alle {past.length}
                          </Text>
                        </PressableScale>
                      </>
                    ) : null}
                  </Card>
                ) : null}
              </View>
            ) : null}
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

/**
 * Du er invitert (not answered yet) · Neste (date set) · Dato bestemmes (finding a date, I'm in)
 * · Tidligere (newest first). Anything I said no to leaves Home.
 */
function splitEvents(events: PlannerEvent[], meId?: string) {
  const t = today();
  const invitations: PlannerEvent[] = [];
  const upcoming: PlannerEvent[] = [];
  const deciding: PlannerEvent[] = [];
  const past: PlannerEvent[] = [];
  for (const e of events) {
    if (e.status === 'cancelled') continue;
    const mine = e.members.find((m) => m.userId === meId);
    if (mine?.role === 'guest' && mine.status === 'declined') continue;
    if (e.status === 'completed' || (e.selectedDate && e.selectedDate < t)) {
      past.push(e);
      continue;
    }
    const unanswered = mine?.role === 'guest' && (mine.status === 'invited' || mine.status === 'opened');
    if ((e.status === 'polling' || e.status === 'draft') && unanswered) invitations.push(e);
    else if (e.status === 'polling' || e.status === 'draft') deciding.push(e);
    else upcoming.push(e);
  }
  upcoming.sort((a, b) => (a.selectedDate ?? '').localeCompare(b.selectedDate ?? '') || b.createdAt.localeCompare(a.createdAt));
  deciding.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  past.sort((a, b) => (b.selectedDate ?? b.createdAt).localeCompare(a.selectedDate ?? a.createdAt));
  return { invitations, upcoming, deciding, past };
}

/** A section heading you can fold away: «Dato bestemmes (3) ⌄». */
function FoldHeader({ title, count, open, onToggle }: { title: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}, ${count}`}
      accessibilityHint={open ? 'Skjuler listen' : 'Viser listen'}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
    >
      <Text variant="title3">
        {title} ({count})
      </Text>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="textSecondary" />
    </PressableScale>
  );
}

/** A past plan, small: picture, name, date — and «Gjør igjen». */
function PastRow({ event: e, onPress, onAgain }: { event: PlannerEvent; onPress: () => void; onAgain: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <PressableScale onPress={onPress} scaleTo={0.985} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel={`${e.title}, ${eventDateLine(e)}`}>
        <Image source={{ uri: thumb(e.coverImageUrl, 160) }} style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text variant="callout" numberOfLines={1}>
            {e.title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {eventDateLine(e)}
          </Text>
        </View>
      </PressableScale>
      <Button title="Gjør igjen" size="sm" variant="secondary" icon="copy" fullWidth={false} onPress={onAgain} accessibilityLabel={`Gjør ${e.title} igjen`} />
    </View>
  );
}

const STATUS_ORDER: Record<string, number> = { polling: 0, draft: 1 };

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
