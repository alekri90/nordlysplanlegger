import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { typography, useColors, type ColorTokens, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  align?: TextStyle['textAlign'];
};

/** Themed text. Respects Dynamic Type, capped so layouts survive large settings. */
export function Text({ variant = 'body', color = 'text', align, style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const colors = useColors();
  const isLarge = variant === 'display' || variant === 'title1';
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isLarge ? 1.25 : 1.5)}
      style={[typography[variant], { color: colors[color] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
