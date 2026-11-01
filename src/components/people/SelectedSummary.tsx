import { useMemo } from 'react';
import { View } from 'react-native';

import { AvatarStack, Text } from '@/components/ui';
import { useFriends, useGroups, useRecentPeople } from '@/data/hooks';
import type { Person } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { radius, spacing, useColors } from '@/theme';

/** «Maja, Ole og 3 til» */
export function namesLine(names: string[]) {
  const shown = names.slice(0, 2).map(firstName);
  const rest = names.length - shown.length;
  if (!rest) return shown.join(' og ');
  return `${shown.join(', ')} og ${rest} til`;
}

/** Just above the send button: who you're about to invite, so there's no need for a review step. */
export function SelectedSummary({ ids, names = [] }: { ids: string[]; names?: string[] }) {
  const colors = useColors();
  const friends = useFriends();
  const recent = useRecentPeople();
  const groups = useGroups();
  const known = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of [...(friends.data ?? []), ...(recent.data ?? []), ...(groups.data ?? []).flatMap((g) => g.members)]) map.set(p.id, p);
    return map;
  }, [friends.data, recent.data, groups.data]);

  const people = ids.map((id) => known.get(id)).filter((p): p is Person => !!p);
  const count = ids.length + names.length;
  if (!count) return null;
  // Someone found by search isn't in the list above: they still count.
  const shown = [...people.map((p) => p.name), ...names];
  const line = shown.length === count ? namesLine(shown) : `${count} ${count === 1 ? 'person' : 'personer'}`;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
      accessibilityLabel={`Valgt: ${line}`}
    >
      {people.length ? <AvatarStack people={people} size={26} max={5} /> : null}
      <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
        {line}
      </Text>
    </View>
  );
}
