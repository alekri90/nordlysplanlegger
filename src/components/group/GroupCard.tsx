import { Image } from 'expo-image';
import { View } from 'react-native';

import { AvatarStack, Button, Card, PressableScale, Text } from '@/components/ui';
import type { Group } from '@/data/types';
import { thumb } from '@/lib/categories';
import { formatDayMonth } from '@/lib/dates';
import { radius, spacing, useColors } from '@/theme';

export function groupNextLine(g: Group) {
  if (!g.nextEvent) return 'Ikke planlagt';
  if (g.nextEvent.date) return `${g.nextEvent.title} · ${formatDayMonth(g.nextEvent.date)}`;
  return g.nextEvent.status === 'polling' ? `${g.nextEvent.title} · finner dato` : g.nextEvent.title;
}

/**
 * A crew, picture first: who, when we last met, what's next — and the one-tap way to meet again.
 * The card body and the action are sibling touch targets (never a button inside a button).
 */
export function GroupCard({ group, onPress, onFindDate }: { group: Group; onPress: () => void; onFindDate: () => void }) {
  const colors = useColors();
  const last = group.lastEvent?.date ? formatDayMonth(group.lastEvent.date) : null;
  return (
    <Card>
      <PressableScale
        onPress={onPress}
        scaleTo={0.985}
        accessibilityLabel={`${group.name}, ${group.members.length} medlemmer. Neste: ${groupNextLine(group)}`}
        accessibilityHint="Åpner gjengen"
        style={{ gap: spacing.md }}
      >
        <Image source={{ uri: thumb(group.coverImageUrl, 900) }} style={{ width: '100%', aspectRatio: 2.4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" transition={200} />
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" numberOfLines={1}>
              {group.name}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {group.members.length} medlemmer{last ? ` · Sist ${last}` : ''}
            </Text>
            <Text variant="footnote" color={group.nextEvent ? 'text' : 'textTertiary'} numberOfLines={1}>
              Neste: {groupNextLine(group)}
            </Text>
          </View>
        </View>
        {group.nextEvent ? <AvatarStack people={group.members} size={28} max={5} /> : null}
      </PressableScale>
      {!group.nextEvent ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
          <AvatarStack people={group.members} size={28} max={5} />
          <Button title="Finn neste dato" size="sm" variant="ink" icon="calendar" onPress={onFindDate} />
        </View>
      ) : null}
    </Card>
  );
}
