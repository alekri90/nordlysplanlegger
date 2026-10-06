import { forwardRef } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type PressableScaleProps = RNPressableProps & {
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
  haptic?: 'tap' | 'light' | 'medium' | false;
};

/** Pressable with a subtle spring scale and optional haptic — the default touch feel of the app. */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = 0.97, haptic = 'tap', onPressIn, onPressOut, onPress, style, disabled, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[animatedStyle, style as object]}
      {...rest}
    />
  );
});
