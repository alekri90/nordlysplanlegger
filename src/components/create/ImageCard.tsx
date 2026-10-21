import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import { radius, spacing, useColors } from '@/theme';

/** A big picture with its name at the bottom — inspiration categories and activities. Two per row. */
export function ImageCard({ uri, label, tag, onPress, aspectRatio = 1.15 }: { uri: string; label: string; tag?: string; onPress: () => void; aspectRatio?: number }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={tag ? `${label}, ${tag}` : label} style={{ width: '48.4%', aspectRatio, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
      <Image source={{ uri: thumb(uri, 500) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} locations={[0.45, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      {tag ? (
        <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text variant="caption" style={{ color: '#fff' }}>
            {tag}
          </Text>
        </View>
      ) : null}
      <Text variant="headline" numberOfLines={2} style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, color: '#fff' }}>
        {label}
      </Text>
    </PressableScale>
  );
}
