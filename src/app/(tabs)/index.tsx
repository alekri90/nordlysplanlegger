import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppLogo, BRAND } from '@/components/brand/AppLogo';
import { ClearanceCards } from '@/components/event/ClearanceCards';
import { splitEvents } from '@/components/event/EventSections';
import { GroupBubble } from '@/components/group/GroupBubble';
import { InvitationCard } from '@/components/home/InvitationCard';
import { DateRow } from '@/components/home/DateRow';
import { GatherHero } from '@/components/home/GatherHero';
import { NextEventHero } from '@/components/home/NextEventHero';
import { TemptingGrid } from '@/components/home/TemptingGrid';
import { Button, Card, Divider, ErrorState, EventListSkeleton, Icon, IconButton, PressableScale, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useEvents, useGroups, useNotifications } from '@/data/hooks';
import type { Group } from '@/data/types';
import { daysBetween, today } from '@/lib/dates';
import { usePushPermission } from '@/lib/push';
import { featuredCards, GANG_PHOTO, type TemptingCard } from '@/lib/tempting';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { fonts, gutter, radius, spacing, useColors } from '@/theme';

/** Home is for what needs you and what's next; the full overview lives in Kalender. */
const LATER_LIMIT = 4;
/** «Hva frister?» while the calendar is quiet: nothing ahead, or one thing. */
const TEMPTING_UP_TO = 1;

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
  // Three pictures to get you going while there's little ahead (dated, invitations, still finding a date).
  const tempting = useMemo(() => ([...invitations, ...planned, ...deciding].length > TEMPTING_UP_TO ? [] : featuredCards()), [invitations, planned, deciding]);
  // Nothing dated: «Hvem vil du samle?» is the call to action, so «Planlegg» steps aside.
  const quiet = !events.isLoading && !events.isError && !next;
  const noGroups = !groups.isLoading && !groups.data?.length;
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;
  // More than one invitation: swipe between them, with the next one peeking in.
  const cardWidth = Math.min(width, 560) - gutter * 2 - (invitations.length > 1 ? 28 : 0);

  const startCreate = () => {
    resetDraft();
    router.push('/create');
  };

  // A card under «Hva frister?»: its name and picture on step 1 (and its own steps, like Aufguss).
  // Something you did before comes back with the same picture, place and people.
  const tryThis = (card: TemptingCard) => {
    useCreateDraft.getState().startFromIdea(card, me?.id);
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppLogo size={40} />
            {/* The logo already says the name to VoiceOver. */}
            <Text variant="title2" style={{ fontFamily: fonts.extrabold, letterSpacing: -0.4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {BRAND.short}
            </Text>
          </View>
          <IconButton icon="bell" accessibilityLabel={unread ? `Varsler, ${unread} nye` : 'Varsler'} badge={unread || false} onPress={() => router.push('/notifications')} />
          {quiet ? null : <Button title="Planlegg" icon="plus" size="sm" fullWidth={false} onPress={startCreate} accessibilityHint="Lag et arrangement og finn en dato" />}
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
              {next ? <NextEventHero event={next} onPress={() => router.push(`/event/${next.id}`)} /> : <GatherHero onStart={startCreate} />}
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
                        <DateRow event={e} onPress={() => router.push(`/event/${e.id}`)} />
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

            {tempting.length ? (
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <TemptingGrid
                  cards={tempting}
                  onPick={tryThis}
                  onMore={() => {
                    resetDraft();
                    router.push('/create/inspiration?fra=hjem');
                  }}
                  style={{ marginTop: spacing.xxl }}
                />
              </Animated.View>
            ) : null}
          </>
        )}

        {/* At the bottom of the screen when there's room to spare; after the events when there are many. */}
        {noGroups ? (
          <View style={{ marginTop: 'auto', paddingTop: spacing.xl }}>
            <PressableScale
              onPress={() => router.push('/group/new')}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel="Opprett en gjeng. For dere som møtes ofte."
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Image source={{ uri: GANG_PHOTO }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceMuted }} contentFit="cover" accessibilityIgnoresInvertColors />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">Opprett en gjeng</Text>
                  <Text variant="footnote" color="textSecondary">
                    For dere som møtes ofte.
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color="textTertiary" />
              </Card>
            </PressableScale>
          </View>
        ) : (
        <View style={{ marginTop: 'auto', paddingTop: spacing.xxl }}>
          <SectionHeader title="Dine gjenger" action={groups.data?.length ? 'Se alle' : undefined} onAction={() => router.push('/(tabs)/groups')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingRight: gutter }} style={{ marginHorizontal: -spacing.sm }}>
            {groups.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={76} height={76} rounded={radius.pill} style={{ marginHorizontal: spacing.sm }} />)
              : (groups.data ?? []).map((g) => <GroupBubble key={g.id} name={g.name} imageUrl={g.coverImageUrl} size={76} onPress={() => router.push(`/group/${g.id}`)} />)}
            <GroupBubble name="Ny gjeng" add size={76} onPress={() => router.push('/group/new')} />
          </ScrollView>
        </View>
        )}
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
