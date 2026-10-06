import FontAwesome from '@expo/vector-icons/FontAwesome';

/** Used for the App Store download link. */
export function AppleIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return <FontAwesome name="apple" size={size + 2} color={color} />;
}
