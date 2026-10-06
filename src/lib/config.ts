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

/**
 * Store links, shown only once the app is published there (a link to a missing app is a dead end).
 * App Store: set to 'https://apps.apple.com/app/id6819851126' when the app is live.
 */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export function inviteUrl(token: string) {
  return `${env.webUrl}/i/${token}`;
}

export function groupInviteUrl(token: string) {
  return `${env.webUrl}/g/${token}`;
}
