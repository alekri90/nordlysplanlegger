import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { AppleIcon } from '@/components/brand/BrandIcons';
import { AppLogo } from '@/components/brand/AppLogo';
import { BottomBar, Button, Card, Icon, PressableScale, Screen, ScreenScroll, Text, type IconName } from '@/components/ui';
import { useInvite } from '@/data/hooks';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/config';
import { firstName } from '@/lib/eventText';
import { useIsSignedIn } from '@/state/session';
import { spacing, useColors } from '@/theme';

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'edit-3', text: 'Du slipper å skrive inn navnet neste gang' },
  { icon: 'user-plus', text: 'Venner kan invitere deg direkte' },
  { icon: 'users', text: 'Du kan bli lagt til i faste gjenger' },
  { icon: 'calendar', text: 'Du får oversikt over arrangementene dine' },
];

/** Thanks! Then — and only then — a gentle invitation to get the app. */
export default function Done() {
  const colors = useColors();
  const { token, name, attending } = useLocalSearchParams<{ token: string; name?: string; attending?: string }>();
  const invite = useInvite(token);
  const signedIn = useIsSignedIn();
  const organizer = invite.data ? firstName(invite.data.organizer.name) : 'arrangøren';
  const isWeb = Platform.OS === 'web';

  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 200 }));
  }, [scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const title = attending === '0' ? 'Takk for beskjed' : name ? `Takk, ${firstName(name)}!` : 'Takk for svaret!';
  const body =
    attending === '1'
      ? `${organizer} vet at du kommer. Vi sees!`
      : attending === '0'
        ? `${organizer} vet at du ikke kan denne gangen.`
        : `Vi sier fra når ${organizer} har låst datoen.`;

  return (
    <Screen>
      <ScreenScroll contentContainerStyle={{ paddingTop: spacing.huge }} bottomInset={140}>
        <Animated.View style={[{ alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }, pop]}>
          <Icon name="check" size={40} tint="#fff" />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(380)}>
          <Text variant="title1" align="center" style={{ marginTop: spacing.xl }} accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
            {body}
          </Text>
        </Animated.View>

        {!signedIn ? (
          <Animated.View entering={FadeInDown.delay(300).duration(380)}>
            <Card style={{ marginTop: spacing.xxxl, gap: spacing.md, paddingVertical: spacing.xl }}>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <AppLogo size={52} />
                <Text variant="title3" align="center">
                  Vil du lagre profilen din?
                </Text>
              </View>
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                {BENEFITS.map((b) => (
                  <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Icon name={b.icon} size={16} color="primary" />
                    <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
                      {b.text}
                    </Text>
                  </View>
                ))}
              </View>
              <Button
                title="Opprett profil"
                variant="ink"
                style={{ marginTop: spacing.sm }}
                onPress={() => router.push({ pathname: '/signup', params: { token, ...(name ? { name } : {}) } })}
              />
              <Text variant="caption" color="textTertiary" align="center">
                Svaret ditt er lagret uansett.
              </Text>
            </Card>
            {isWeb ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
                <PressableScale onPress={() => Linking.openURL(APP_STORE_URL)} accessibilityLabel="Last ned for iPhone" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm }}>
                  <AppleIcon size={14} />
                  <Text variant="footnote" color="textSecondary">
                    App Store
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => Linking.openURL(PLAY_STORE_URL)} accessibilityLabel="Last ned for Android" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm }}>
                  <Icon name="smartphone" size={14} color="textSecondary" />
                  <Text variant="footnote" color="textSecondary">
                    Google Play
                  </Text>
                </PressableScale>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button
          variant={signedIn ? 'ink' : 'ghost'}
          title={signedIn ? 'Til forsiden' : 'Tilbake til invitasjonen'}
          onPress={() => (signedIn ? router.replace('/(tabs)') : router.replace({ pathname: '/i/[token]', params: { token } }))}
        />
      </BottomBar>
    </Screen>
  );
}
