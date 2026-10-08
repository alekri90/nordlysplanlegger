import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ActionButton } from '@/components/event/ActionButton';
import { EventHero } from '@/components/event/EventHero';
import { GuestList } from '@/components/event/GuestList';
import { ResultsView } from '@/components/event/ResultsView';
import { ShareSheet } from '@/components/event/ShareSheet';
import { BottomBar, Button, Card, EmptyState, ErrorState, Icon, IconButton, ListRow, PageSkeleton, Screen, Segmented, Sheet, Text, useToast, type IconName } from '@/components/ui';
import { useAddEventPhotos, useCancelEvent, useEvent, useSetRsvp } from '@/data/hooks';
import type { Person, PlannerEvent } from '@/data/types';
import { PersonSheet } from '@/components/people/PersonSheet';
import { ReportForm } from '@/components/people/ReportSheet';
import { CATEGORIES, thumb } from '@/lib/categories';
import { formatLong, formatTime, today } from '@/lib/dates';
import { addEventToCalendar } from '@/lib/eventActions';
import { firstName, timeHintLabel } from '@/lib/eventText';
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
  const isOrganizer = e.organizer.id === me?.id;
  if (e.status === 'polling' && isOrganizer) return <ResultsView event={e} />;
  if (e.status === 'polling' && e.inviteToken) return <Redirect href={`/i/${e.inviteToken}`} />;
  return <EventDetail event={e} isOrganizer={isOrganizer} meId={me?.id} />;
}

type Tab = 'guests' | 'details' | 'photos';

function EventDetail({ event: e, isOrganizer, meId }: { event: PlannerEvent; isOrganizer: boolean; meId?: string }) {
  const colors = useColors();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('guests');
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const rsvp = useSetRsvp(e.id);
  const cancel = useCancelEvent(e.id);
  const addPhotosMutation = useAddEventPhotos(e.id);
  const prefillFromEvent = useCreateDraft((s) => s.prefillFromEvent);

  const mine = e.members.find((m) => m.userId === meId);
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

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 140 }}>
        <EventHero
          imageUrl={e.coverImageUrl}
          height={300}
          right={<IconButton icon="share" variant="glass" accessibilityLabel="Del" onPress={() => setShareOpen(true)} />}
        />
        <View style={{ marginTop: -spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background, paddingHorizontal: gutter, paddingTop: spacing.xxl }}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={category.icon} size={16} color="primary" />
              </View>
              <Text variant="title1" style={{ flex: 1 }} accessibilityRole="header">
                {e.title}
              </Text>
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <InfoLine icon="calendar" text={time ? `${when} · ${time}` : when} />
              {place ? <InfoLine icon="map-pin" text={place} /> : null}
              {!isOrganizer ? <InfoLine icon="user" text={`Arrangert av ${firstName(e.organizer.name)}`} /> : null}
            </View>
          </Animated.View>

          {isPast && e.groupId ? (
            <Card style={{ marginTop: spacing.xl, backgroundColor: colors.ink, borderWidth: 0 }}>
              <Text variant="title3" style={{ color: colors.textOnInk }}>
                Skal vi finne neste dato?
              </Text>
              <Text variant="subhead" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Samme gjeng, samme greie. Ett trykk, så er planleggingen i gang.
              </Text>
              <Button title="Finn neste dato" icon="refresh-cw" size="md" onPress={findDate} style={{ marginTop: spacing.lg }} />
            </Card>
          ) : isPast || (isOrganizer && !e.groupId && e.status === 'confirmed' && e.members.length > 2) ? (
            <Card style={{ marginTop: spacing.xl, backgroundColor: colors.ink, borderWidth: 0 }}>
              <Text variant="title3" style={{ color: colors.textOnInk }}>
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

          <View style={{ flexDirection: 'row', marginTop: spacing.xl }}>
            {e.selectedDate && !isPast ? <ActionButton icon="calendar" label="Kalender" onPress={calendar} /> : null}
            <ActionButton icon="share-2" label="Del" onPress={() => setShareOpen(true)} />
            {isOrganizer ? <ActionButton icon="edit-2" label="Rediger" onPress={() => router.push(`/event/${e.id}/edit`)} /> : null}
            <ActionButton icon="more-horizontal" label="Mer" onPress={() => setMoreOpen(true)} />
          </View>

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
            {tab === 'guests' ? <GuestList members={e.members} onPressMember={(m) => m.userId !== meId && setPerson(m.person)} /> : null}
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
        </View>
      </ScrollView>

      {e.status === 'draft' && isOrganizer ? (
        <BottomBar>
          <Button title="Finn dato" icon="calendar" onPress={findDate} accessibilityHint="Velg mulige dager og la gjengen svare" />
        </BottomBar>
      ) : showRsvp ? (
        <BottomBar>
          <Text variant="callout" align="center" color="textSecondary">
            {mine!.status === 'attending' ? 'Du har sagt at du kommer' : mine!.status === 'declined' ? 'Du har sagt at du ikke kan' : 'Kommer du?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Kan ikke"
              variant={mine!.status === 'declined' ? 'ink' : 'secondary'}
              style={{ flex: 1 }}
              onPress={() => rsvp.mutate(false, { onSuccess: () => toast('Svaret ditt er sendt') })}
            />
            <Button
              title="Kommer"
              icon="check"
              variant={mine!.status === 'attending' ? 'ink' : 'primary'}
              style={{ flex: 1 }}
              onPress={() => rsvp.mutate(true, { onSuccess: () => toast({ message: 'Så gøy! Vi sees.', tone: 'success' }) })}
            />
          </View>
        </BottomBar>
      ) : null}

      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} title={e.title} token={e.inviteToken} organizerName={firstName(e.organizer.name)} />
      <PersonSheet person={person} onClose={() => setPerson(null)} />
      <Sheet visible={moreOpen} onClose={() => { setMoreOpen(false); setReporting(false); }} title={reporting ? 'Rapporter arrangementet' : e.title}>
        {reporting ? (
          <ReportForm target={{ eventId: e.id }} onDone={() => { setMoreOpen(false); setReporting(false); }} />
        ) : (
          <>
            {e.selectedDate && !isPast ? <ListRow icon="calendar" title="Legg i kalender" onPress={() => { setMoreOpen(false); calendar(); }} /> : null}
            <ListRow icon="share-2" title="Del invitasjonen" onPress={() => { setMoreOpen(false); setShareOpen(true); }} />
            {isOrganizer && e.groupId ? <ListRow icon="users" title="Gå til gjengen" onPress={() => { setMoreOpen(false); router.push(`/group/${e.groupId}`); }} /> : null}
            {!isOrganizer ? <ListRow icon="flag" title="Rapporter arrangementet" subtitle="Også bilder som er delt her" onPress={() => setReporting(true)} /> : null}
            {isOrganizer && !isPast ? <ListRow icon="x-circle" title="Avlys arrangementet" destructive onPress={confirmCancel} /> : null}
          </>
        )}
      </Sheet>
    </Screen>
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
