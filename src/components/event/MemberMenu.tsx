import { router } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmDestructive, PersonSheet } from '@/components/people/PersonSheet';
import { Avatar, Chip, Divider, ListRow, Text, Toggle, useToast } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useRemoveEventMember, useSetMemberAnswer, useSetMemberPaysShare } from '@/data/hooks';
import type { EventMember, PlannerEvent } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { profilePath } from '@/lib/username';
import { motion, radius, shadows, spacing, useColors } from '@/theme';

type Answer = 'attending' | 'declined' | 'invited';
type Anchor = { x: number; y: number };

const ANSWERS: { id: Answer; label: string }[] = [
  { id: 'attending', label: 'Kommer' },
  { id: 'declined', label: 'Kan ikke' },
  { id: 'invited', label: 'Ikke svart' },
];

const answerOf = (m: EventMember): Answer | 'waitlisted' =>
  m.status === 'attending' || m.status === 'declined' || m.status === 'waitlisted' ? m.status : 'invited';

function statusLine(m: EventMember) {
  const answer =
    m.status === 'attending' ? 'Kommer' : m.status === 'declined' ? 'Kan ikke' : m.status === 'waitlisted' ? 'På ventelisten' : m.status === 'opened' ? 'Har sett, ikke svart' : 'Har ikke svart';
  return [answer, m.answerSetBy ? `satt av ${m.answerSetBy}` : null, m.isCohost ? 'medarrangør' : null].filter(Boolean).join(' · ');
}

const WIDTH = 320;

/**
 * Hold inne på noen i gjestelisten: a small menu right where the finger is, for what an organizer
 * does with one person on this event — set their answer, make them co-organizer, take them off.
 */
