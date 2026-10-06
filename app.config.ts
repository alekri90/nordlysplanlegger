import type { ExpoConfig } from 'expo/config';

// Public, non-secret configuration only. Secrets never go in the client.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://nordlysplanlegger.vercel.app';
const webHost = new URL(WEB_URL).host;
// Public identifier from `eas init`, not a secret. The env var can override it.
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '623cc93d-c24b-46f6-aac0-0fa470305919';

const config: ExpoConfig = {
  name: 'Nordlys Planlegger',
  slug: 'nordlys-planlegger',
  scheme: 'nordlysplanlegger',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Dark tokens are ready (src/theme). Flip to 'automatic' together with FEATURES.darkMode.
  userInterfaceStyle: 'light',
  backgroundColor: '#FBF8F6',
  ios: {
    bundleIdentifier: 'no.nordlys.planlegger',
    supportsTablet: false,
    associatedDomains: [`applinks:${webHost}`],
    infoPlist: {
      // Lets us check if share targets are installed before deep linking into them.
      LSApplicationQueriesSchemes: ['whatsapp', 'fb-messenger', 'snapchat', 'instagram'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'no.nordlys.planlegger',
    adaptiveIcon: {
      backgroundColor: '#FFF4EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: true,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: webHost, pathPrefix: '/i/' },
          { scheme: 'https', host: webHost, pathPrefix: '/@' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-image',
    'expo-font',
    'expo-sharing',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#FBF8F6',
        dark: { backgroundColor: '#0F0D0C', image: './assets/splash-icon.png' },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#FF5F6D',
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission: 'Lar deg legge arrangementer rett i kalenderen din.',
        writeOnlyCalendarPermission: 'Lar deg legge arrangementer rett i kalenderen din.',
        writeOnlyAccess: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Lar deg velge et eget bilde til arrangementet eller profilen din.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    webUrl: WEB_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
};

export default config;
