import type { ExpoConfig } from 'expo/config';

// Public, non-secret configuration only. Secrets never go in the client.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://samlegjengen.no';
// Links open the app on the new address and on the old one, which links already shared in group chats
// and older app versions use. Both are the same Vercel project, so both serve the association files.
const LINK_HOSTS = [...new Set([new URL(WEB_URL).host, 'samlegjengen.no', 'nordlysplanlegger.vercel.app'])];
const LINK_PATHS = ['/i/', '/g/', '/a/', '/r/', '/@'];
// Public identifier from `eas init`, not a secret. The env var can override it.
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '623cc93d-c24b-46f6-aac0-0fa470305919';

const config: ExpoConfig = {
  // «Samle gjengen» in the stores and under the icon on both platforms. The bundle id, slug, scheme
  // and web address keep the old name: changing them would make it a different app.
  name: 'Samle gjengen',
  slug: 'nordlys-planlegger',
  scheme: 'nordlysplanlegger',
  version: '1.5.0',
  // Android 16 ignores orientation locks on tablets and foldables, so Android follows the device
  // (the layout centres itself on wide screens). The iPhone app stays portrait (infoPlist below).
  orientation: 'default',
  icon: './assets/icon.png',
  // Follows the phone; Profil → Utseende can force light or dark (src/state/appearance.ts).
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FBF8F6',
  ios: {
    bundleIdentifier: 'no.nordlys.planlegger',
    supportsTablet: false,
    associatedDomains: LINK_HOSTS.map((host) => `applinks:${host}`),
    // «Spontant» invitations are time-sensitive: they come through Focus (not critical alerts).
    entitlements: { 'com.apple.developer.usernotifications.time-sensitive': true },
    infoPlist: {
      // «Legg i kalender» on a single event still only asks to add.
      NSCalendarsWriteOnlyAccessUsageDescription: 'Lar deg legge arrangementer rett i kalenderen din.',
      // Lets us check if share targets are installed before deep linking into them.
      LSApplicationQueriesSchemes: ['whatsapp', 'fb-messenger', 'snapchat', 'instagram'],
      ITSAppUsesNonExemptEncryption: false,
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
    },
    // Required-reason APIs used by React Native, Expo modules and AsyncStorage.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
    },
  },
  android: {
    package: 'no.nordlys.planlegger',
    // Firebase (FCM) for Android push. Public identifiers; the FCM service account key is stored on EAS.
    googleServicesFile: './google-services.json',
    // We only read phone numbers to find friends; never write to the address book.
    blockedPermissions: ['android.permission.WRITE_CONTACTS'],
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
        data: LINK_HOSTS.flatMap((host) => LINK_PATHS.map((pathPrefix) => ({ scheme: 'https', host, pathPrefix }))),
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
    // Google Play: shrink and obfuscate the Android code (R8) and drop unused resources.
    // iOS: the UIKit scene life cycle, which the iOS 27 SDK (Xcode 27, see eas.json) requires on SDK 57.
    // SDK 58 has it built in, so drop `ios` here when upgrading.
    [
      'expo-build-properties',
      {
        android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true },
        ios: { enableSceneSupport: true },
      },
    ],
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
        dark: { backgroundColor: '#101116', image: './assets/splash-icon.png' },
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
        // Full access: keeping the calendar in step means finding our own entries, and «Vis kollisjoner» reads the rest.
        calendarPermission: 'Legger arrangementene dine i kalenderen du velger og holder dem oppdatert. Slår du på «Vis kollisjoner», ser appen også om du allerede er opptatt. Ingenting fra kalenderen sendes til oss.',
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission: 'Lar deg finne venner som allerede bruker appen. Bare telefonnumrene sjekkes – ingenting lagres.',
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
