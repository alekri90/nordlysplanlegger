import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { FEATURES } from '@/lib/config';
import { darkColors, lightColors, type ColorTokens } from './tokens';

type Theme = { colors: ColorTokens; scheme: 'light' | 'dark' };

const ThemeContext = createContext<Theme>({ colors: lightColors, scheme: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme = FEATURES.darkMode && system === 'dark' ? 'dark' : 'light';
  const value = useMemo<Theme>(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
