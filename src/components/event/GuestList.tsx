import type { ReactNode } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { Avatar, PressableScale, Text } from '@/components/ui';
import type { EventMember } from '@/data/types';
import { shortNames } from '@/lib/names';
import { spacing } from '@/theme';

type Props = {
  members: EventMember[];
  /** Tap: their profile. */
  onPressMember?: (m: EventMember, e: GestureResponderEvent) => void;
  /** Hold (organizers): a small menu by the finger. Only for those `canHold` says yes to. */
  onLongPressMember?: (m: EventMember, e: GestureResponderEvent) => void;
  canHold?: (m: EventMember) => boolean;
  /** No date yet: the answers are «Er med» / «Ikke denne gangen». */
  interest?: boolean;
  /** Beside «Har ikke svart», e.g. «Minn på». */
  pendingAction?: ReactNode;
  /** Organizer side: split those who haven't answered into seen / not seen. */
  showSeen?: boolean;
};

type Press = (m: EventMember, e: GestureResponderEvent) => void;

function Group({ title, members, names, dim, onPress, onLongPress, canHold, action }: { title: string; members: EventMember[]; names: Map<string, string>; dim?: boolean; onPress?: Press; onLongPress?: Press; canHold?: (m: EventMember) => boolean; action?: ReactNode }) {
  if (!members.length) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md }}>
        <Text variant="headline">
          {title} ({members.length})
        </Text>
        {action}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {members.map((m) => (
          <PressableScale
            key={m.id}
            onPress={onPress ? (e) => onPress(m, e) : undefined}
            onLongPress={onLongPress && canHold?.(m) ? (e) => onLongPress(m, e) : undefined}
            delayLongPress={350}
            disabled={!onPress}
            accessibilityHint={onLongPress && canHold?.(m) ? 'Åpner profilen. Hold inne for å overstyre svaret, gjøre til medarrangør eller fjerne.' : undefined}
            accessibilityActions={onLongPress && canHold?.(m) ? [{ name: 'longpress', label: 'Flere valg' }] : undefined}
            onAccessibilityAction={(ev) => {
              if (ev.nativeEvent.actionName === 'longpress' && onLongPress) onLongPress(m, ev as unknown as GestureResponderEvent);
            }}
            accessibilityLabel={`${m.person.name}${m.role === 'organizer' ? ', arrangør' : ''}${m.userId ? '' : ', uten konto'}${m.answerSetBy ? `, svaret er satt av ${m.answerSetBy}` : ''}${m.paysShare === false ? ', betaler ikke andel' : ''}`}
            style={{ alignItems: 'center', width: 58, gap: 4, opacity: dim ? 0.5 : 1 }}
          >
            <Avatar name={m.person.name} uri={m.person.avatarUrl} size={48} />
            <Text variant="caption" numberOfLines={1}>
              {names.get(m.id)}
              {m.role === 'organizer' ? ' ★' : ''}
            </Text>
            {m.answerSetBy ? (
              <Text variant="caption" color="textTertiary" numberOfLines={1} style={{ fontSize: 10, lineHeight: 12, marginTop: -2 }}>
                Satt av {m.answerSetBy}
              </Text>
            ) : null}
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/** Kommer · Kan ikke · Har ikke svart — status is in the heading text, never only colour. Tap someone for their profile, hold for actions. */
export function GuestList({ members, onPressMember, onLongPressMember, canHold, interest, pendingAction, showSeen }: Props) {
  const coming = members.filter((m) => m.status === 'attending' || (m.role === 'organizer' && m.status !== 'declined'));
  const notComing = members.filter((m) => m.status === 'declined');
  // In line for a place, first first.
  const waitlist = members.filter((m) => m.status === 'waitlisted').sort((a, b) => (a.waitlistedAt ?? '').localeCompare(b.waitlistedAt ?? ''));
  const waiting = members.filter((m) => !coming.includes(m) && !notComing.includes(m) && !waitlist.includes(m));
  const seen = showSeen ? waiting.filter((m) => m.status === 'opened') : [];
  const unseen = waiting.filter((m) => !seen.includes(m));
  const names = shortNames(members.map((m) => ({ id: m.id, name: m.person.name })));
  return (
    <View>
      <Group title={interest ? 'Er med' : 'Kommer'} members={coming} names={names} onPress={onPressMember} onLongPress={onLongPressMember} canHold={canHold} />
      <Group title="Venteliste" members={waitlist} names={names} onPress={onPressMember} onLongPress={onLongPressMember} canHold={canHold} />
      <Group title={interest ? 'Ikke denne gangen' : 'Kan ikke'} members={notComing} names={names} dim onPress={onPressMember} onLongPress={onLongPressMember} canHold={canHold} />
      <Group title="Har sett, ikke svart" members={seen} names={names} dim onPress={onPressMember} onLongPress={onLongPressMember} canHold={canHold} action={pendingAction} />
      <Group title={showSeen ? 'Har ikke sett ennå' : 'Har ikke svart'} members={unseen} names={names} dim onPress={onPressMember} onLongPress={onLongPressMember} canHold={canHold} action={seen.length ? undefined : pendingAction} />
    </View>
  );
}
