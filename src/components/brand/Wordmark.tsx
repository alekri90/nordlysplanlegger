import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { fonts } from '@/theme';
import { BRAND } from './AppLogo';

type Props = {
  /** Light text for photos (default), or dark for light backgrounds. */
  tone?: 'light' | 'dark';
  size?: 'lg' | 'md';
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** **Samle** above **gjengen** (in coral), then the promise. */
export function Wordmark({ tone = 'light', size = 'lg', showTagline = true, style }: Props) {
  const fg = tone === 'light' ? '#FFFFFF' : '#16120F';
  const sub = tone === 'light' ? 'rgba(255,255,255,0.85)' : '#6E6661';
  const big = size === 'lg' ? 52 : 34;
  return (
    <View style={style} accessible accessibilityRole="header" accessibilityLabel={`${BRAND.name}. ${showTagline ? BRAND.tagline : ''}`}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: big, lineHeight: big * 1.05, letterSpacing: -1.2, color: fg }}>
        {BRAND.short}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: big, lineHeight: big * 1.05, letterSpacing: -1.2, color: tone === 'light' ? '#FF7F86' : '#FF5F6D' }}>
        gjengen
      </Text>
      {showTagline ? (
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: size === 'lg' ? 20 : 16, lineHeight: size === 'lg' ? 27 : 22, color: sub, marginTop: 6 }}>
          {BRAND.tagline}
        </Text>
      ) : null}
    </View>
  );
}
