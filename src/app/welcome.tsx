import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, PressableScale, Text } from '@/components/ui';
import { unsplash } from '@/lib/categories';
import { useCreateDraft } from '@/state/createDraft';
import { useSession } from '@/state/session';
import { gutter, spacing } from '@/theme';

/**
 * First screen. No onboarding carousel — just the promise and one big button.
 * "Planlegg noe" goes straight into creating; we only ask for an account at "Send".
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const reset = useCreateDraft((s) => s.reset);
  const status = useSession((s) => s.status);

  // Signed in (e.g. after "Logg inn") → go home. Only while focused, so an open create flow is never replaced.
  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') router.replace('/(tabs)');
    }, [status]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#140F0D' }}>
      <StatusBar style="light" />
      <Image source={{ uri: unsplash('1579457870378-16e766c0c266', 1400) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient
        colors={['rgba(12,14,18,0.75)', 'rgba(12,14,18,0.15)', 'rgba(20,15,13,0)', 'rgba(20,15,13,0.55)', 'rgba(20,15,13,0.95)']}
        locations={[0, 0.3, 0.5, 0.72, 0.92]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ flex: 1, paddingTop: insets.top + spacing.xxxl, paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }}>
        {/* Like the brand mockup: name and promise up top, the people in the photo below. */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Wordmark />
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeInDown.delay(260).duration(500)} style={{ gap: spacing.md }}>
          <Button
            title="Planlegg noe"
            icon="plus"
            onPress={() => {
              reset();
              router.push('/create');
            }}
            accessibilityHint="Lag et arrangement og finn en dato som passer alle"
          />
          <PressableScale onPress={() => router.push('/auth')} style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }} accessibilityLabel="Logg inn">
            <Text variant="headline" style={{ color: '#fff' }}>
              Logg inn
            </Text>
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}
