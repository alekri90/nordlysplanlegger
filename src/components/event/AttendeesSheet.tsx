import { View } from 'react-native';

import { Avatar, Divider, Icon, Sheet, Tag, Text } from '@/components/ui';
import { spacing } from '@/theme';

export type Attendee = { id: string; name: string; avatarUrl?: string | null; tag?: string };

/** Who is coming, with whole names — from the places on the event and on the invitation. */
export function AttendeesSheet({
  visible,
  onClose,
  coming,
  waitlist = [],
  role,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  coming: Attendee[];
  waitlist?: Attendee[];
  /** The sauna master: on top of the places. */
  role?: { label: string; name: string } | null;
  subtitle?: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={coming.length ? `${coming.length} kommer` : 'Ingen har sagt ja ennå'} subtitle={subtitle} scroll>
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
          <Row key={p.id} person={p} divider={i > 0} />
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
            <Row key={p.id} person={{ ...p, tag: `Nr. ${i + 1}` }} divider={i > 0} />
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

function Row({ person, divider }: { person: Attendee; divider: boolean }) {
  return (
    <View>
      {divider ? <Divider /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
        <Avatar name={person.name} uri={person.avatarUrl} size={40} />
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
          {person.name}
        </Text>
        {person.tag ? <Tag label={person.tag} /> : null}
      </View>
    </View>
  );
}
