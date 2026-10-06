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
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { queryClient } from '@/data/hooks';
import { useNotificationRouting } from '@/lib/push';
import { useSession, useSessionBootstrap } from '@/state/session';
import { lightColors, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: lightColors.background }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>{fontsLoaded || fontError ? <WebFrame><AppStack /></WebFrame> : null}</ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** On desktop browsers the invitation page is shown phone-width, centred. */
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#EDE7E3' }}>
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

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Signed up with an e-mail code (generated @username) and never confirmed name/@username → one short setup step.
  const segment = segments[0] as string | undefined;
  useEffect(() => {
    if (needsOnboarding && segment !== 'profile-setup' && segment !== 'signup' && segment !== 'i') router.push('/profile-setup');
  }, [needsOnboarding, segment]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'default' }}>
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
