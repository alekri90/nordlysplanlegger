import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/brand/AppLogo';
import { EventMessages } from '@/components/event/EventMessages';
import { Avatar, AvatarStack, Button, EmptyState, Icon, IconButton, Input, PressableScale, Sheet, Skeleton, Tag, Text, useToast, type IconName } from '@/components/ui';
import { useInvite, useSubmitRsvp } from '@/data/hooks';
import type { InviteView } from '@/data/types';
import { CATEGORIES } from '@/lib/categories';
import { formatLong, formatTime } from '@/lib/dates';
import { firstName, inviteSubtitle, optionsSummary, timeHintLabel } from '@/lib/eventText';
import { getGuestName } from '@/lib/guestIdentity';
import { useMe } from '@/state/session';
import { gutter, radius, spacing } from '@/theme';

const INK = '#16120F';

/**
 * The invitation. Visually strong, one question: "Hvilke dager kan du ikke?"
 * Works without an account, in the app and as a mobile web page.
 */
export default function Invitation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const invite = useInvite(token);
  const insets = useSafeAreaInsets();

  if (invite.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: INK }}>
        <Skeleton height={420} rounded={0} style={{ opacity: 0.15 }} />
      </View>
    );
  }
  if (!invite.data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FBF8F6', paddingTop: insets.top + spacing.huge }}>
        <EmptyState icon="link-2" title="Invitasjonen finnes ikke lenger" body="Den kan ha blitt avlyst. Spør den som inviterte deg om en ny lenke." />
      </View>
    );
  }
  return <InvitationView invite={invite.data} />;
}

