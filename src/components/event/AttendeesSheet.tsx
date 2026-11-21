import { View, type GestureResponderEvent } from 'react-native';

import { Avatar, Divider, Icon, PressableScale, Sheet, Tag, Text } from '@/components/ui';
import { spacing } from '@/theme';

export type Attendee = { id: string; name: string; avatarUrl?: string | null; tag?: string };
type PersonPress = (id: string, e: GestureResponderEvent) => void;
type Actions = { onPress?: PersonPress; onLongPress?: PersonPress; canHold?: (id: string) => boolean };

/** Who is coming, with whole names — from the places on the event and on the invitation. */
export function AttendeesSheet({
  visible,
  onClose,
  coming,
  waitlist = [],
  role,
  subtitle,
  onPressPerson,
  onLongPressPerson,
  canHold,
  onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  coming: Attendee[];
  waitlist?: Attendee[];
  /** The sauna master: on top of the places. */
  role?: { label: string; name: string } | null;
  subtitle?: string;
  /** Tap: their profile. Hold (organizers): the menu. The page closes the sheet first. */
  onPressPerson?: PersonPress;
  onLongPressPerson?: PersonPress;
  canHold?: (id: string) => boolean;
  onClosed?: () => void;
}) {
  const actions: Actions = { onPress: onPressPerson, onLongPress: onLongPressPerson, canHold };
  return (
    <Sheet visible={visible} onClose={onClose} title={coming.length ? `${coming.length} kommer` : 'Ingen har sagt ja ennå'} subtitle={subtitle} scroll onClosed={onClosed}>
      <View>
        {role ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="award" size={20} color="success" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{role.name}</Text>
                <Text variant="footnote" color="textSecondary">
                  {role.label}
                </Text>
              </View>
            </View>
            {coming.length ? <Divider /> : null}
          </>
        ) : null}
        {coming.map((p, i) => (
          <Row key={p.id} person={p} divider={i > 0} {...actions} />
        ))}
        {!coming.length && !role ? (
          <Text variant="callout" color="textSecondary">
            Navnene kommer her når noen svarer.
          </Text>
        ) : null}
      </View>
      {waitlist.length ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text variant="overline" color="textTertiary" style={{ marginBottom: spacing.xs }}>
            Venteliste
          </Text>
          {waitlist.map((p, i) => (
            <Row key={p.id} person={{ ...p, tag: `Nr. ${i + 1}` }} divider={i > 0} {...actions} />
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

function Row({ person, divider, onPress, onLongPress, canHold }: { person: Attendee; divider: boolean } & Actions) {
  const holds = !!onLongPress && !!canHold?.(person.id);
  return (
    <View>
      {divider ? <Divider /> : null}
      <PressableScale
        onPress={onPress ? (e) => onPress(person.id, e) : undefined}
        onLongPress={holds ? (e) => onLongPress!(person.id, e) : undefined}
        delayLongPress={350}
        disabled={!onPress}
        accessibilityLabel={[person.name, person.tag].filter(Boolean).join(', ')}
        accessibilityHint={holds ? 'Hold inne for å overstyre svaret, gjøre til medarrangør eller fjerne.' : undefined}
        accessibilityActions={holds ? [{ name: 'longpress', label: 'Flere valg' }] : undefined}
        onAccessibilityAction={(ev) => {
          if (ev.nativeEvent.actionName === 'longpress' && holds) onLongPress!(person.id, ev as unknown as GestureResponderEvent);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
      >
        <Avatar name={person.name} uri={person.avatarUrl} size={40} />
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
          {person.name}
        </Text>
        {person.tag ? <Tag label={person.tag} /> : null}
      </PressableScale>
    </View>
  );
}
