import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import { GATHER_PHOTO } from '@/lib/tempting';
import { radius, shadows, spacing } from '@/theme';

/**
 * The top of the home screen while nothing has a date: a warm picture and one thing to do. So a new
 * (or quiet) calendar invites you to start something instead of looking empty.
 */
export function GatherHero({ onStart }: { onStart: () => void }) {
  return (
    <View style={[{ minHeight: 320, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#201A17', justifyContent: 'flex-end' }, shadows.md]}>
      <Image source={{ uri: thumb(GATHER_PHOTO, 900) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(12,10,9,0)', 'rgba(12,10,9,0.35)', 'rgba(12,10,9,0.9)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: spacing.xl, paddingTop: 140 }}>
        <Text variant="display" style={{ color: '#fff' }} accessibilityRole="header">
          Hvem vil du samle?
        </Text>
        <Text variant="callout" style={{ color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }}>
          Inviter nå, finn en dag sammen.
        </Text>
        <Button
          title="Inviter venner"
          icon="user-plus"
          fullWidth={false}
          onPress={onStart}
          accessibilityHint="Lag en plan og finn en dato som passer alle"
          style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
        />
      </View>
    </View>
  );
}
