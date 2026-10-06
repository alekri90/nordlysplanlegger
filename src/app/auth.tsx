import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, PressableScale, Text } from '@/components/ui';
import { Wordmark } from '@/components/brand/Wordmark';
import { unsplash } from '@/lib/categories';
import { env } from '@/lib/config';
import { useIsSignedIn } from '@/state/session';
import { gutter, spacing } from '@/theme';

/**
 * Sign-in — e-mail only: a one-time code (no password needed), or e-mail + password for
 * people who created a profile with one. Opened as a modal so the user returns to exactly
 * where they were (e.g. halfway through creating an event). `?reason=send` explains why we ask.
 */
export default function Auth() {
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const sending = reason === 'send';

  const signedIn = useIsSignedIn();

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, []);

  // Already signed in (e.g. returning from the code screen with nothing beneath): get out of the way.
  useFocusEffect(
    useCallback(() => {
      if (signedIn) close();
    }, [signedIn, close]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#140F0D' }}>
      <StatusBar style="light" />
      <Image source={{ uri: unsplash('1758599669742-e90b390b50bc', 1400) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient colors={['rgba(20,15,13,0.5)', 'rgba(20,15,13,0.2)', 'rgba(20,15,13,0.85)', '#140F0D']} locations={[0, 0.3, 0.6, 0.9]} style={StyleSheet.absoluteFill} />

      <View style={{ paddingTop: insets.top + spacing.xs, paddingHorizontal: gutter - 8 }}>
        <IconButton icon="x" variant="glass" accessibilityLabel="Lukk" onPress={close} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }}>
        <Animated.View entering={FadeInDown.duration(400)}>
          {sending ? (
            <>
              <Text variant="display" style={{ color: '#fff' }} accessibilityRole="header">
                Nesten klart!
              </Text>
              <Text variant="body" style={{ color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm }}>
                Logg inn med e-post så vi kan si fra når gjengen svarer. Gjestene trenger ingen konto.
              </Text>
            </>
          ) : (
            <Wordmark size="md" />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ gap: spacing.md, marginTop: spacing.xxl }}>
          <Button
            variant="light"
            title="Fortsett med e-post"
            icon="mail"
            onPress={() => router.push('/auth-otp')}
            accessibilityHint="Vi sender deg en kode – ingen passord å huske"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.sm }}>
            <PressableScale onPress={() => router.push('/auth-password')} hitSlop={8} accessibilityLabel="Logg inn med passord">
              <Text variant="callout" style={{ color: '#fff', textDecorationLine: 'underline' }}>
                Logg inn med passord
              </Text>
            </PressableScale>
            {!sending ? (
              <PressableScale onPress={() => router.push('/signup')} hitSlop={8} accessibilityLabel="Opprett profil">
                <Text variant="callout" style={{ color: '#fff', textDecorationLine: 'underline' }}>
                  Opprett profil
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>

        <Text variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.6)', marginTop: spacing.md }}>
          Ved å fortsette godtar du{' '}
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${env.webUrl}/vilkar`)}>
            vilkårene
          </Text>{' '}
          og{' '}
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${env.webUrl}/personvern`)}>
            personvernreglene
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}
