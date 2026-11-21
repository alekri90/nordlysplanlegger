import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppLogo } from '@/components/brand/AppLogo';
import { ClearanceCards } from '@/components/event/ClearanceCards';
import { splitEvents } from '@/components/event/EventSections';
import { GroupBubble } from '@/components/group/GroupBubble';
import { InvitationCard } from '@/components/home/InvitationCard';
import { NextEventHero } from '@/components/home/NextEventHero';
import { Button, Card, Divider, ErrorState, EventListSkeleton, Icon, IconButton, PressableScale, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useEvents, useGroups, useNotifications } from '@/data/hooks';
import type { Group, PlannerEvent } from '@/data/types';
import { daysBetween, formatTime, MONTHS_SHORT, today } from '@/lib/dates';
import { usePushPermission } from '@/lib/push';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

/** Home is for what needs you and what's next; the full overview lives in Kalender. */
const LATER_LIMIT = 4;

export default function Home() {
  const colors = useColors();
  const me = useMe();
  const events = useEvents();
  const groups = useGroups();
  const notifications = useNotifications();
  const resetDraft = useCreateDraft((s) => s.reset);
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const [refreshing, setRefreshing] = useState(false);
  const permission = usePushPermission();
  const [pushHidden, setPushHidden] = useState(false);
  const { width } = useWindowDimensions();

  const { invitations, upcoming, deciding } = useMemo(() => splitEvents(events.data ?? [], me?.id), [events.data, me?.id]);
  // An unanswered invitation with a date is shown as an invitation here, not as «Neste».
  const planned = useMemo(() => upcoming.filter((e) => !invitations.includes(e)), [upcoming, invitations]);
  const [next, ...later] = planned;
  const nudge = useMemo(() => findNudge(groups.data ?? []), [groups.data]);
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;
  // More than one invitation: swipe between them, with the next one peeking in.
  const cardWidth = Math.min(width, 560) - gutter * 2 - (invitations.length > 1 ? 28 : 0);

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
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <AppLogo size={40} />
          </View>
          <IconButton icon="bell" accessibilityLabel={unread ? `Varsler, ${unread} nye` : 'Varsler'} badge={unread || false} onPress={() => router.push('/notifications')} />
          <Button title="Planlegg" icon="plus" size="sm" fullWidth={false} onPress={startCreate} accessibilityHint="Lag et arrangement og finn en dato" />
        </Animated.View>

        {permission === 'denied' && !pushHidden ? (
          <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="bell-off" size={20} color="primary" />
              <Text variant="callout" style={{ flex: 1 }}>
                Varsler er slått av. Da går du glipp av invitasjoner og endringer.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Slå på" size="sm" variant="ink" onPress={() => Linking.openSettings()} />
              <Button title="Ikke nå" size="sm" variant="ghost" onPress={() => setPushHidden(true)} />
            </View>
          </Card>
        ) : null}

        {events.isError ? (
          <ErrorState onRetry={() => events.refetch()} />
        ) : events.isLoading ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Skeleton height={240} rounded={radius.xl} />
            <EventListSkeleton count={2} />
          </View>
        ) : (
          <>
            {invitations.length ? (
              <Animated.View entering={FadeInDown.delay(60).duration(380)} style={{ marginTop: spacing.lg }}>
                {invitations.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={cardWidth + spacing.md}
                    snapToAlignment="start"
                    style={{ marginHorizontal: -gutter }}
                    contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}
                    accessibilityLabel={`${invitations.length} invitasjoner`}
                  >
                    {invitations.map((e) => (
                      <InvitationCard key={e.id} event={e} style={{ width: cardWidth }} />
                    ))}
                  </ScrollView>
                ) : (
                  <InvitationCard event={invitations[0]} />
                )}
              </Animated.View>
            ) : null}

            <ClearanceCards />

            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginTop: spacing.lg }}>
              {next ? (
                <NextEventHero event={next} onPress={() => router.push(`/event/${next.id}`)} />
              ) : (
                <Card style={{ backgroundColor: colors.feature, borderWidth: 0, borderRadius: radius.xl, padding: spacing.xl }}>
                  <Icon name="sun" size={24} tint={colors.textOnFeature} />
                  <Text variant="title2" style={{ color: colors.textOnFeature, marginTop: spacing.md }}>
                    {deciding.length ? 'Ingen dato satt ennå' : 'Ingenting planlagt ennå'}
                  </Text>
                  <Text variant="subhead" style={{ color: colors.textOnFeature, opacity: 0.75, marginTop: 4 }}>
                    {deciding.length ? 'Når en dato er låst, dukker neste avtale opp her.' : 'Det er her det starter. Planlegg noe, så finner vi en dato som passer gjengen.'}
                  </Text>
                  <Button title="Planlegg noe" icon="plus" size="md" onPress={startCreate} style={{ marginTop: spacing.lg }} />
                </Card>
              )}
            </Animated.View>

            {nudge ? (
              <Animated.View entering={FadeInDown.delay(180).duration(380)}>
              <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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

            {later.length || deciding.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                {later.length ? (
                  <>
                    <SectionHeader title="Senere i kalenderen" action={later.length > LATER_LIMIT ? 'Se alle' : undefined} onAction={() => router.push('/(tabs)/calendar')} />
                    {later.slice(0, LATER_LIMIT).map((e, i) => (
                      <View key={e.id}>
                        {i ? <Divider /> : null}
                        <LaterRow event={e} onPress={() => router.push(`/event/${e.id}`)} />
                      </View>
                    ))}
                  </>
                ) : null}
                {deciding.length ? (
                  <>
                    {later.length ? <Divider /> : null}
                    <PressableScale
                      onPress={() => router.push('/(tabs)/calendar')}
                      accessibilityRole="button"
                      accessibilityLabel={`Dato bestemmes, ${deciding.length}. Åpner kalenderen`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
                    >
                      <View style={{ width: 44, alignItems: 'center' }}>
                        <Icon name="clock" size={20} color="textSecondary" />
                      </View>
                      <Text variant="callout" style={{ flex: 1 }}>
                        Dato bestemmes ({deciding.length})
                      </Text>
                      <Icon name="chevron-right" size={18} color="textTertiary" />
                    </PressableScale>
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {/* At the bottom of the screen when there's room to spare; after the events when there are many. */}
        <View style={{ marginTop: 'auto', paddingTop: spacing.xxl }}>
          <SectionHeader title="Dine gjenger" action={groups.data?.length ? 'Se alle' : undefined} onAction={() => router.push('/(tabs)/groups')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingRight: gutter }} style={{ marginHorizontal: -spacing.sm }}>
            {groups.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={76} height={76} rounded={radius.pill} style={{ marginHorizontal: spacing.sm }} />)
              : (groups.data ?? []).map((g) => <GroupBubble key={g.id} name={g.name} imageUrl={g.coverImageUrl} size={76} onPress={() => router.push(`/group/${g.id}`)} />)}
            <GroupBubble name="Ny gjeng" add size={76} onPress={() => router.push('/group/new')} />
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** «10 DES · Aufguss med Lorna · kl. 18:00 · Sørenga»: what's coming after the next one. */
function LaterRow({ event: e, onPress }: { event: PlannerEvent; onPress: () => void }) {
  const colors = useColors();
  const d = e.selectedDate ? new Date(`${e.selectedDate}T12:00:00`) : null;
  const coming = e.members.filter((m) => m.status === 'attending').length;
  const detail = [e.startTime ? `kl. ${formatTime(e.startTime)}` : null, e.location?.name ?? null].filter(Boolean).join(' · ') || `${coming} kommer`;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${e.title}. ${detail}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ width: 44, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, paddingRight: spacing.sm }}>
        <Text variant="title2" style={{ lineHeight: 26 }}>
          {d ? d.getDate() : '–'}
        </Text>
        <Text variant="caption" color="textSecondary">
          {d ? MONTHS_SHORT[d.getMonth()].toUpperCase() : ''}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="headline" numberOfLines={1}>
          {e.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Icon name={e.startTime || e.location ? 'clock' : 'users'} size={13} color="textSecondary" />
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {detail}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </PressableScale>
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
