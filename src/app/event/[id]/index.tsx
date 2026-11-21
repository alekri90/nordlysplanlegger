import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RepeatEditor } from '@/components/create/RepeatEditor';
import { ActivityKit } from '@/components/event/ActivityKit';
import { ActivityRoleCard } from '@/components/event/ActivityRoleCard';
import { AttendeesSheet } from '@/components/event/AttendeesSheet';
import { CalendarConflict } from '@/components/event/CalendarConflict';
import { confirmDecline } from '@/components/event/confirmDecline';
import { EventMessages } from '@/components/event/EventMessages';
import { GuestList } from '@/components/event/GuestList';
import { InfoTiles, type InfoTile } from '@/components/event/InfoTiles';
import { MemberSheet } from '@/components/event/MemberSheet';
import { RemindButton } from '@/components/event/RemindButton';
import { ResultsView } from '@/components/event/ResultsView';
import { SeriesPeopleEditor } from '@/components/event/SeriesPeopleEditor';
import { ShareSheet } from '@/components/event/ShareSheet';
import { ThemeSheet } from '@/components/event/ThemeSheet';
import { Avatar, BottomBar, Button, Card, Divider, EmptyState, ErrorState, Icon, IconButton, ListRow, PageSkeleton, PressableScale, Screen, Segmented, Sheet, Tag, Text, useToast, type IconName } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useAddEventPhotos, useCancelEvent, useEvent, useSetActivityTheme, useSetRsvp, useUpdateEvent, useUpdateEventSeries } from '@/data/hooks';
import type { EventMember, EventSeriesInfo, PlannerEvent, SeriesPeople } from '@/data/types';
import { confirmDestructive } from '@/components/people/PersonSheet';
import { ReportForm } from '@/components/people/ReportSheet';
import { CATEGORIES, thumb } from '@/lib/categories';
import { formatLong, formatTime, today } from '@/lib/dates';
import { addEventToCalendar } from '@/lib/eventActions';
import { firstName, timeHintLabel } from '@/lib/eventText';
import { activityType, kitActivity, roleActivity } from '@/lib/activities';
import { describePrice, describeSharedPrice } from '@/lib/price';
import { repeatSummary } from '@/lib/recurrence';
import { useIsInCalendar } from '@/state/calendarSync';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

/**
 * One route, one goal per state:
 * polling + organizer → results · polling + guest → the invitation · otherwise the event page.
 */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const event = useEvent(id);

  if (event.isLoading) {
    return (
      <Screen>
        <PageSkeleton />
      </Screen>
    );
  }
  if (event.isError || !event.data) {
    return (
      <Screen>
        <ErrorState title="Fant ikke arrangementet" body="Det kan ha blitt avlyst eller slettet." onRetry={() => event.refetch()} />
      </Screen>
    );
  }

  const e = event.data;
  const isOwner = e.organizer.id === me?.id;
  // Medarrangører see and do what the organizer does.
  const isOrganizer = isOwner || !!e.members.find((m) => m.userId === me?.id)?.isCohost;
  if (e.status === 'polling' && isOrganizer) return <ResultsView event={e} />;
  if (e.status === 'polling' && e.inviteToken) return <Redirect href={`/i/${e.inviteToken}`} />;
  return <EventDetail event={e} isOrganizer={isOrganizer} isOwner={isOwner} meId={me?.id} />;
}

type Tab = 'guests' | 'details' | 'photos';

