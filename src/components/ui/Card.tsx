import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, shadows, spacing, useColors } from '@/theme';
import { PressableScale } from './Pressable';

type Props = ViewProps & {
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Rounded surface with a soft shadow. Becomes pressable when given `onPress`. */
export function Card({ onPress, padded = true, elevated = true, muted, style, children, accessibilityLabel, ...rest }: Props) {
  const colors = useColors();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: muted ? colors.surfaceMuted : colors.surface,
      borderRadius: radius.lg,
      padding: padded ? spacing.lg : 0,
      borderWidth: muted ? 0 : 1,
      borderColor: colors.border,
    },
    elevated && !muted ? shadows.sm : null,
    style,
  ];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={base} scaleTo={0.985} accessibilityLabel={accessibilityLabel} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={base} accessibilityLabel={accessibilityLabel} {...rest}>
      {children}
    </View>
  );
}
