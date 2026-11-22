import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import type { TemptingCard } from '@/lib/tempting';
import { fonts, radius, spacing, useColors } from '@/theme';

const HEIGHT = 216;

/**
 * «Hva frister?» — three pictures: one tall on the left, two stacked on the right. One tap starts a
 * plan with that name and picture; «Se flere» opens the rest.
 */
export function TemptingGrid({ cards, onPick, onMore, style }: { cards: TemptingCard[]; onPick: (card: TemptingCard) => void; onMore: () => void; style?: StyleProp<ViewStyle> }) {
  const [big, top, bottom] = cards;
  if (!big || !top || !bottom) return null;
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text variant="title3" style={{ fontFamily: fonts.bold }} accessibilityRole="header">
          Hva frister?
        </Text>
        <PressableScale onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel="Se flere forslag">
          <Text variant="footnote" color="primary">
            Se flere
          </Text>
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, height: HEIGHT }}>
        <Tile card={big} large onPick={onPick} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Tile card={top} onPick={onPick} />
          <Tile card={bottom} onPick={onPick} />
        </View>
      </View>
    </View>
  );
}

function Tile({ card, large, onPick }: { card: TemptingCard; large?: boolean; onPick: (card: TemptingCard) => void }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={() => onPick(card)}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={card.title}
      accessibilityHint="Starter en plan"
      style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}
    >
      <Image source={{ uri: thumb(card.cover, large ? 800 : 600) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} locations={[large ? 0.55 : 0.35, 1]} style={StyleSheet.absoluteFill} />
      <Text
        variant={large ? 'title3' : 'headline'}
        numberOfLines={2}
        style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: large ? spacing.lg : spacing.md, color: '#fff', fontFamily: fonts.bold }}
      >
        {card.title}
      </Text>
    </PressableScale>
  );
}
