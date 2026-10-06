import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, shadows, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'outline' | 'ghost' | 'light' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Custom leading element (e.g. a brand logo). */
  leading?: React.ReactNode;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = { lg: 56, md: 48, sm: 36 };

/**
 * The app's buttons. `primary` (coral gradient) is the social call to action,
 * `ink` moves you to the next step of a flow. Large by default for one-handed use.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  leading,
  iconRight,
  loading,
  disabled,
  fullWidth = size !== 'sm',
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const surfaces: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary },
    ink: { bg: colors.ink, fg: colors.textOnInk },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.text },
    light: { bg: '#FFFFFF', fg: '#16120F' },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const s = surfaces[variant];
  const textVariant = size === 'sm' ? 'footnote' : 'headline';
  const iconSize = size === 'sm' ? 16 : 19;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      haptic={variant === 'primary' || variant === 'ink' ? 'light' : 'tap'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      hitSlop={size === 'sm' ? 6 : 0}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          borderRadius: radius.pill,
          backgroundColor: s.bg,
          paddingHorizontal: size === 'sm' ? spacing.md + 2 : spacing.xl,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled && !loading ? 0.4 : 1,
        },
        s.border ? { borderWidth: 1.5, borderColor: s.border } : null,
        variant === 'primary' && !isDisabled ? shadows.primary : null,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={s.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          {icon ? <Icon name={icon} size={iconSize} tint={s.fg} /> : null}
          <Text variant={textVariant} style={{ color: s.fg }} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Icon name={iconRight} size={iconSize} tint={s.fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
