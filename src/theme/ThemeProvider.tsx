import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useAppearance } from '@/state/appearance';
import { darkColors, lightColors, type ColorTokens } from './tokens';

type Theme = { colors: ColorTokens; scheme: 'light' | 'dark' };

const ThemeContext = createContext<Theme>({ colors: lightColors, scheme: 'light' });

/** Light, dark or the phone's setting (Profil → Utseende). Switches instantly, no restart. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useAppearance((s) => s.preference);
  const scheme = preference === 'auto' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<Theme>(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }), [scheme]);

  useEffect(() => {
    const background = value.colors.background;
    if (Platform.OS === 'web') {
      document.documentElement.style.backgroundColor = background;
      document.body.style.backgroundColor = background;
      document.documentElement.style.colorScheme = scheme;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', background));
    } else {
      SystemUI.setBackgroundColorAsync(background).catch(() => {});
    }
  }, [scheme, value.colors.background]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
