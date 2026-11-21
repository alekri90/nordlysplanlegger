import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, motion, radius, spacing, useColors } from '@/theme';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Long content (lists of people): scrolls inside the sheet instead of growing past the screen. */
  scroll?: boolean;
  /** After the closing animation — open the next sheet here, never while this one is still up. */
  onClosed?: () => void;
};

/** Bottom sheet for short, focused choices (share, more actions, confirmations). */
export function Sheet({ visible, onClose, title, subtitle, children, scroll, onClosed }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // The latest callback, for when the closing animation ends.
  const closedRef = useRef(onClosed);
  useEffect(() => {
    closedRef.current = onClosed;
  });
  const close = () => {
    setMounted(false);
    closedRef.current?.();
  };

  // Mount immediately when opened; unmount only after the closing animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.value = withSpring(1, motion.springSoft);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: motion.fast, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(close);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * 500 }] }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            // Never taller than the screen, so the handle and the backdrop stay reachable.
            maxHeight: height - insets.top - spacing.lg,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: gutter,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm,
          },
          panel,
        ]}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.lg }} />
        {title ? (
          <Text variant="title3" accessibilityRole="header" style={{ marginBottom: subtitle ? spacing.xs : spacing.lg }}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.lg }}>
            {subtitle}
          </Text>
        ) : null}
        {scroll ? (
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Animated.View>
    </Modal>
  );
}
