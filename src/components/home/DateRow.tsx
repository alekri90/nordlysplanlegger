import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import type { PlannerEvent } from '@/data/types';
import { formatTime, MONTHS_SHORT } from '@/lib/dates';
import { spacing, useColors } from '@/theme';

/** «10 DES · Aufguss med Lorna · kl. 18:00 · Sørenga»: what's coming after the next one. */
export function DateRow({ event: e, onPress, detail: override }: { event: PlannerEvent; onPress: () => void; /** Instead of «kl. 19:00 · place». */ detail?: string }) {
  const colors = useColors();
  const d = e.selectedDate ? new Date(`${e.selectedDate}T12:00:00`) : null;
  const coming = e.members.filter((m) => m.status === 'attending').length;
  const detail = override ?? ([e.startTime ? `kl. ${formatTime(e.startTime)}` : null, e.location?.name ?? null].filter(Boolean).join(' · ') || `${coming} kommer`);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${e.title}. ${detail}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ width: 44, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, paddingRight: spacing.sm }}>
        <Text variant="title2" style={{ lineHeight: 26 }}>
          {d ? d.getDate() : '–'}
        </Text>
        <Text variant="caption" color="textSecondary">
          {d ? MONTHS_SHORT[d.getMonth()].toUpperCase() : ''}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="headline" numberOfLines={1}>
          {e.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Icon name={override ? 'users' : e.startTime || e.location ? 'clock' : 'users'} size={13} color="textSecondary" />
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {detail}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </PressableScale>
  );
}
