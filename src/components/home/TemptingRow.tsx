import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, PressableScale, SectionHeader, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import type { TemptingCard } from '@/lib/tempting';
import { gutter, radius, spacing, useColors } from '@/theme';

const CARD_WIDTH = 156;
const CARD_HEIGHT = 184;
/** «Pepperkakebaking» is one word: a size down so it never breaks in the middle. */
const longWord = (title: string) => Math.max(...title.split(/\s+/).map((w) => w.length)) >= 14;

/** «Hva frister?» — a row of pictures; one tap starts a plan with that name and picture. */
export function TemptingRow({ cards, onPick, onMore, style }: { cards: TemptingCard[]; onPick: (card: TemptingCard) => void; onMore: () => void; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  if (!cards.length) return null;
  return (
    <View style={style}>
      <SectionHeader title="Hva frister?" action="Se flere" onAction={onMore} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.sm}
        snapToAlignment="start"
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.sm }}
      >
        {cards.map((c) => (
          <PressableScale
            key={c.key}
            onPress={() => onPick(c)}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={c.again ? `Gjør igjen: ${c.title}` : c.title}
            accessibilityHint="Starter en plan"
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}
          >
            <Image source={{ uri: thumb(c.cover, 480) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
            {c.again ? (
              <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Icon name="rotate-ccw" size={11} tint="#fff" />
                <Text variant="caption" style={{ color: '#fff' }}>
                  Gjør igjen
                </Text>
              </View>
            ) : null}
            <Text variant={longWord(c.title) ? 'callout' : 'headline'} numberOfLines={2} style={{ position: 'absolute', left: spacing.md, right: spacing.sm, bottom: spacing.md, color: '#fff' }}>
              {c.title}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}
