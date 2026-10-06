import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { repo } from '@/data';
import { env } from './config';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Ask for permission and register this device. Called at a meaningful moment
 * (right after the first invitation is sent), never on app start.
 * Returns false when the user declined or push isn't available.
 */
export async function registerForPush(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Arrangementer',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FF5F6D',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return false;

  if (!env.easProjectId) return true; // Demo / local dev without EAS: permission only.
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });
    await repo.registerPushToken(data, Platform.OS as 'ios' | 'android');
    return true;
  } catch {
    return false;
  }
}

export async function pushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

/** Opens the right screen when a push notification is tapped (also on cold start). Mount once at the root. */
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        openFromNotification(r);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);
}
