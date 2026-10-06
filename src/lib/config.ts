import Constants from 'expo-constants';

/** Public runtime configuration. Only EXPO_PUBLIC_* values are available in the client. */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL ?? (Constants.expoConfig?.extra?.webUrl as string | undefined) ?? 'https://nordlysplanlegger.vercel.app').replace(/\/$/, ''),
  easProjectId:
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    undefined,
};

/** Without a Supabase project the app runs on realistic built-in demo data. */
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1' || !env.supabaseUrl || !env.supabaseAnonKey;

/** Feature flags. Planning features are never gated behind payment. */
export const FEATURES = {
  /** Dark tokens exist; enable once every screen has been reviewed in dark mode. */
  darkMode: false,
  /** Native sponsored suggestions (e.g. "Trenger dere sted?") — data model ready, UI off. */
  sponsored: false,
} as const;

export const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=no.nordlys.planlegger';

export function inviteUrl(token: string) {
  return `${env.webUrl}/i/${token}`;
}

export function groupInviteUrl(token: string) {
  return `${env.webUrl}/g/${token}`;
}
