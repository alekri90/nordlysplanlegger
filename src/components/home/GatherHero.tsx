import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { GATHER_PHOTO } from '@/lib/tempting';
import { radius, shadows, spacing } from '@/theme';

/** The card's own dark, so the photo can fade into it. */
const INK = '#18130F';

/**
 * The top of the home screen while nothing has a date: friends laughing at a candlelit table, and one
 * thing to do. A new (or quiet) calendar invites you to start something instead of looking empty.
 */
export function GatherHero({ onStart }: { onStart: () => void }) {
  return (
    <View style={[{ aspectRatio: 1.26, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: INK, justifyContent: 'flex-end' }, shadows.md]}>
      <Image source={{ uri: GATHER_PHOTO }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '68%' }} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(24,19,15,0)', 'rgba(24,19,15,0.6)', INK]} locations={[0.36, 0.54, 0.7]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: spacing.lg }}>
        <Text variant="title2" style={{ color: '#fff' }} accessibilityRole="header">
          Hvem vil du samle?
        </Text>
        <Text variant="subhead" style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          Inviter nå, finn en dag sammen.
        </Text>
        <Button
          title="Inviter venner"
          icon="user-plus"
          size="sm"
          fullWidth={false}
          onPress={onStart}
          accessibilityHint="Lag en plan og finn en dato som passer alle"
          style={{ marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.xl }}
        />
      </View>
    </View>
  );
}
