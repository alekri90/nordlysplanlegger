import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, spacing, useColors } from '@/theme';
import { IconButton } from './IconButton';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** Full-screen page with themed background and top safe area. */
export function Screen({ children, style, edges = ['top'] }: { children: ReactNode; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[] }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Scrollable page body with the standard gutter. Leaves room for a BottomBar. */
export function ScreenScroll({ children, contentContainerStyle, bottomInset = 120, ...rest }: ScrollViewProps & { bottomInset?: number }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: gutter, paddingBottom: bottomInset }, contentContainerStyle]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

type HeaderProps = {
  title?: string;
  /** `close` for modal flows. */
  back?: 'back' | 'close' | false;
  onBack?: () => void;
  right?: ReactNode;
  center?: ReactNode;
};

/** Minimal top bar: back/close on the left, optional actions on the right. */
export function Header({ title, back = 'back', onBack, right, center }: HeaderProps) {
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter - 10 }}>
      <View style={{ width: 88, alignItems: 'flex-start' }}>
        {back ? (
          <IconButton
            icon={back === 'close' ? 'x' : 'chevron-left'}
            onPress={handleBack}
            accessibilityLabel={back === 'close' ? 'Lukk' : 'Tilbake'}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {center ??
          (title ? (
            <Text variant="headline" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null)}
      </View>
      <View style={{ width: 88, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Large screen title + optional subtitle, as in the design reference. */
export function PageTitle({ title, subtitle, style }: { title: string; subtitle?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={[{ marginTop: spacing.sm, marginBottom: spacing.xl }, style]}>
      <Text variant="title1" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * Sticky bottom action area. Primary actions live here — within thumb reach,
 * above the home indicator / gesture bar on both platforms.
 */
export function BottomBar({ children, style, transparent }: { children: ReactNode; style?: StyleProp<ViewStyle>; transparent?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: gutter,
          paddingTop: spacing.xxl,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xs,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {!transparent ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${colors.background}00`, colors.background, colors.background]}
          locations={[0, 0.35, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </View>
  );
}

/** Wraps forms so the bottom bar rides above the keyboard on iOS. */
export function KeyboardAware({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}

/** "Neste ·········· Se alle" */
export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, style]}>
      <Text variant="title3" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={onAction} hitSlop={10} accessibilityLabel={`${action}: ${title}`}>
          <Text variant="footnote" color="textSecondary">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Step indicator for the create flow. */
export function ProgressDots({ count, index }: { count: number; index: number }) {
  const colors = useColors();
  return (
    <View
      style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Steg ${index + 1} av ${count}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 22 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i <= index ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}
