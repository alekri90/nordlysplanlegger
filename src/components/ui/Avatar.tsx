import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, useColors } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

const FALLBACK_TINTS = ['#FFD9C7', '#FFE1E5', '#E3E9FF', '#DDF3E6', '#FCEBC4', '#EBDDFB', '#D6EEF5'];
const FALLBACK_INK = ['#B4512A', '#C23A55', '#3D51B8', '#227A4E', '#9A6B10', '#6A3FB0', '#1F6C82'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
  /** White ring, used when avatars overlap or sit on photos. */
  ring?: boolean;
  /** Small status badge in the corner. */
  status?: 'selected' | 'unavailable' | 'attending' | null;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, uri, size = 44, ring, status, style }: AvatarProps) {
  const colors = useColors();
  const i = hash(name) % FALLBACK_TINTS.length;
  const badge = status ? Math.max(16, Math.round(size * 0.36)) : 0;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: FALLBACK_TINTS[i],
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: ring ? 2 : 0,
          borderColor: colors.surface,
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} />
        ) : (
          <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.38, color: FALLBACK_INK[i] }} maxFontSizeMultiplier={1}>
            {initials(name)}
          </Text>
        )}
      </View>
      {status ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            top: -2,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: status === 'unavailable' ? colors.textTertiary : status === 'attending' ? colors.success : colors.primary,
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={status === 'unavailable' ? 'x' : 'check'} size={badge * 0.6} tint="#fff" />
        </View>
      ) : null}
    </View>
  );
}

type StackProps = {
  people: { id: string; name: string; avatarUrl?: string | null }[];
  size?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
};

/** Overlapping avatars with a "+N" chip. */
export function AvatarStack({ people, size = 32, max = 5, style }: StackProps) {
  const colors = useColors();
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const overlap = size * 0.28;
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
      accessible
      accessibilityLabel={`${people.map((p) => p.name.split(' ')[0]).slice(0, 4).join(', ')}${people.length > 4 ? ` og ${people.length - 4} til` : ''}`}
    >
      {shown.map((p, idx) => (
        <View key={p.id} style={{ marginLeft: idx === 0 ? 0 : -overlap, zIndex: max - idx }}>
          <Avatar name={p.name} uri={p.avatarUrl} size={size} ring />
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" color="textSecondary" maxFontSizeMultiplier={1}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
