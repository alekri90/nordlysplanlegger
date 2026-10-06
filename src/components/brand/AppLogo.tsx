import { Image } from 'expo-image';

export const BRAND = {
  name: 'Nordlys Planlegger',
  /** The product name people use. "Nordlys" is the parent brand (Nordlys Kapital). */
  product: 'Planlegger',
  parent: 'Nordlys',
  tagline: 'Få gjengen samlet.',
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
