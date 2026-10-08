import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui';
import { gutter, spacing } from '@/theme';

type Props = {
  imageUrl: string;
  height: number;
  /** Content laid over the bottom of the photo (title etc). */
  children?: ReactNode;
  right?: ReactNode;
  showBack?: boolean;
  /** Stronger gradient for text over the image. */
  dim?: boolean;
};

/** Full-bleed cover photo with glass controls and a readable gradient. */
export function EventHero({ imageUrl, height, children, right, showBack = true, dim }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height, backgroundColor: '#201A17' }}>
      {/* Light clock and battery over the photo. */}
      <StatusBar style="light" />
      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={dim ? ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.05)', 'rgba(15,10,8,0.55)', 'rgba(15,10,8,0.92)'] : ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
        locations={dim ? [0, 0.3, 0.65, 1] : [0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: insets.top + spacing.xs, left: gutter - 8, right: gutter - 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        {showBack ? (
          <IconButton icon="chevron-left" variant="glass" accessibilityLabel="Tilbake" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>{right}</View>
      </View>
      {children ? <View style={{ position: 'absolute', left: gutter, right: gutter, bottom: spacing.xl }}>{children}</View> : null}
    </View>
  );
}
