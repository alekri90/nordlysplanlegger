import { Image } from 'expo-image';

export const BRAND = {
  /** The name in the App Store, on the web and in the texts. */
  name: 'Samle gjengen',
  /** Under the icon and next to the logo, where the whole name doesn't fit. */
  short: 'Samle',
  tagline: 'Finn en dag som passer alle.',
} as const;

/** Official logo: calendar + wave (transparent PNG, cropped square). Also the source for the generated app icons. */
const MARK = require('../../../assets/brand-mark.png');

/** The logo. Works on light and dark backgrounds — it carries its own light calendar. */
export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}
    />
  );
}
