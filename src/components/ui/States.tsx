import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { radius, spacing, useColors } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Pulsing placeholder block. */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: { width?: DimensionValue; height?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton }, animated, style]} />;
}

/** Skeleton for a list of event cards. */
export function EventListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Laster" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={128} rounded={radius.lg} />
      ))}
    </View>
  );
}

export function PageSkeleton() {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.lg }} accessibilityLabel="Laster" accessibilityRole="progressbar">
      <Skeleton height={240} rounded={radius.xl} />
      <Skeleton width="70%" height={28} />
      <Skeleton width="45%" height={18} />
      <Skeleton height={72} rounded={radius.lg} />
      <Skeleton height={72} rounded={radius.lg} />
    </View>
  );
}

type EmptyProps = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Friendly empty state with one clear next step. */
export function EmptyState({ icon = 'sun', title, body, action, onAction, style }: EmptyProps) {
  const colors = useColors();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }, style]}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
        <Icon name={icon} size={30} color="primary" />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" color="textSecondary" align="center" style={{ marginTop: spacing.sm, maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button title={action} onPress={onAction} size="md" fullWidth={false} style={{ marginTop: spacing.xl }} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Noe gikk galt', body = 'Sjekk nettet og prøv igjen.', onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  return <EmptyState icon="cloud-off" title={title} body={body} action={onRetry ? 'Prøv igjen' : undefined} onAction={onRetry} />;
}
