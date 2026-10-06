import { View } from 'react-native';

import { Avatar, PressableScale, Text } from '@/components/ui';
import type { EventMember } from '@/data/types';
import { shortNames } from '@/lib/names';
import { spacing } from '@/theme';

type Props = { members: EventMember[]; onPressMember?: (m: EventMember) => void };

function Group({ title, members, names, dim, onPress }: { title: string; members: EventMember[]; names: Map<string, string>; dim?: boolean; onPress?: (m: EventMember) => void }) {
  if (!members.length) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="headline" style={{ marginBottom: spacing.md }}>
        {title} ({members.length})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {members.map((m) => (
          <PressableScale
            key={m.id}
            onPress={onPress ? () => onPress(m) : undefined}
            disabled={!onPress}
            accessibilityLabel={`${m.person.name}${m.role === 'organizer' ? ', arrangør' : ''}${m.userId ? '' : ', uten konto'}`}
            style={{ alignItems: 'center', width: 58, gap: 4, opacity: dim ? 0.5 : 1 }}
          >
            <Avatar name={m.person.name} uri={m.person.avatarUrl} size={48} />
            <Text variant="caption" numberOfLines={1}>
              {names.get(m.id)}
              {m.role === 'organizer' ? ' ★' : ''}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/** Kommer · Kan ikke · Har ikke svart — status is in the heading text, never only colour. Tap someone for actions. */
export function GuestList({ members, onPressMember }: Props) {
  const coming = members.filter((m) => m.status === 'attending' || (m.role === 'organizer' && m.status !== 'declined'));
  const notComing = members.filter((m) => m.status === 'declined');
  const waiting = members.filter((m) => !coming.includes(m) && !notComing.includes(m));
  const names = shortNames(members.map((m) => ({ id: m.id, name: m.person.name })));
  return (
    <View>
      <Group title="Kommer" members={coming} names={names} onPress={onPressMember} />
      <Group title="Kan ikke" members={notComing} names={names} dim onPress={onPressMember} />
      <Group title="Har ikke svart" members={waiting} names={names} dim onPress={onPressMember} />
    </View>
  );
}
