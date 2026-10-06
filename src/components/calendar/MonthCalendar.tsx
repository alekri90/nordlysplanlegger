import { memo, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { formatLong, monthDates, monthTitle, today, weekday, WEEKDAYS_SHORT } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { fonts, motion, radius, spacing, useColors } from '@/theme';

/**
 * - `disabled`     not part of the period / in the past
 * - `idle`         can be chosen
 * - `candidate`    a proposed date (organizer picked it / guest can make it)
 * - `unavailable`  guest marked "kan ikke"
 * - `selected`     the chosen single date (fixed date)
 * - `best`         best date in results
 */
export type DayState = 'disabled' | 'idle' | 'candidate' | 'unavailable' | 'selected' | 'best';

const STATE_LABEL: Record<DayState, string> = {
  disabled: 'ikke tilgjengelig',
  idle: 'ikke valgt',
  candidate: 'mulig dag',
  unavailable: 'kan ikke',
  selected: 'valgt',
  best: 'beste dato',
};

type Props = {
  month: string; // YYYY-MM
  getState: (date: string) => DayState;
  onPressDay?: (date: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Accessibility hint for tappable days, e.g. "Trykk for å markere at du ikke kan". */
  dayHint?: string;
};

const Day = memo(function Day({ date, state, onPress, hint }: { date: string; state: DayState; onPress?: (d: string) => void; hint?: string }) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const isToday = date === today();

  useEffect(() => {
    if (state === 'disabled' || state === 'idle') return;
    scale.value = withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, motion.spring));
  }, [state, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const look = {
    disabled: { bg: 'transparent', fg: colors.textTertiary, border: 'transparent' },
    idle: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    candidate: { bg: colors.primarySoft, fg: colors.primaryOnSoft, border: 'transparent' },
    unavailable: { bg: colors.primary, fg: '#FFFFFF', border: 'transparent' },
    selected: { bg: colors.ink, fg: colors.textOnInk, border: 'transparent' },
    best: { bg: colors.success, fg: '#FFFFFF', border: 'transparent' },
  }[state];

  const interactive = !!onPress && state !== 'disabled';
  const day = Number(date.slice(8, 10));

  return (
    <Pressable
      disabled={!interactive}
      onPress={() => {
        haptics.tap();
        onPress?.(date);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${formatLong(date)}, ${STATE_LABEL[state]}`}
      accessibilityHint={interactive ? hint : undefined}
      accessibilityState={{ disabled: !interactive, selected: state === 'unavailable' || state === 'selected' || state === 'candidate' }}
      style={{ flex: 1, aspectRatio: 1, padding: 3, maxHeight: 54 }}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: radius.sm,
            backgroundColor: look.bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: isToday && state === 'idle' ? 1.5 : 0,
            borderColor: colors.borderStrong,
          },
          animated,
        ]}
      >
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            fontFamily: state === 'idle' || state === 'disabled' ? fonts.medium : fonts.bold,
            fontSize: 15,
            color: look.fg,
            textDecorationLine: state === 'unavailable' ? 'line-through' : 'none',
            opacity: state === 'disabled' ? 0.45 : 1,
          }}
        >
          {day}
        </Text>
        {state === 'unavailable' ? (
          <View style={{ position: 'absolute', top: 3, right: 4 }}>
            <Icon name="x" size={10} tint="#FFFFFF" />
          </View>
        ) : state === 'best' ? (
          <View style={{ position: 'absolute', top: 3, right: 4 }}>
            <Icon name="check" size={10} tint="#FFFFFF" />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

/** Monday-first month grid. Simple on purpose: tap a day, see its state change. */
export function MonthCalendar({ month, getState, onPressDay, onPrev, onNext, dayHint }: Props) {
  const dates = monthDates(month);
  const leading = weekday(dates[0]);
  const cells: (string | null)[] = [...Array(leading).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, minHeight: 44 }}>
        <View style={{ width: 44 }}>{onPrev ? <IconButton icon="chevron-left" onPress={onPrev} accessibilityLabel="Forrige måned" /> : null}</View>
        <Text variant="headline" accessibilityRole="header">
          {monthTitle(month)}
        </Text>
        <View style={{ width: 44 }}>{onNext ? <IconButton icon="chevron-right" onPress={onNext} accessibilityLabel="Neste måned" /> : null}</View>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} variant="caption" color="textTertiary" align="center" style={{ flex: 1 }}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((date, di) =>
            date ? (
              <Day key={date} date={date} state={getState(date)} onPress={onPressDay} hint={dayHint} />
            ) : (
              <View key={`e${di}`} style={{ flex: 1, aspectRatio: 1, maxHeight: 54 }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/** Small legend row so status is never communicated by colour alone. */
export function CalendarLegend({ items }: { items: { state: DayState; label: string }[] }) {
  const colors = useColors();
  const swatch: Partial<Record<DayState, string>> = {
    candidate: colors.primarySoft,
    unavailable: colors.primary,
    selected: colors.ink,
    best: colors.success,
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center', marginTop: spacing.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: swatch[i.state] ?? colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            {i.state === 'unavailable' ? <Icon name="x" size={9} tint="#fff" /> : null}
          </View>
          <Text variant="caption" color="textSecondary">
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
