import { useState } from 'react';
import { Linking, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, PressableScale, Sheet, Tag, Text, type IconName } from '@/components/ui';
import type { PriceView } from '@/lib/price';
import { radius, spacing, useColors } from '@/theme';

import { PriceCard } from './PriceCard';

export type EventFactsProps = {
  /** «Tirsdag 24. november · kl. 19:00» */
  when: string;
  /** Add to the phone's calendar; `inCalendar` shows it's there. */
  onAddToCalendar?: () => void;
  inCalendar?: boolean;
  /** A small action on the right, e.g. «Sett tid» for the organizer. */
  whenAction?: { label: string; onPress: () => void };
  place?: { name: string; detail?: string | null; address?: string | null } | null;
  price?: { view: PriceView; title: string; exempt?: boolean } | null;
  /** Quieter lines under the rest, e.g. how it repeats. */
  notes?: { icon: IconName; text: string }[];
  /** The invitation is always dark; the event page follows light or dark. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The place in the phone's maps app (Apple Maps on iPhone, Google Maps elsewhere). */
function openMaps(name: string, address?: string | null) {
  const q = encodeURIComponent([name, address].filter(Boolean).join(', '));
  Linking.openURL(Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
}

/**
 * When, where and what it costs — one small card of rows under the photo, so the whole
 * event fits on the first screen. The price's working-out is one tap away.
 */
export function EventFacts({ when, onAddToCalendar, inCalendar, whenAction, place, price, notes = [], onDark, style }: EventFactsProps) {
  const colors = useColors();
  const [priceOpen, setPriceOpen] = useState(false);
  const c = onDark
    ? { bg: 'rgba(255,255,255,0.06)', border: 'transparent', line: 'rgba(255,255,255,0.08)', icon: 'rgba(255,255,255,0.6)', text: '#fff', soft: 'rgba(255,255,255,0.7)', link: '#FF9A8B', on: '#FF9A8B', off: 'rgba(255,255,255,0.14)', ok: '#8EE3B0' }
    : { bg: colors.surface, border: colors.border, line: colors.border, icon: colors.textSecondary, text: colors.text, soft: colors.textSecondary, link: colors.primary, on: colors.primary, off: colors.surfaceMuted, ok: colors.success };
  const m = price?.view.meter;

  const rows: React.ReactNode[] = [
    <Row
      key="when"
      icon="calendar"
      c={c}
      title={when}
      trailing={
        whenAction ? (
          <Link label={whenAction.label} color={c.link} onPress={whenAction.onPress} />
        ) : onAddToCalendar ? (
          <PressableScale
            onPress={onAddToCalendar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Legg i kalender"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4 }}
          >
            <Icon name="plus" size={14} tint={c.link} />
            <Text variant="footnote" style={{ color: c.link }}>
              Kalender
            </Text>
          </PressableScale>
        ) : inCalendar ? (
          <View accessible accessibilityLabel="Ligger i kalenderen" style={{ padding: 4 }}>
            <Icon name="check" size={18} tint={c.ok} />
          </View>
        ) : null
      }
    />,
  ];
  if (place) {
    rows.push(
      <Row
        key="place"
        icon="map-pin"
        c={c}
        title={place.name}
        subtitle={place.detail}
        trailing={<Link label="Kart" color={c.link} onPress={() => openMaps(place.name, place.address)} accessibilityLabel={`Vis ${place.name} i kart`} />}
      />,
    );
  }
  if (price) {
    rows.push(
      <PressableScale
        key="price"
        onPress={() => setPriceOpen(true)}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${price.title}: ${price.view.label}${price.exempt ? '. Du deler ikke kostnaden' : ''}`}
        accessibilityHint="Viser hele utregningen"
      >
        <Row
          icon="tag"
          c={c}
          title={`${price.view.amount} ${price.view.unit}`}
          below={
            m ? (
              <View style={{ gap: 4, marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {Array.from({ length: m.total }, (_, i) => (
                    <View key={i} style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: i < m.filled ? c.on : c.off }} />
                  ))}
                </View>
                <Text variant="caption" style={{ color: c.soft }}>
                  {m.now}
                </Text>
              </View>
            ) : price.view.detail ? (
              <Text variant="caption" style={{ color: c.soft, marginTop: 2 }}>
                {price.view.detail}
              </Text>
            ) : null
          }
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              {price.exempt ? <Tag label="Du betaler ikke" tone="success" /> : null}
              <Icon name="chevron-right" size={16} tint={c.icon} />
            </View>
          }
        />
      </PressableScale>,
    );
  }
  for (const n of notes) rows.push(<Row key={n.text} icon={n.icon} c={c} title={n.text} quiet />);

  return (
    <>
      <View style={[{ borderRadius: radius.lg, backgroundColor: c.bg, borderWidth: onDark ? 0 : 1, borderColor: c.border, paddingHorizontal: spacing.md }, style]}>
        {rows.map((r, i) => (
          <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            {r}
          </View>
        ))}
      </View>
      {price ? (
        <Sheet visible={priceOpen} onClose={() => setPriceOpen(false)} title={price.title === 'Pris' ? 'Hva det koster' : price.title}>
          <PriceCard view={price.view} title={price.title} exempt={price.exempt} />
          <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.md }}>
            Betalingen skjer utenfor appen{price.view.meter ? '. Prisen per person går ned jo flere som blir med.' : '.'}
          </Text>
        </Sheet>
      ) : null}
    </>
  );
}

type Colors = { icon: string; text: string; soft: string };

function Row({ icon, title, subtitle, below, trailing, quiet, c }: { icon: IconName; title: string; subtitle?: string | null; below?: React.ReactNode; trailing?: React.ReactNode; quiet?: boolean; c: Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: below ? 'flex-start' : 'center', gap: spacing.md, paddingVertical: quiet ? spacing.sm : 11, minHeight: quiet ? 36 : 46 }}>
      <View style={below ? { marginTop: 1 } : undefined}>
        <Icon name={icon} size={quiet ? 16 : 18} tint={c.icon} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant={quiet ? 'footnote' : 'subhead'} style={{ color: quiet ? c.soft : c.text }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={{ color: c.soft }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {below}
      </View>
      {trailing}
    </View>
  );
}

function Link({ label, color, onPress, accessibilityLabel }: { label: string; color: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <PressableScale onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 }}>
      <Text variant="footnote" style={{ color }}>
        {label}
      </Text>
      <Icon name="chevron-right" size={14} tint={color} />
    </PressableScale>
  );
}