function InvitationView({ invite }: { invite: InviteView }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const me = useMe();
  const rsvp = useSubmitRsvp(invite.token);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [nameSheet, setNameSheet] = useState<null | boolean>(null);
  const [name, setName] = useState('');
  const [knownName, setKnownName] = useState<string | null>(null);

  useEffect(() => {
    getGuestName().then(setKnownName);
  }, []);

  const e = invite.event;
  const isOrganizer = !!me && me.id === invite.organizer.id;
  const responded = invite.myResponse && invite.myResponse.status !== 'invited' && invite.myResponse.status !== 'opened';
  const isPoll = e.status === 'polling';
  const isDated = !!e.selectedDate && (e.status === 'confirmed' || e.status === 'date_selected');

  const tiles: { icon: IconName; label: string }[] = [
    isDated
      ? { icon: 'calendar', label: formatLong(e.selectedDate!) }
      : { icon: 'calendar', label: e.options.length ? optionsSummary(e.options.map((o) => o.date)) : 'Dato kommer' },
    { icon: 'clock', label: e.startTime ? `Kl. ${formatTime(e.startTime)}` : timeHintLabel(e.timeHint) },
    { icon: 'users', label: `${invite.invitedCount} inviterte` },
  ];

  const sendRsvp = async (attending: boolean, guestName?: string) => {
    if (!me && !guestName && !knownName && !invite.myResponse) {
      setNameSheet(attending);
      return;
    }
    try {
      await rsvp.mutateAsync({ attending, name: guestName ?? knownName ?? undefined });
      setNameSheet(null);
      router.push({ pathname: '/i/[token]/done', params: { token: invite.token, attending: attending ? '1' : '0' } });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Noe gikk galt', tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK }}>
      <StatusBar style="light" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ minHeight: height, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }}>
        <View style={{ height: Math.max(380, height * 0.56) }}>
          <Image source={{ uri: e.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={['rgba(22,18,15,0.45)', 'rgba(22,18,15,0)', 'rgba(22,18,15,0.6)', INK]} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', top: insets.top + spacing.xs, left: gutter - 8, right: gutter - 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            {router.canGoBack() ? <IconButton icon="chevron-left" variant="glass" accessibilityLabel="Tilbake" onPress={() => router.back()} /> : <AppLogo size={36} />}
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={{ position: 'absolute', left: gutter, right: gutter, bottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Icon name={(CATEGORIES[e.category] ?? CATEGORIES.hangout).icon} size={26} tint="#FF9A8B" />
            </View>
            <Text variant="display" style={{ color: '#fff' }} accessibilityRole="header">
              {e.title}
            </Text>
            <Text variant="title3" style={{ color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }}>
              {inviteSubtitle(invite)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
              <Avatar name={invite.organizer.name} uri={invite.organizer.avatarUrl} size={28} />
              <Text variant="callout" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Arrangert av {firstName(invite.organizer.name)}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(450)} style={{ paddingHorizontal: gutter }}>
          <View style={{ flexDirection: 'row', borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: spacing.sm }}>
            {tiles.map((t, i) => (
              <View
                key={t.icon}
                accessible
                accessibilityLabel={t.label}
                style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.08)' }}
              >
                <Icon name={t.icon} size={20} tint="rgba(255,255,255,0.85)" />
                <Text variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.8)' }} numberOfLines={2}>
                  {t.label}
                </Text>
              </View>
            ))}
          </View>

          {invite.respondents.length > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' }}>
              <AvatarStack people={invite.respondents} size={26} max={5} />
              <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {invite.respondents.length} har svart
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {isOrganizer ? (
              <>
                <View style={{ alignSelf: 'center', marginBottom: spacing.sm }}>
                  <Tag label="Slik ser gjestene invitasjonen" tone="glass" icon="eye" />
                </View>
                <Button title={isPoll ? 'Se resultater' : 'Til arrangementet'} onPress={() => router.replace(`/event/${e.id}`)} />
              </>
            ) : isPoll ? (
              <>
                {responded ? (
                  <View style={{ alignSelf: 'center', marginBottom: spacing.sm }}>
                    <Tag label="Du har svart" tone="success" icon="check" />
                  </View>
                ) : null}
                <Button
                  title={responded ? 'Endre svaret ditt' : 'Hvilke dager kan du ikke?'}
                  onPress={() => router.push({ pathname: '/i/[token]/respond', params: { token: invite.token } })}
                  accessibilityHint="Åpner en kalender der du trykker på dagene som ikke passer"
                />
              </>
            ) : isDated ? (
              <>
                <Text variant="headline" align="center" style={{ color: '#fff', marginBottom: spacing.sm }}>
                  {invite.myResponse?.status === 'attending' ? 'Du kommer 🎉' : invite.myResponse?.status === 'declined' ? 'Du har sagt at du ikke kan' : 'Kommer du?'}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="Kan ikke" variant="secondary" style={{ flex: 1 }} onPress={() => sendRsvp(false)} disabled={rsvp.isPending} />
                  <Button title="Kommer" icon="check" style={{ flex: 1 }} onPress={() => sendRsvp(true)} loading={rsvp.isPending} />
                </View>
              </>
            ) : (
              <Text variant="callout" align="center" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {firstName(invite.organizer.name)} finner en dato snart. Du får beskjed.
              </Text>
            )}
            <PressableScale onPress={() => setDetailsOpen(true)} style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Se detaljer">
              <Text variant="callout" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Se detaljer
              </Text>
              <Icon name="chevron-right" size={16} tint="rgba(255,255,255,0.6)" />
            </PressableScale>
          </View>
          {/* Signed-in members also see the organizer's updates here while the date is being found. */}
          {me && !isOrganizer ? <EventMessages eventId={e.id} isOrganizer={false} style={{ marginTop: spacing.lg }} /> : null}
        </Animated.View>
      </ScrollView>

      <Sheet visible={detailsOpen} onClose={() => setDetailsOpen(false)} title={e.title}>
        <View style={{ gap: spacing.md }}>
          <Detail icon="calendar" text={isDated ? formatLong(e.selectedDate!) : e.periodLabel ?? 'Dato bestemmes'} />
          <Detail icon="clock" text={e.startTime ? `Kl. ${formatTime(e.startTime)}` : timeHintLabel(e.timeHint)} />
          {e.location ? <Detail icon="map-pin" text={`${e.location.name}${e.location.detailsPending ? ' (detaljer kommer)' : ''}`} /> : null}
          <Detail icon="user" text={`Arrangert av ${firstName(invite.organizer.name)}`} />
          {e.description ? (
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              {e.description}
            </Text>
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={nameSheet !== null} onClose={() => setNameSheet(null)} title="Hva heter du?" subtitle="Så vet de hvem som svarer. Du trenger ingen konto.">
        <Input size="lg" autoFocus value={name} onChangeText={setName} placeholder="Fornavn" autoCapitalize="words" maxLength={60} />
        <Button title="Send svar" variant="ink" disabled={!name.trim()} loading={rsvp.isPending} onPress={() => sendRsvp(!!nameSheet, name.trim())} style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={icon} size={18} color="textSecondary" />
      <Text variant="callout" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
