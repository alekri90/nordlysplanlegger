import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useBusyItems } from '@/lib/calendarBusy';
import { conflictsFor, conflictSummary, conflictTime, type BusyItem, type ConflictWhen } from '@/lib/calendarConflicts';
import { formatDayMonth } from '@/lib/dates';
import { radius, spacing, useColors } from '@/theme';

type Props = {
  when: ConflictWhen | null;
  /** For a list of days: says which one it's about. */
  showDay?: boolean;
  /** On the invitation, which is dark in both themes. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Reads the calendar for one day. Screens showing a month already have the items: use ConflictNote. */
export function CalendarConflict({ when, ...rest }: Props) {
  const busy = useBusyItems(when?.date);
  return <ConflictNote busy={busy} when={when} {...rest} />;
}

/** A quiet hint, never a stop: one line, open it to see what's there. Nothing shows if you're free. */
export function ConflictNote({ busy, when, showDay, onDark, style }: Props & { busy: BusyItem[] }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const conflicts = when ? conflictsFor(busy, when) : [];
  if (!when || !conflicts.length) return null;

  const main = onDark ? '#fff' : colors.text;
  const soft = onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const summary = conflictSummary(conflicts, when);
  const line = showDay ? `${formatDayMonth(when.date)}: ${summary[0].toLowerCase()}${summary.slice(1)}` : summary;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[{ borderRadius: radius.md, backgroundColor: onDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }, style]}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={line}
        accessibilityHint={open ? 'Skjuler det som ligger i kalenderen' : 'Viser det som ligger i kalenderen'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44 }}
      >
        <Icon name="calendar" size={16} tint={soft} />
        <Text variant="footnote" style={{ flex: 1, color: main }}>
          {line}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} tint={soft} />
      </PressableScale>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
          {conflicts.map((c) => (
            <View key={`${c.title}${c.start.getTime()}${c.calendar}`}>
              <Text variant="callout" numberOfLines={1} style={{ color: main }}>
                {c.title}
              </Text>
              <Text variant="footnote" style={{ color: soft }}>
                {[conflictTime(c, when.date), c.calendar].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
          <Text variant="caption" style={{ color: soft }}>
            Bare du ser dette.
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
