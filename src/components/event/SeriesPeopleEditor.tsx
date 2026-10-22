import { View } from 'react-native';

import { PersonRow } from '@/components/people/PersonRow';
import { Card, Divider, Text } from '@/components/ui';
import type { EventMember, SeriesPeople } from '@/data/types';
import { spacing } from '@/theme';
import { PlacesSetting } from './PlacesSetting';

/**
 * For the organizer of a recurring event: medarrangører (can do what you do, always a place),
 * faste gjester (always a place — nobody else can see it) and the limit, for every round.
 * Only people with an account can have a role.
 */
export function SeriesPeopleEditor({ members, value, onChange }: { members: EventMember[]; value: SeriesPeople; onChange: (v: SeriesPeople) => void }) {
  const people = members.filter((m) => m.role === 'guest' && m.userId);
  const toggle = (key: 'cohostIds' | 'reservedIds', id: string) => {
    const other = key === 'cohostIds' ? 'reservedIds' : 'cohostIds';
    const on = value[key].includes(id);
    // One role each: a co-host already has a place.
    onChange({ ...value, [key]: on ? value[key].filter((x) => x !== id) : [...value[key], id], [other]: value[other].filter((x) => x !== id) });
  };
  return (
    <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
      <Card style={{ paddingVertical: spacing.xs }}>
        <PlacesSetting value={value.maxParticipants} onChange={(maxParticipants) => onChange({ ...value, maxParticipants })} />
      </Card>
      {people.length ? (
        <>
          <Section title="Medarrangører" body="Kan endre, låse dato og sende beskjeder – og har alltid plass.">
            {people.map((m, i) => (
              <View key={m.id}>
                {i ? <Divider /> : null}
                <PersonRow person={m.person} size={36} selected={value.cohostIds.includes(m.userId!)} onPress={() => toggle('cohostIds', m.userId!)} />
              </View>
            ))}
          </Section>
          <Section title="Faste gjester" body="Har alltid plass, hver gang. Det er bare du som ser hvem det er.">
            {people.map((m, i) => (
              <View key={m.id}>
                {i ? <Divider /> : null}
                <PersonRow person={m.person} size={36} selected={value.reservedIds.includes(m.userId!)} onPress={() => toggle('reservedIds', m.userId!)} />
              </View>
            ))}
          </Section>
        </>
      ) : null}
    </View>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="title3">{title}</Text>
      <Text variant="footnote" color="textSecondary" style={{ marginTop: 2, marginBottom: spacing.sm }}>
        {body}
      </Text>
      <Card style={{ paddingVertical: spacing.xs }}>{children}</Card>
    </View>
  );
}
