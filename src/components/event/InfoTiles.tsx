import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { radius, spacing, useColors } from '@/theme';

export type InfoTile = {
  icon: IconName;
  label: string;
  /** A small action under the label: «Legg i kalender», «Se hvem». */
  hint?: string;
  onPress?: () => void;
};

/**
 * Date · time · places side by side, as on the invitation. On the event page they follow light or
 * dark; the invitation is always dark (`onDark`).
 */
export function InfoTiles({ tiles, onDark, style }: { tiles: InfoTile[]; onDark?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const c = onDark
    ? { bg: 'rgba(255,255,255,0.06)', border: 'transparent', line: 'rgba(255,255,255,0.08)', icon: 'rgba(255,255,255,0.85)', text: 'rgba(255,255,255,0.85)', hint: '#FF9A8B' }
    : { bg: colors.surface, border: colors.border, line: colors.border, icon: colors.textSecondary, text: colors.text, hint: colors.primary };
  return (
    <View style={[{ flexDirection: 'row', borderRadius: radius.lg, backgroundColor: c.bg, borderWidth: onDark ? 0 : 1, borderColor: c.border }, style]}>
      {tiles.map((t, i) => {
        const tileStyle: ViewStyle = {
          flex: 1,
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xs,
          borderLeftWidth: i ? 1 : 0,
          borderLeftColor: c.line,
        };
        const body = (
          <>
            <Icon name={t.icon} size={20} tint={c.icon} />
            <Text variant="caption" align="center" style={{ color: c.text }} numberOfLines={2}>
              {t.label}
            </Text>
            {t.hint ? (
              <Text variant="caption" align="center" style={{ color: c.hint, marginTop: -spacing.xs }} numberOfLines={1}>
                {t.hint}
              </Text>
            ) : null}
          </>
        );
        return t.onPress ? (
          <PressableScale key={`${t.icon}-${i}`} onPress={t.onPress} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={t.hint ? `${t.label}. ${t.hint}` : t.label} style={tileStyle}>
            {body}
          </PressableScale>
        ) : (
          <View key={`${t.icon}-${i}`} accessible accessibilityLabel={t.label} style={tileStyle}>
            {body}
          </View>
        );
      })}
    </View>
  );
}