export function MemberMenu({ event: e, member, anchor, isOwner, onClose }: { event: PlannerEvent; member: EventMember | null; anchor: Anchor | null; isOwner: boolean; onClose: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const remove = useRemoveEventMember();
  const setAnswer = useSetMemberAnswer();
  const setPays = useSetMemberPaysShare();
  const [height, setHeight] = useState(0);
  const shown = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scale: 0.92 + 0.08 * shown.get() }] }));

  if (!member || !anchor) return null;
  const m = member;
  const name = firstName(m.person.name);
  const current = answerOf(m);
  const canSetAnswer = e.status === 'confirmed' || e.status === 'date_selected';
  const canCohost = isOwner && !!m.userId;
  const width = Math.min(WIDTH, W - 2 * spacing.lg);
  const left = Math.min(Math.max(anchor.x - width / 2, spacing.lg), W - width - spacing.lg);
  const below = anchor.y + spacing.md;
  const fitsBelow = below + height <= H - insets.bottom - spacing.md;
  // Below the finger when it fits, else above — and never past an edge of the screen.
  const top = Math.max(insets.top + spacing.md, Math.min(fitsBelow ? below : anchor.y - spacing.md - height, H - insets.bottom - spacing.md - height));

  const close = () => {
    shown.set(0);
    setHeight(0);
    onClose();
  };

  const pick = async (status: Answer) => {
    if (current === status || (status === 'attending' && current === 'waitlisted')) return close();
    close();
    try {
      const result = await setAnswer.mutateAsync({ memberId: m.id, status });
      toast(
        result === 'waitlisted'
          ? `Det er fullt – ${name} står på ventelisten`
          : status === 'invited'
            ? `${name} står som ikke svart`
            : `${name} er satt til «${status === 'attending' ? 'Kommer' : 'Kan ikke'}»${m.userId ? ' og får beskjed' : ''}`,
      );
    } catch {
      toast({ message: 'Kunne ikke endre svaret', tone: 'error' });
    }
  };

  // Same lists as «Medarrangører og plasser»: for this event, or every round when it repeats.
  const toggleCohost = async () => {
    close();
    const uid = m.userId!;
    const seriesId = e.series?.id;
    try {
      const people = seriesId ? await repo.getSeriesPeople(seriesId) : { ...(await repo.getEventPeople(e.id)), maxParticipants: e.maxParticipants ?? null };
      const on = people.cohostIds.includes(uid);
      const next = {
        ...people,
        cohostIds: on ? people.cohostIds.filter((id) => id !== uid) : [...people.cohostIds, uid],
        reservedIds: on ? people.reservedIds : people.reservedIds.filter((id) => id !== uid),
      };
      if (seriesId) await repo.setSeriesPeople(seriesId, next);
      else await repo.setEventPeople(e.id, { cohostIds: next.cohostIds, reservedIds: next.reservedIds });
      await queryClient.invalidateQueries();
      toast({ message: on ? `${name} er ikke medarrangør lenger` : `${name} er medarrangør${seriesId ? ' – også de neste gangene' : ''}`, tone: 'success' });
    } catch {
      toast({ message: 'Kunne ikke lagre', tone: 'error' });
    }
  };

  const removeFromInvite = () =>
    confirmDestructive(`Fjerne ${name} fra invitasjonen?`, 'Invitasjonen slutter å virke for dem. De får ikke beskjed, og du kan invitere dem igjen senere.', 'Fjern', async () => {
      close();
      try {
        await remove.mutateAsync(m.id);
        toast(`${name} er fjernet`);
      } catch {
        toast({ message: 'Kunne ikke fjerne', tone: 'error' });
      }
    });

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} onPress={close} accessibilityRole="button" accessibilityLabel="Lukk menyen" />
      <Animated.View
        accessibilityViewIsModal
        onLayout={(ev) => {
          const h = ev.nativeEvent.layout.height;
          if (h !== height) setHeight(h);
          shown.set(withSpring(1, motion.spring));
        }}
        style={[
          {
            position: 'absolute',
            top,
            left,
            width,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingVertical: spacing.sm,
            transformOrigin: fitsBelow ? 'top' : 'bottom',
          },
          shadows.md,
          style,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Avatar name={m.person.name} uri={m.person.avatarUrl} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headline" numberOfLines={1} accessibilityRole="header">
              {m.person.name}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {statusLine(m)}
            </Text>
          </View>
        </View>

        {canSetAnswer ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm }}>
            <Text variant="caption" color="textTertiary">
              Overstyr svaret – f.eks. når {name} har svart på SMS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {ANSWERS.map((a) => (
                <Chip
                  key={a.id}
                  label={a.label}
                  selected={current === a.id || (a.id === 'attending' && current === 'waitlisted')}
                  onPress={() => pick(a.id)}
                  style={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.md }}
                  accessibilityHint={`Setter svaret for ${name}${m.userId ? '. De får beskjed og kan endre det selv' : ''}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Divider />
        <View style={{ paddingHorizontal: spacing.sm }}>
          {canCohost ? (
            <ListRow
              icon="star"
              title={m.isCohost ? 'Fjern som medarrangør' : 'Gjør til medarrangør'}
              subtitle={m.isCohost ? undefined : 'Kan redigere og invitere, som deg'}
              onPress={toggleCohost}
            />
          ) : null}
          {e.price ? (
            <ListRow
              icon="tag"
              title="Betaler andel"
              trailing={
                <Toggle
                  value={m.paysShare !== false}
                  onValueChange={async (v) => {
                    try {
                      await setPays.mutateAsync({ memberId: m.id, paysShare: v });
                    } catch {
                      toast({ message: 'Kunne ikke lagre', tone: 'error' });
                    }
                  }}
                  accessibilityLabel={`${name} betaler andel`}
                />
              }
            />
          ) : null}
          <ListRow icon="user-minus" title="Fjern fra invitasjon" destructive onPress={removeFromInvite} />
        </View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Tapping someone on an event: their profile. Holding (organizers): the menu above, by the finger.
 * People without a profile page get the menu (organizers) or the quick person sheet on a tap.
 */
export function useMemberActions(event: PlannerEvent, { meId, isOwner, canManage }: { meId?: string | null; isOwner: boolean; canManage: boolean }) {
  const [menu, setMenu] = useState<{ member: EventMember; anchor: Anchor } | null>(null);
  const [sheet, setSheet] = useState<EventMember | null>(null);

  const manageable = (m: EventMember) => canManage && m.role === 'guest' && m.userId !== meId;
  const openMenu = (m: EventMember, ev?: GestureResponderEvent) => {
    haptics.medium();
    // No finger (VoiceOver's «Flere valg»): the middle of the screen.
    const { width, height } = Dimensions.get('window');
    setMenu({ member: m, anchor: { x: ev?.nativeEvent?.pageX ?? width / 2, y: ev?.nativeEvent?.pageY ?? height / 3 } });
  };

  const onPress = (m: EventMember, ev?: GestureResponderEvent) => {
    if (m.userId && m.userId === meId) return;
    if (m.userId && m.person.username) return router.push(profilePath(m.person.username) as never);
    if (manageable(m)) return openMenu(m, ev);
    setSheet(m);
  };
  const onLongPress = canManage ? (m: EventMember, ev?: GestureResponderEvent) => (manageable(m) ? openMenu(m, ev) : undefined) : undefined;

  // The live member, so the menu shows an answer changed a moment ago.
  const live = menu ? (event.members.find((x) => x.id === menu.member.id) ?? null) : null;
  const element = (
    <>
      <MemberMenu event={event} member={live} anchor={menu?.anchor ?? null} isOwner={isOwner} onClose={() => setMenu(null)} />
      <PersonSheet person={sheet?.person ?? null} onClose={() => setSheet(null)} />
    </>
  );
  return { onPress, onLongPress, canHold: (m: EventMember) => manageable(m), element };
}
