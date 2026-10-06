import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { radius, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

type Props = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  /** `glass` sits on top of photos. */
  variant?: 'plain' | 'surface' | 'glass';
  size?: number;
  badge?: number | boolean;
  style?: StyleProp<ViewStyle>;
};

/** Round icon button with a 44pt+ touch target. */
export function IconButton({ icon, onPress, accessibilityLabel, variant = 'plain', size = 44, badge, style }: Props) {
  const colors = useColors();
  const tint = variant === 'glass' ? '#FFFFFF' : colors.text;
  const content = (
    <>
      <Icon name={icon} size={variant === 'plain' ? 22 : 20} tint={tint} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            minWidth: typeof badge === 'number' ? 18 : 10,
            height: typeof badge === 'number' ? 18 : 10,
            borderRadius: 9,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: variant === 'glass' ? 'transparent' : colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          {typeof badge === 'number' ? (
            <Text variant="caption" style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>
              {badge > 9 ? '9+' : badge}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={typeof badge === 'number' && badge > 0 ? `${accessibilityLabel}, ${badge} nye` : accessibilityLabel}
      hitSlop={8}
      scaleTo={0.92}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: variant === 'glass' ? 'hidden' : 'visible',
          backgroundColor: variant === 'surface' ? colors.surface : variant === 'glass' ? 'rgba(0,0,0,0.25)' : 'transparent',
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {variant === 'glass' ? (
        <BlurView intensity={30} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      {content}
    </PressableScale>
  );
}
