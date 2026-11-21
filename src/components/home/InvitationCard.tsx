import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { confirmDecline } from '@/components/event/confirmDecline';
import { Button, Icon, PressableScale, Text, useToast } from '@/components/ui';
import { useSubmitRsvp } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { thumb } from '@/lib/categories';
import { formatShort, formatTime } from '@/lib/dates';
import { firstName, optionsSummary, spontaneousWhen } from '@/lib/eventText';
import { radius, spacing, useColors } from '@/theme';

/**
 * An invitation on Hjem: who, what, when — and the answer right there. With a date, «Bli med» is
 * one tap. Finding a date needs the days, so «Svar» opens the calendar. «Kan ikke» asks first.
 */
export function InvitationCard({ event: e, style }: { event: PlannerEvent; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const toast = useToast();
  const token = e.inviteToken ?? '';
  const rsvp = useSubmitRsvp(token);
  const host = firstName(e.organizer.name);
  const poll = e.status === 'polling';
  const interest = e.status === 'draft';
  const full = !!e.maxParticipants && (e.placesTaken ?? 0) >= e.maxParticipants;

  const time = e.startTime ? `kl. ${formatTime(e.startTime)}` : null;
  const when = poll
    ? `Velg dager · ${optionsSummary(e.options.map((o) => o.date))}`
    : interest
      ? 'Dato ikke satt ennå'
      : (e.spontaneous && spontaneousWhen(e)) || [e.selectedDate ? formatShort(e.selectedDate) : null, time].filter(Boolean).join(' · ');
  const yes = poll ? 'Svar' : interest ? 'Jeg er med' : full ? 'Venteliste' : e.spontaneous ? 'Jeg blir med' : 'Bli med';

  const open = () => router.push(`/i/${token}`);
  const answer = async (attending: boolean) => {
    try {
      await rsvp.mutateAsync({ attending });
      toast(
        attending
          ? full
            ? { message: 'Du står på ventelisten – du får beskjed om det blir plass', icon: 'clock' }
            : { message: interest ? `${host} vet at du er med` : `Du kommer! ${host} får beskjed.`, tone: 'success' }
          : `${host} har fått svaret ditt`,
      );
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Kunne ikke sende svaret', tone: 'error' });
    }
  };
  const accept = () => (poll ? router.push({ pathname: '/i/[token]/respond', params: { token } }) : answer(true));
  const decline = () => confirmDecline(host, true, () => void answer(false));

  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }, style]}>
      <PressableScale onPress={open} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${host} inviterer deg: ${e.title}. ${when}`} accessibilityHint="Åpner invitasjonen" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Image source={{ uri: thumb(e.coverImageUrl, 200) }} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" transition={200} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {e.spontaneous ? <Icon name="zap" size={12} color="primary" /> : null}
            <Text variant="footnote" color={e.spontaneous ? 'primary' : 'textSecondary'} numberOfLines={1}>
              {e.spontaneous ? `Spontant · ${host} inviterer deg` : `${host} inviterer deg`}
            </Text>
          </View>
          <Text variant="headline" numberOfLines={1}>
            {e.title}
          </Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {when}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color="textTertiary" />
      </PressableScale>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title={interest ? 'Ikke nå' : 'Kan ikke'} variant="secondary" size="sm" style={{ flex: 1 }} disabled={rsvp.isPending} onPress={decline} />
        <Button title={yes} icon={poll ? 'calendar' : full ? 'clock' : 'check'} size="sm" style={{ flex: 1.4 }} loading={rsvp.isPending} onPress={accept} />
      </View>
    </View>
  );
}
