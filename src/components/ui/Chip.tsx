import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/** Selectable pill. Selection is shown with colour *and* a check icon. */
export function Chip({ label, selected, onPress, icon, style, accessibilityHint }: ChipProps) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      style={[
        {
          minHeight: 40,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: selected ? colors.ink : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.ink : colors.border,
        },
        style,
      ]}
    >
      {selected ? <Icon name="check" size={15} tint={colors.textOnInk} /> : icon ? <Icon name={icon} size={15} color="textSecondary" /> : null}
      <Text variant="footnote" style={{ color: selected ? colors.textOnInk : colors.text }}>
        {label}
      </Text>
    </PressableScale>
  );
}

type TagTone = 'neutral' | 'success' | 'primary' | 'dark' | 'glass';

/** Non-interactive status tag, e.g. "Beste dato". */
export function Tag({ label, tone = 'neutral', icon }: { label: string; tone?: TagTone; icon?: IconName }) {
  const colors = useColors();
  const tones: Record<TagTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
    success: { bg: colors.successSoft, fg: colors.success },
    primary: { bg: colors.primarySoft, fg: colors.primaryOnSoft },
    dark: { bg: colors.ink, fg: colors.textOnInk },
    glass: { bg: 'rgba(255,255,255,0.18)', fg: '#FFFFFF' },
  };
  const t = tones[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
      }}
    >
      {icon ? <Icon name={icon} size={12} tint={t.fg} /> : null}
      <Text variant="caption" style={{ color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}
