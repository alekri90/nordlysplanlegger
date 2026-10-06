import { Stack } from 'expo-router';

import { useColors } from '@/theme';

export default function CreateLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="sent" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