function EventDetail({ event: e, isOrganizer, isOwner, meId }: { event: PlannerEvent; isOrganizer: boolean; isOwner: boolean; meId?: string }) {
  const colors = useColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('guests');
  const [whoOpen, setWhoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The menu (⚙ for the organizer, ⋯ for guests). iOS can't present one modal while another is
  // still closing (the screen freezes), or navigate under it: the next step waits until it's gone.
  const afterMore = useRef<(() => void) | null>(null);
  const openAfterMore = (open: () => void) => {
    afterMore.current = open;
    setMoreOpen(false);
  };
  const [reporting, setReporting] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDraft, setRepeatDraft] = useState<EventSeriesInfo | null>(null);
  const updateSeries = useUpdateEventSeries();
  const [personMember, setPersonMember] = useState<EventMember | null>(null);
  const updateEvent = useUpdateEvent(e.id);
  // «Medarrangører og plasser»: for this event, or every round when it repeats.
  const seriesId = e.series?.id;
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roles, setRoles] = useState<SeriesPeople | null>(null);
  const [savingRoles, setSavingRoles] = useState(false);
  useEffect(() => {
    if (!rolesOpen || !isOwner) return;
    let alive = true;
    const load = seriesId ? repo.getSeriesPeople(seriesId) : repo.getEventPeople(e.id).then((p) => ({ ...p, maxParticipants: e.maxParticipants ?? null }));
    load.then((p) => alive && setRoles(p)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [rolesOpen, isOwner, e.id, e.maxParticipants, seriesId]);
  const rsvp = useSetRsvp(e.id);
  const cancel = useCancelEvent(e.id);
  const [themeOpen, setThemeOpen] = useState(false);
  const setTheme = useSetActivityTheme(e.id);
  const addPhotosMutation = useAddEventPhotos(e.id);
  const prefillFromEvent = useCreateDraft((s) => s.prefillFromEvent);

  const mine = e.members.find((m) => m.userId === meId);
  const inCalendar = useIsInCalendar(e.id);
  const unseen = mine?.status === 'invited';
  useEffect(() => {
    if (unseen) repo.markEventOpened(e.id).catch(() => {});
  }, [unseen, e.id]);
  const category = CATEGORIES[e.category] ?? CATEGORIES.hangout;
  const when = e.selectedDate ? formatLong(e.selectedDate) : e.periodLabel ?? 'Dato ikke bestemt';
  const time = e.startTime ? `Kl. ${formatTime(e.startTime)}` : e.selectedDate ? timeHintLabel(e.timeHint) : null;
  const place = e.location ? `${e.location.name}${e.location.detailsPending ? ' (detaljer kommer)' : ''}` : null;

  const findDate = () => {
    prefillFromEvent(e, meId);
    router.push('/create/dates');
  };

  const calendar = async () => {
    try {
      const msg = await addEventToCalendar(e);
      if (msg) toast({ message: msg, tone: 'success', icon: 'calendar' });
    } catch {
      toast({ message: 'Fikk ikke tilgang til kalenderen', tone: 'error' });
    }
  };

  const confirmCancel = () => {
    const run = async () => {
      setMoreOpen(false);
      await cancel.mutateAsync();
      toast('Arrangementet er avlyst');
      router.back();
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Avlyse arrangementet?', 'Alle som er invitert får beskjed.', [
      { text: 'Nei', style: 'cancel' },
      { text: 'Avlys', style: 'destructive', onPress: run },
    ]);
  };

  const isPast = e.status === 'completed';
  const canAddToCalendar = !!e.selectedDate && !isPast && !inCalendar;
  const canInvite = (isOrganizer || (!!e.guestsCanInvite && !!mine && mine.status !== 'declined')) && !isPast && e.status !== 'cancelled';
  // Photos can be shared from the day it happens.
  const canAddPhotos = isPast || (!!e.selectedDate && e.selectedDate <= today() && e.status !== 'cancelled');

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.7 });
    if (result.canceled || !result.assets.length) return;
    try {
      await addPhotosMutation.mutateAsync(result.assets.map((a) => a.uri));
      toast({ message: result.assets.length === 1 ? 'Bildet er delt' : `${result.assets.length} bilder er delt`, tone: 'success', icon: 'image' });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Kunne ikke dele bildene', tone: 'error' });
    }
  };

  const showRsvp = !isOrganizer && !!mine && (e.status === 'confirmed' || e.status === 'date_selected');
  const waitlist = e.members.filter((m) => m.status === 'waitlisted').sort((a, b) => (a.waitlistedAt ?? '').localeCompare(b.waitlistedAt ?? ''));
  const full = !!e.maxParticipants && (e.placesTaken ?? 0) >= e.maxParticipants;
  // Aufguss (a key person confirms), or a type made of building blocks (poker, dinner …).
  const activity = roleActivity(e.activityType);
  const kit = kitActivity(e.activityType);
  const themeSpec = activityType(e.activityType)?.theme ?? null;
  // The sauna master looking at their own evening: not a participant, sees time, place and theme.
  const roleHolder = !!e.activityRole?.mine && !mine && !isOrganizer;
  const canTheme = !!themeSpec && (isOrganizer || roleHolder) && e.status !== 'cancelled' && !isPast;
  const saveTheme = async (theme: string | null) => {
    try {
      await setTheme.mutateAsync(theme);
      setThemeOpen(false);
      toast({ message: theme ? `${themeSpec!.label} er lagret` : `${themeSpec!.label} er fjernet`, tone: 'success' });
    } catch {
      toast({ message: 'Kunne ikke lagre. Prøv igjen.', tone: 'error' });
    }
  };
  // Who is coming: the organizer first, then the rest. Whole names in the list.
  const coming = e.members.filter((m) => m.status === 'attending').sort((a, b) => Number(b.role === 'organizer') - Number(a.role === 'organizer'));
  const placesLabel = e.maxParticipants
    ? full
      ? `Fullt${waitlist.length ? ` · ${waitlist.length} venter` : ''}`
      : `${Math.max(0, e.maxParticipants - (e.placesTaken ?? 0))} av ${e.maxParticipants} plasser ledige`
    : `${coming.length} kommer`;
  const tiles: InfoTile[] = [
    {
      icon: 'calendar',
      label: e.selectedDate ? formatLong(e.selectedDate) : (e.periodLabel ?? 'Dato kommer'),
      hint: canAddToCalendar ? 'Legg i kalender' : undefined,
      onPress: canAddToCalendar ? calendar : undefined,
    },
    {
      icon: 'clock',
      label: e.startTime ? `Kl. ${formatTime(e.startTime)}` : timeHintLabel(e.timeHint),
      hint: isOrganizer && !e.startTime && e.selectedDate && !isPast ? 'Sett tid' : undefined,
      onPress: isOrganizer && !isPast && e.status !== 'cancelled' ? () => router.push(`/event/${e.id}/edit`) : undefined,
    },
    { icon: 'users', label: placesLabel, hint: coming.length ? 'Se hvem' : undefined, onPress: () => setWhoOpen(true) },
  ];
  // A shared total (Aufguss): total, how many share it, and per person — an estimate until full.
  const shared = (activity || kit) && e.price?.mode === 'split' ? describeSharedPrice(e.price.amountOre, e) : null;
  const basePrice = shared ? { headline: shared.headline, detail: [shared.detail, shared.now].filter(Boolean).join(' · ') } : e.price ? describePrice(e.price, e) : null;
  // A building-block type names its price: «Buy-in: 200 kr per person», «Banepris: …».
  const price = basePrice && kit?.kit.price ? { ...basePrice, headline: `${kit.kit.price.label}: ${basePrice.headline}` } : basePrice;
  const myQueue = mine?.status === 'waitlisted' ? waitlist.findIndex((m) => m.id === mine.id) + 1 : 0;
  const showInterest = !isOrganizer && !!mine && mine.role === 'guest' && e.status === 'draft';
  const interested = e.members.filter((m) => m.role === 'guest' && m.status === 'attending').length;
  const notInterested = e.members.filter((m) => m.role === 'guest' && m.status === 'declined').length;

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ height: Math.max(360, screenHeight * 0.52) }}>
          <StatusBar style="light" />
          <Image source={{ uri: e.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(12,10,9,0.55)', 'rgba(12,10,9,0.88)']}
            locations={[0, 0.25, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ position: 'absolute', top: insets.top + spacing.xs, left: gutter - 8, right: gutter - 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="chevron-left" variant="glass" accessibilityLabel="Tilbake" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {canInvite ? <IconButton icon="user-plus" variant="glass" accessibilityLabel="Inviter" onPress={() => router.push(`/event/${e.id}/invite`)} /> : null}
              <IconButton icon={isOrganizer ? 'settings' : 'more-horizontal'} variant="glass" accessibilityLabel={isOrganizer ? 'Innstillinger' : 'Mer'} onPress={() => setMoreOpen(true)} />
            </View>
          </View>
          <Animated.View entering={FadeInDown.duration(450)} style={{ position: 'absolute', left: gutter, right: gutter, bottom: radius.xl + spacing.md }}>
            <Icon name={category.icon} size={26} tint="#FF9A8B" />
            <Text variant="display" style={{ color: '#fff', marginTop: spacing.md }} accessibilityRole="header">
              {e.title}
            </Text>
            {themeSpec && (e.activityTheme || canTheme) ? (
              <PressableScale
                disabled={!canTheme}
                onPress={() => setThemeOpen(true)}
                accessibilityRole={canTheme ? 'button' : undefined}
                accessibilityLabel={e.activityTheme ? `${themeSpec.label}: ${e.activityTheme}${canTheme ? '. Trykk for å endre' : ''}` : `Legg til ${themeSpec.label.toLowerCase()}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, alignSelf: 'flex-start' }}
              >
                <Text variant="title3" style={{ color: e.activityTheme ? '#fff' : '#FF9A8B' }}>
                  {e.activityTheme ? `${themeSpec.label}: ${e.activityTheme}` : `+ Legg til ${themeSpec.label.toLowerCase()}`}
                </Text>
                {e.activityTheme && canTheme ? <Icon name="edit-2" size={14} tint="rgba(255,255,255,0.6)" /> : null}
              </PressableScale>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
              <Avatar name={e.organizer.name} uri={e.organizer.avatarUrl} size={28} />
              <Text variant="callout" style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 1 }} numberOfLines={1}>
                {isOwner ? 'Du arrangerer' : `Arrangert av ${firstName(e.organizer.name)}`}
              </Text>
              {e.status === 'cancelled' ? <Tag label="Avlyst" tone="glass" /> : null}
            </View>
          </Animated.View>
        </View>

        <View style={{ marginTop: -radius.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background, paddingHorizontal: gutter, paddingTop: spacing.lg }}>
          <Animated.View entering={FadeInDown.delay(120).duration(420)}>
            <InfoTiles tiles={tiles} />
            {place || price || e.series ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                {place ? <InfoLine icon="map-pin" text={place} /> : null}
                {price ? <InfoLine icon="tag" text={price.detail ? `${price.headline} · ${price.detail}` : price.headline} /> : null}
                {price && mine?.paysShare === false ? <InfoLine icon="gift" text="Du deler ikke kostnaden" /> : null}
                {e.series && e.series.status !== 'ended' ? (
                  <InfoLine icon="repeat" text={`${repeatSummary(e.series, e.selectedDate)}${e.series.status === 'paused' ? ' · på pause' : ''}`} />
                ) : null}
              </View>
            ) : null}
          </Animated.View>

          {activity && e.status !== 'cancelled' ? <ActivityRoleCard activity={e.activityType} role={e.activityRole} isOrganizer={isOrganizer} style={{ marginTop: spacing.xl }} /> : null}
          {kit && e.status !== 'cancelled' ? <ActivityKit event={e} type={kit} isOrganizer={isOrganizer} isMember={!!mine} style={{ marginTop: spacing.xl }} /> : null}
          {activity && isOrganizer && canInvite && e.activityRole?.status === 'confirmed' && !e.members.some((m) => m.role !== 'organizer') ? (
            <Card style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Text variant="headline">Klar for invitasjon</Text>
              <Text variant="footnote" color="textSecondary">
                {activity.role.definite.charAt(0).toUpperCase() + activity.role.definite.slice(1)} har sagt ja. Inviter deltagerne når du vil – de ser at det er bekreftet.
              </Text>
              <Button variant="ink" icon="user-plus" title="Inviter deltagere" onPress={() => router.push(`/event/${e.id}/invite`)} />
            </Card>
          ) : null}

          {isPast && e.series?.status === 'active' ? (
            <Card muted style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="repeat" size={18} color="textSecondary" />
              <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
                Neste gang lages automatisk – du finner den på Hjem.
              </Text>
            </Card>
          ) : isPast && e.groupId ? (
            <Card style={{ marginTop: spacing.xl, backgroundColor: colors.feature, borderWidth: 0 }}>
              <Text variant="title3" style={{ color: colors.textOnFeature }}>
                Skal vi finne neste dato?
              </Text>
              <Text variant="subhead" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Samme gjeng, samme greie. Ett trykk, så er planleggingen i gang.
              </Text>
              <Button title="Finn neste dato" icon="refresh-cw" size="md" onPress={findDate} style={{ marginTop: spacing.lg }} />
            </Card>
          ) : isPast || (isOrganizer && !e.groupId && e.status === 'confirmed' && e.members.length > 2) ? (
            <Card style={{ marginTop: spacing.xl, backgroundColor: colors.feature, borderWidth: 0 }}>
              <Text variant="title3" style={{ color: colors.textOnFeature }}>
                Skal dere gjøre dette igjen?
              </Text>
              <Text variant="subhead" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Lag en gjeng av de {e.members.length} som var med, så er neste gang ett trykk.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <Button title="Lag gruppe av gjengen" icon="users" size="md" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/group/new', params: { fromEvent: e.id } })} />
                {isPast ? <Button title="Finn dato" variant="light" size="md" fullWidth={false} onPress={findDate} /> : null}
              </View>
            </Card>
          ) : null}

          {e.status !== 'cancelled' && !roleHolder ? <EventMessages eventId={e.id} isOrganizer={isOrganizer} style={{ marginTop: spacing.xl }} /> : null}

          {roleHolder ? (
            <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
              {e.description ? <Text variant="body">{e.description}</Text> : null}
              <Card style={{ paddingVertical: spacing.xs }}>
                <ListRow icon="calendar" title={when} subtitle={time ?? undefined} />
                {place ? <ListRow icon="map-pin" title={e.location!.name} subtitle={e.location!.detailsPending ? 'Detaljer kommer' : e.location!.address ?? undefined} /> : null}
                <ListRow icon="user" title={`Arrangert av ${firstName(e.organizer.name)}`} />
                {e.activityRole?.token ? (
                  <ListRow
                    icon="edit-3"
                    title="Endre svaret ditt"
                    subtitle="Kan du likevel ikke? Si fra, så finner arrangøren en annen."
                    chevron
                    onPress={() => router.push({ pathname: '/r/[token]', params: { token: e.activityRole!.token! } })}
                  />
                ) : null}
              </Card>
            </View>
          ) : null}

          {roleHolder ? null : (
          <>
          <View style={{ marginTop: spacing.xl }}>
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              items={[
                { id: 'guests', label: 'Gjesteliste' },
                { id: 'details', label: 'Detaljer' },
                { id: 'photos', label: 'Bilder' },
              ]}
            />
          </View>

          <View style={{ paddingTop: spacing.xl }}>
            {tab === 'guests' ? (
                <GuestList
                  members={e.members}
                  interest={e.status === 'draft'}
                  showSeen={isOrganizer}
                  pendingAction={isOrganizer ? <RemindButton event={e} onShareLinks={() => setShareOpen(true)} /> : undefined}
                  onPressMember={(m) => {
                    if (m.userId === meId) return;
                    setPersonMember(m);
                  }}
                />
              ) : null}
            {tab === 'details' ? (
              <View style={{ gap: spacing.lg }}>
                {e.description ? <Text variant="body">{e.description}</Text> : <Text variant="body" color="textSecondary">Ingen detaljer ennå.</Text>}
                <Card style={{ paddingVertical: spacing.xs }}>
                  <ListRow icon="calendar" title={when} subtitle={time ?? undefined} />
                  {place ? <ListRow icon="map-pin" title={e.location!.name} subtitle={e.location!.detailsPending ? 'Detaljer kommer' : e.location!.address ?? undefined} /> : null}
                  <ListRow icon="user" title={`Arrangert av ${firstName(e.organizer.name)}`} />
                </Card>
                {isOrganizer ? <Button title="Legg til detaljer" variant="secondary" icon="edit-2" onPress={() => router.push(`/event/${e.id}/edit`)} /> : null}
              </View>
            ) : null}
            {tab === 'photos' && canAddPhotos ? (
              <Button title="Del bilder" icon="image" variant="secondary" size="md" loading={addPhotosMutation.isPending} onPress={addPhotos} style={{ marginBottom: spacing.lg }} />
            ) : null}
            {tab === 'photos' ? (
              e.photos.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {e.photos.map((p) => (
                    <Image key={p} source={{ uri: thumb(p, 500) }} style={{ width: '48.6%', aspectRatio: 1, borderRadius: radius.md }} contentFit="cover" />
                  ))}
                </View>
              ) : (
                <EmptyState icon="image" title="Bildene kommer her" body={canAddPhotos ? 'Ingen har delt bilder ennå. Del de første!' : 'Fra dagen det skjer kan alle dele bilder her.'} />
              )
            ) : null}
          </View>
          </>
          )}
        </View>
      </ScrollView>

      {themeSpec ? (
        <ThemeSheet
          visible={themeOpen}
          onClose={() => setThemeOpen(false)}
          activity={e.activityType}
          value={e.activityTheme ?? null}
          subtitle={`${e.title} · ${when}`}
          loading={setTheme.isPending}
          onSave={saveTheme}
        />
      ) : null}

      {e.status === 'draft' && isOrganizer ? (
        <BottomBar>
          {interested || notInterested ? (
            <Text variant="callout" align="center" color="textSecondary">
              {[interested ? `${interested} er med` : null, notInterested ? `${notInterested} ikke denne gangen` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Button title="Finn dato" icon="calendar" onPress={findDate} accessibilityHint="Velg mulige dager. Alle som ikke har sagt nei, får spørsmål om datoene." />
        </BottomBar>
      ) : showInterest ? (
        <BottomBar>
          <Text variant="callout" align="center" color="textSecondary">
            {mine!.status === 'attending'
              ? `Du er med. Du får beskjed når ${firstName(e.organizer.name)} foreslår datoer.`
              : mine!.status === 'declined'
                ? 'Du har sagt ikke denne gangen'
                : 'Datoen er ikke satt ennå – er du med?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Ikke denne gangen"
              variant={mine!.status === 'declined' ? 'ink' : 'secondary'}
              style={{ flex: 1 }}
              onPress={() =>
                mine!.status === 'declined' || confirmDecline(firstName(e.organizer.name), true, () => rsvp.mutate(false, { onSuccess: () => toast(`${firstName(e.organizer.name)} har fått svaret ditt`) }))
              }
            />
            <Button
              title="Jeg er med"
              icon="check"
              variant={mine!.status === 'attending' ? 'ink' : 'primary'}
              style={{ flex: 1 }}
              onPress={() => rsvp.mutate(true, { onSuccess: () => toast({ message: `Supert! ${firstName(e.organizer.name)} vet at du er med.`, tone: 'success' }) })}
            />
          </View>
        </BottomBar>
      ) : showRsvp && mine!.status === 'waitlisted' ? (
        <BottomBar>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="clock" size={22} color="textSecondary" />
            <View style={{ flex: 1 }}>
              <Text variant="headline">Du står på venteliste{myQueue ? ` (nr. ${myQueue})` : ''}</Text>
              <Text variant="footnote" color="textSecondary">
                Du får beskjed hvis det blir ledig plass.
              </Text>
            </View>
            <Button
              title="Meld av"
              variant="secondary"
              size="sm"
              onPress={() => confirmDecline(firstName(e.organizer.name), true, () => rsvp.mutate(false, { onSuccess: () => toast('Du er meldt av ventelisten') }))}
            />
          </View>
        </BottomBar>
      ) : showRsvp && mine!.status === 'attending' ? (
        // Answered yes: a quiet confirmation, and a way out that tells the organizer.
        <BottomBar>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="check-circle" size={22} color="success" />
            <Text variant="headline" style={{ flex: 1 }}>
              Du kommer
            </Text>
            <Button
              title="Kan ikke likevel"
              variant="secondary"
              size="sm"
              onPress={() =>
                confirmDestructive(
                  'Kan du ikke likevel?',
                  `${firstName(e.organizer.name)} får beskjed om at du ikke kommer.`,
                  'Meld meg av',
                  () => rsvp.mutate(false, { onSuccess: () => toast(`${firstName(e.organizer.name)} har fått beskjed`) }),
                )
              }
            />
          </View>
        </BottomBar>
      ) : showRsvp ? (
        <BottomBar>
          {mine!.status !== 'declined' ? <CalendarConflict when={{ date: e.selectedDate!, startTime: e.startTime, timeHint: e.timeHint, eventId: e.id }} /> : null}
          <Text variant="callout" align="center" color="textSecondary">
            {mine!.status === 'declined' ? 'Du har sagt at du ikke kan' : e.spontaneous ? 'Er du gira?' : 'Kommer du?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Kan ikke"
              variant={mine!.status === 'declined' ? 'ink' : 'secondary'}
              style={{ flex: 1 }}
              onPress={() => mine!.status === 'declined' || confirmDecline(firstName(e.organizer.name), true, () => rsvp.mutate(false, { onSuccess: () => toast('Svaret ditt er sendt') }))}
            />
            <Button
              title={full ? 'Sett meg på venteliste' : e.spontaneous ? 'Jeg blir med' : 'Kommer'}
              icon={full ? 'clock' : 'check'}
              variant={mine!.status === 'attending' ? 'ink' : 'primary'}
              style={{ flex: 1 }}
              onPress={() =>
                rsvp.mutate(true, {
                  onSuccess: () => toast(full ? { message: 'Du står på ventelisten – du får beskjed om det blir plass', icon: 'clock' } : { message: 'Så gøy! Vi sees.', tone: 'success' }),
                })
              }
            />
          </View>
        </BottomBar>
      ) : null}

      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} event={e} />
      <MemberSheet
        member={personMember ? (e.members.find((m) => m.id === personMember.id) ?? null) : null}
        canRemove={isOrganizer}
        canSetAnswer={isOrganizer && (e.status === 'confirmed' || e.status === 'date_selected')}
        hasPrice={!!e.price}
        onClose={() => setPersonMember(null)}
      />
      {isOwner ? (
        <Sheet visible={rolesOpen} onClose={() => setRolesOpen(false)} title="Medarrangører og plasser" scroll>
          {roles ? <SeriesPeopleEditor members={e.members} value={roles} onChange={setRoles} recurring={!!e.series} /> : null}
          <Button
            title="Lagre"
            variant="ink"
            loading={savingRoles}
            style={{ marginTop: spacing.lg }}
            onPress={async () => {
              if (roles) {
                setSavingRoles(true);
                try {
                  if (seriesId) {
                    await repo.setSeriesPeople(seriesId, roles);
                  } else {
                    await repo.setEventPeople(e.id, { cohostIds: roles.cohostIds, reservedIds: roles.reservedIds });
                    if (roles.maxParticipants !== (e.maxParticipants ?? null)) await updateEvent.mutateAsync({ maxParticipants: roles.maxParticipants });
                  }
                  await queryClient.invalidateQueries();
                  toast({ message: 'Lagret', tone: 'success' });
                  setRolesOpen(false);
                } catch {
                  toast({ message: 'Kunne ikke lagre', tone: 'error' });
                } finally {
                  setSavingRoles(false);
                }
              }
            }}
          />
        </Sheet>
      ) : null}
      {e.series ? (
        <Sheet visible={repeatOpen} onClose={() => setRepeatOpen(false)} title="Endre gjentakelse">
          <RepeatEditor value={repeatDraft ?? e.series} poll={e.series.dateMode === 'poll_each'} firstDate={e.selectedDate} onChange={(patch) => setRepeatDraft({ ...(repeatDraft ?? e.series!), ...patch })} />
          <Button
            title="Lagre"
            variant="ink"
            loading={updateSeries.isPending}
            style={{ marginTop: spacing.lg }}
            onPress={async () => {
              if (repeatDraft) {
                const { id: _id, status: _status, ...patch } = repeatDraft;
                await updateSeries.mutateAsync({ seriesId: e.series!.id, patch });
              }
              setRepeatOpen(false);
              setRepeatDraft(null);
              toast({ message: 'Gjelder fra neste gang', tone: 'success' });
            }}
          />
        </Sheet>
      ) : null}
      <AttendeesSheet
        visible={whoOpen}
        onClose={() => setWhoOpen(false)}
        subtitle={e.maxParticipants ? placesLabel : undefined}
        role={activity && e.activityRole?.status === 'confirmed' && e.activityRole.name ? { label: activity.role.label, name: e.activityRole.name } : null}
        coming={coming.map((m) => ({ id: m.id, name: m.person.name, avatarUrl: m.person.avatarUrl, tag: m.role === 'organizer' ? 'Arrangør' : m.isCohost ? 'Medarrangør' : undefined }))}
        waitlist={waitlist.map((m) => ({ id: m.id, name: m.person.name, avatarUrl: m.person.avatarUrl }))}
      />
      <Sheet
        visible={moreOpen}
        onClose={() => {
          setMoreOpen(false);
          setReporting(false);
        }}
        title={reporting ? 'Rapporter arrangementet' : isOrganizer ? 'Innstillinger' : e.title}
        subtitle={!reporting && isOrganizer ? e.title : undefined}
        scroll
        onClosed={() => {
          const open = afterMore.current;
          afterMore.current = null;
          open?.();
        }}
      >
        {reporting ? (
          <ReportForm
            target={{ eventId: e.id }}
            onDone={() => {
              setMoreOpen(false);
              setReporting(false);
            }}
          />
        ) : (
          <View style={{ gap: spacing.lg }}>
            <MenuGroup title={isOrganizer ? 'Arrangementet' : undefined}>
              {[
                isOrganizer && e.status !== 'cancelled' ? (
                  <ListRow key="edit" icon="edit-2" title="Rediger" subtitle="Navn, dato og tid, sted og beskrivelse" chevron onPress={() => openAfterMore(() => router.push(`/event/${e.id}/edit`))} />
                ) : null,
                canTheme && isOrganizer ? (
                  <ListRow key="theme" icon="star" title={themeSpec!.label} subtitle={e.activityTheme ?? 'Ikke satt'} chevron onPress={() => openAfterMore(() => setThemeOpen(true))} />
                ) : null,
                canAddToCalendar ? (
                  <ListRow
                    key="calendar"
                    icon="calendar"
                    title="Legg i kalender"
                    onPress={() => {
                      setMoreOpen(false);
                      void calendar();
                    }}
                  />
                ) : null,
                e.groupId && isOrganizer ? <ListRow key="group" icon="users" title="Gå til gjengen" chevron onPress={() => openAfterMore(() => router.push(`/group/${e.groupId}`))} /> : null,
              ]}
            </MenuGroup>
            {isOrganizer ? (
              <MenuGroup title="Folk og plasser">
                {[
                  isOwner && !isPast && e.status !== 'cancelled' && e.series?.status !== 'ended' ? (
                    <ListRow key="roles" icon="user-check" title="Medarrangører og plasser" subtitle="Hvem som har alltid plass, og hvor mange" chevron onPress={() => openAfterMore(() => setRolesOpen(true))} />
                  ) : null,
                  canInvite && e.inviteToken ? (
                    <ListRow key="share" icon="share-2" title="Del invitasjonen" subtitle="Lenke på SMS, Snapchat eller i gruppechatten" chevron onPress={() => openAfterMore(() => setShareOpen(true))} />
                  ) : null,
                ]}
              </MenuGroup>
            ) : null}
            {isOwner && e.series && e.series.status !== 'ended' ? (
              <MenuGroup title="Gjentakelse">
                {[
                  <ListRow key="repeat" icon="repeat" title="Endre gjentakelse" subtitle={repeatSummary(e.series, e.selectedDate)} chevron onPress={() => openAfterMore(() => setRepeatOpen(true))} />,
                  <ListRow
                    key="pause"
                    icon={e.series.status === 'paused' ? 'play' : 'pause'}
                    title={e.series.status === 'paused' ? 'Fortsett gjentakelsen' : 'Sett gjentakelsen på pause'}
                    onPress={async () => {
                      setMoreOpen(false);
                      const status = e.series!.status === 'paused' ? 'active' : 'paused';
                      await updateSeries.mutateAsync({ seriesId: e.series!.id, patch: { status } });
                      toast(status === 'paused' ? 'Satt på pause – ingen nye runder før du fortsetter' : 'Gjentakelsen fortsetter');
                    }}
                  />,
                  <ListRow
                    key="end"
                    icon="x-circle"
                    title="Avslutt gjentakelsen"
                    destructive
                    onPress={() =>
                      confirmDestructive('Avslutte gjentakelsen?', 'Dette arrangementet blir som det er, men det lages ingen nye.', 'Avslutt', async () => {
                        setMoreOpen(false);
                        await updateSeries.mutateAsync({ seriesId: e.series!.id, patch: { status: 'ended' } });
                        toast('Gjentakelsen er avsluttet');
                      })
                    }
                  />,
                ]}
              </MenuGroup>
            ) : null}
            <MenuGroup>
              {[
                !isOrganizer ? <ListRow key="report" icon="flag" title="Rapporter arrangementet" subtitle="Også bilder som er delt her" onPress={() => setReporting(true)} /> : null,
                isOwner && !isPast && e.status !== 'cancelled' ? <ListRow key="cancel" icon="x-circle" title="Avlys arrangementet" subtitle="Alle som er invitert får beskjed" destructive onPress={confirmCancel} /> : null,
              ]}
            </MenuGroup>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

/** A card of menu rows with dividers, under a small heading. Empty groups disappear. */
function MenuGroup({ title, children }: { title?: string; children: (ReactElement | null | false)[] }) {
  const rows = children.filter((r): r is ReactElement => !!r);
  if (!rows.length) return null;
  return (
    <View>
      {title ? (
        <Text variant="overline" color="textTertiary" style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
          {title}
        </Text>
      ) : null}
      <Card style={{ paddingVertical: spacing.xs }}>
        {rows.map((r, i) => (
          <View key={r.key ?? i}>
            {i ? <Divider /> : null}
            {r}
          </View>
        ))}
      </Card>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icon} size={16} color="textSecondary" />
      <Text variant="callout" color="textSecondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
