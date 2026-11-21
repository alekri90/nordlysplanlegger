import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Tag, Text } from '@/components/ui';
import type { PriceView } from '@/lib/price';
import { radius, spacing, useColors } from '@/theme';

/**
 * The price, drawn: the share per person large, the total under it, and while there are free
 * places a bar of them — what it costs with those coming now, and what it costs when it's full.
 */
export function PriceCard({ view, title = 'Pris', exempt, onDark, style }: { view: PriceView; title?: string; exempt?: boolean; onDark?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const m = view.meter;
  // The invitation is always dark; the event page follows light or dark.
  const c = onDark
    ? { title: 'rgba(255,255,255,0.55)', amount: exempt ? 'rgba(255,255,255,0.7)' : '#fff', soft: 'rgba(255,255,255,0.72)', on: '#FF9A8B', off: 'rgba(255,255,255,0.14)' }
    : { title: colors.textTertiary, amount: exempt ? colors.textSecondary : colors.text, soft: colors.textSecondary, on: colors.primary, off: colors.surfaceMuted };
  return (
    <Card
      elevated={!onDark}
      style={[{ gap: spacing.sm }, onDark && { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0 }, style]}
      accessible
      accessibilityLabel={`${title}: ${view.label}${exempt ? '. Du deler ikke kostnaden' : ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="overline" style={{ color: c.title }}>
          {title}
        </Text>
        {exempt ? <Tag label="Du betaler ikke" icon="gift" tone="success" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Text variant="title1" style={{ color: c.amount }}>
          {view.amount}
        </Text>
        <Text variant="subhead" style={{ color: c.soft }}>
          {view.unit}
        </Text>
      </View>
      {view.detail ? (
        <Text variant="footnote" style={{ color: c.soft, marginTop: -spacing.xs }}>
          {view.detail}
        </Text>
      ) : null}
      {m ? (
        <View style={{ marginTop: spacing.xs, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: m.total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: i < m.filled ? c.on : c.off }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <Text variant="caption" style={{ color: c.soft, flexShrink: 1 }}>
              {m.now}
            </Text>
            <Text variant="caption" style={{ color: c.on }}>
              {m.full}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
