import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useEvents } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import type { BusyItem } from '@/lib/calendarConflicts';
import { formatDayMonth, formatTime } from '@/lib/dates';
import { timeHintLabel } from '@/lib/eventText';
import { useMe } from '@/state/session';
import { radius, spacing, useColors } from '@/theme';

/**
 * What I already have planned in the app, by day — the same as Kalender shows (not cancelled, not
 * ones I said no to). Empty when not signed in. `skip`: events that are part of what is being chosen.
 */
export function usePlannedDays(skip: (string | null | undefined)[] = []) {
  const me = useMe();
  const events = useEvents();
  const skipKey = skip.filter(Boolean).join(',');
  return useMemo(() => {
    const skipped = new Set(skipKey.split(','));
    const map = new Map<string, PlannerEvent[]>();
    for (const e of events.data ?? []) {
      if (!e.selectedDate || e.status === 'cancelled' || skipped.has(e.id)) continue;
      const mine = e.members.find((m) => m.userId === me?.id);
      if (mine?.role === 'guest' && mine.status === 'declined') continue;
      map.set(e.selectedDate, [...(map.get(e.selectedDate) ?? []), e]);
    }
    return map;
  }, [events.data, me?.id, skipKey]);
}

/** The phone's calendar without our own entries (they are shown as plans already). */
export function withoutOurs(busy: BusyItem[], planned: Map<string, PlannerEvent[]>) {
  const ours = new Set([...planned.values()].flat().map((e) => e.id));
  return busy.filter((i) => !i.eventId || !ours.has(i.eventId));
}

/** «Du har allerede: Padel kl. 18» for one day. Nothing when the day is free. */
export function PlansNote({ plans, date, showDay, style }: { plans: PlannerEvent[] | undefined; date: string | null; showDay?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  if (!date || !plans?.length) return null;
  const what = plans
    .map((e) => (e.startTime ? `${e.title} kl. ${formatTime(e.startTime)}` : e.timeHint === 'any' ? e.title : `${e.title} ${timeHintLabel(e.timeHint).toLowerCase()}`))
    .join(' · ');
  const line = `${showDay ? `${formatDayMonth(date)}: d` : 'D'}u har allerede ${what}`;
  return (
    <View
      accessible
      accessibilityLabel={line}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 40 }, style]}
    >
      <Icon name="star" size={16} color="primaryOnSoft" />
      <Text variant="footnote" style={{ flex: 1, color: colors.primaryOnSoft }} numberOfLines={2}>
        {line}
      </Text>
    </View>
  );
}
