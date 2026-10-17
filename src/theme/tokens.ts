import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens for Nordlys Planlegger.
 * Warm, light and calm by default; dark is soft charcoal (never pure black) with the same coral–pink signature.
 * Coral is the social "do something" colour; ink (near-black) moves you forward in a flow.
 */

const palette = {
  coral50: '#FFF1F1',
  coral100: '#FFE3E4',
  coral200: '#FFC9CC',
  coral400: '#FF7F86',
  coral500: '#FF5F6D',
  coral600: '#F2475A',
  coral700: '#D63347',
  pink500: '#FF6B9A',
  green50: '#E9F7EF',
  green500: '#22A06B',
  green600: '#1A8A5A',
  amber500: '#F5A524',
  sand0: '#FFFFFF',
  sand50: '#FBF8F6',
  sand100: '#F5F1EE',
  sand200: '#EDE7E3',
  sand300: '#DCD4CF',
  sand500: '#A39B96',
  sand600: '#6E6661',
  sand900: '#16120F',
  night950: '#101116',
  night900: '#191A21',
  night800: '#202128',
  night750: '#292A32',
  night700: '#303139',
  night600: '#3E3F48',
  night500: '#898992',
  night300: '#A1A1AA',
  night100: '#F8F8FA',
  pinkDark: '#FF6385',
  coralDark: '#FF7772',
} as const;

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnDark: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryOnSoft: string;
  gradientStart: string;
  gradientEnd: string;
  ink: string;
  inkPressed: string;
  textOnInk: string;
  success: string;
  successSoft: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  scrim: string;
  skeleton: string;
  tabBar: string;
  /** Dark highlight cards and toasts: ink in light mode, a raised charcoal in dark (ink turns light there). */
  feature: string;
  textOnFeature: string;
  /** Behind the phone-width web layout on desktop. */
  backdrop: string;
};

export const lightColors: ColorTokens = {
  background: palette.sand50,
  surface: palette.sand0,
  surfaceMuted: palette.sand100,
  surfaceRaised: palette.sand0,
  border: palette.sand200,
  borderStrong: palette.sand300,
  text: palette.sand900,
  textSecondary: palette.sand600,
  textTertiary: palette.sand500,
  textOnDark: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  primary: palette.coral500,
  primaryPressed: palette.coral600,
  primarySoft: palette.coral100,
  primaryOnSoft: palette.coral700,
  gradientStart: '#FF7A6B',
  gradientEnd: palette.pink500,
  ink: palette.sand900,
  inkPressed: '#2B2521',
  textOnInk: '#FFFFFF',
  success: palette.green500,
  successSoft: palette.green50,
  warning: palette.amber500,
  danger: palette.coral700,
  dangerSoft: palette.coral50,
  overlay: 'rgba(15, 12, 10, 0.55)',
  scrim: 'rgba(15, 12, 10, 0.4)',
  skeleton: palette.sand200,
  tabBar: 'rgba(255, 255, 255, 0.96)',
  feature: palette.sand900,
  textOnFeature: '#FFFFFF',
  backdrop: palette.sand200,
};

export const darkColors: ColorTokens = {
  background: palette.night950,
  surface: palette.night800,
  surfaceMuted: palette.night900,
  surfaceRaised: palette.night750,
  border: palette.night700,
  borderStrong: palette.night600,
  text: palette.night100,
  textSecondary: palette.night300,
  textTertiary: palette.night500,
  textOnDark: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  primary: palette.pinkDark,
  primaryPressed: palette.coralDark,
  primarySoft: '#3A1D29',
  primaryOnSoft: '#FFB3C3',
  gradientStart: '#FF7A6B',
  gradientEnd: palette.pink500,
  ink: palette.night100,
  inkPressed: '#FFFFFF',
  textOnInk: palette.night950,
  success: '#3CC48A',
  successSoft: '#15291F',
  warning: palette.amber500,
  danger: palette.coralDark,
  dangerSoft: '#3A1D23',
  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.55)',
  skeleton: palette.night750,
  tabBar: 'rgba(25, 26, 33, 0.97)',
  feature: palette.night750,
  textOnFeature: palette.night100,
  backdrop: '#0B0C10',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** Type scale. Sizes are base sizes; Dynamic Type scales them (capped in <Text>). */
export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  title2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  title3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  footnote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** 4-pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Horizontal page gutter. */
export const gutter = 20;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const touchTarget = 48;

function shadow(y: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: '#2A1810', shadowOffset: { width: 0, height: y }, shadowRadius: blur, shadowOpacity: opacity },
    android: { elevation },
    default: { boxShadow: `0px ${y}px ${blur * 2}px rgba(42, 24, 16, ${opacity})` },
  })!;
}

export const shadows = {
  none: {} as ViewStyle,
  sm: shadow(1, 3, 0.06, 1),
  md: shadow(6, 14, 0.08, 4),
  lg: shadow(14, 28, 0.12, 10),
  primary: Platform.select<ViewStyle>({
    ios: { shadowColor: palette.coral500, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, shadowOpacity: 0.32 },
    android: { elevation: 6 },
    default: { boxShadow: '0px 8px 24px rgba(255, 95, 109, 0.32)' },
  })!,
} as const;

export const motion = {
  fast: 160,
  normal: 240,
  slow: 380,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
} as const;
