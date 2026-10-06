import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Icon, PressableScale, Tag, Text } from '@/components/ui';
import { formatMedium } from '@/lib/dates';
import type { DateScore } from '@/lib/ranking';
import { radius, spacing, useColors } from '@/theme';

type Props = {
  score: DateScore;
  index: number;
  selected: boolean;
  onPress: () => void;
  /** Names of people who can't, for the expanded line. */
  unavailableNames: string[];
};

/** One candidate date in the results list. Best date is green + labelled + check icon. */
export function DateResultRow({ score, index, selected, onPress, unavailableNames }: Props) {
  const colors = useColors();
  const best = score.isBest;
  const ratio = score.responded ? score.available / score.responded : 0;
  const label = `${formatMedium(score.option.date)}. ${score.available} av ${score.responded} kan.${best ? ' Beste dato.' : ''}${
    unavailableNames.length ? ` Kan ikke: ${unavailableNames.join(', ')}.` : ''
  }`;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(18)} layout={LinearTransition.springify().damping(20)}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.985}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        accessibilityHint="Velg denne datoen"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          paddingRight: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? (best ? colors.success : colors.ink) : colors.border,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: best ? colors.successSoft : colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={best ? 'check' : score.unavailable === 0 ? 'circle' : 'calendar'} size={18} tint={best ? colors.success : colors.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="headline">{formatMedium(score.option.date)}</Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {score.available} av {score.responded} kan
            {unavailableNames.length ? ` · ${unavailableNames.join(', ')} kan ikke` : ''}
          </Text>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, marginTop: 4, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(ratio * 100)}%`, height: 4, borderRadius: 2, backgroundColor: best ? colors.success : colors.borderStrong }} />
          </View>
        </View>
        {best ? <Tag label="Beste dato" tone="success" /> : null}
        {selected ? <Icon name="check-circle" size={20} tint={best ? colors.success : colors.ink} /> : null}
      </PressableScale>
    </Animated.View>
  );
}
