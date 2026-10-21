import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { queryClient } from '@/data/hooks';
import { usePendingGroupJoin } from '@/lib/pendingJoin';
import { useNotificationRouting } from '@/lib/push';
import { useSession, useSessionBootstrap } from '@/state/session';
import { useAppearance } from '@/state/appearance';
import { ThemeProvider, useColors, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  const appearanceReady = useAppearance((s) => s.ready);

  return (
    <ThemeProvider>
      <Root>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>{(fontsLoaded || fontError) && appearanceReady ? <WebFrame><AppStack /></WebFrame> : null}</ToastProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </Root>
    </ThemeProvider>
  );
}

function Root({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>{children}</GestureHandlerRootView>;
}

/** Phone-width and centred on wide screens: desktop browsers, tablets, foldables and landscape. */
function WebFrame({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' && width < 600) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.backdrop }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function AppStack() {
  const { colors, scheme } = useTheme();
  const status = useSession((s) => s.status);
  const needsOnboarding = useSession((s) => s.status === 'signedIn' && !!s.profile && !s.profile.onboarded);
  const segments = useSegments();
  useSessionBootstrap();
  useNotificationRouting();
  usePendingGroupJoin();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Signed up with an e-mail code (generated @username) and never confirmed name/@username → one short setup step.
  const segment = segments[0] as string | undefined;
  useEffect(() => {
    if (needsOnboarding && segment !== 'profile-setup' && segment !== 'signup' && segment !== 'i' && segment !== 'personvern' && segment !== 'vilkar' && segment !== 'support' && segment !== 'barnesikkerhet') router.push('/profile-setup');
  }, [needsOnboarding, segment]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* No native headers anywhere, so no iOS 26 scroll-edge blur either (it fogged the top of full-bleed photos). */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'default', scrollEdgeEffects: { top: 'hidden', bottom: 'hidden' } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="event/[id]/locked" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="event/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group/[id]/add-members" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="signup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-setup" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}
