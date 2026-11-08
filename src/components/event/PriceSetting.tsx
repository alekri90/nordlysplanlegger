import { useState } from 'react';
import { View } from 'react-native';

import { Input, ListRow, Text, Toggle } from '@/components/ui';
import { describePrice, formatKr, parseKr, type Price, type PriceMode } from '@/lib/price';
import { spacing } from '@/theme';

/**
 * «Pris» — shown to everyone; payment happens outside the app. Either a cost that is shared
 * (renting the sauna) or a fixed price per person. Calls onChange(null) until there is an amount.
 */
export function PriceSetting({
  value,
  onChange,
  maxParticipants,
  nonPayingPlaces = 0,
}: {
  value: Price | null;
  onChange: (price: Price | null) => void;
  maxParticipants: number | null;
  nonPayingPlaces?: number | null;
}) {
  const [on, setOn] = useState(value != null);
  const [mode, setMode] = useState<PriceMode>(value?.mode ?? 'split');
  const [text, setText] = useState(value ? formatKr(value.amountOre).replace(' kr', '') : '');
  const amount = parseKr(text);

  const emit = (next: { on?: boolean; mode?: PriceMode; text?: string }) => {
    const o = next.on ?? on;
    const m = next.mode ?? mode;
    const a = parseKr(next.text ?? text);
    onChange(o && a ? { mode: m, amountOre: a } : null);
  };

  const preview = amount ? describePrice({ mode, amountOre: amount }, { maxParticipants, payingPlaces: 0, nonPayingPlaces }) : null;

  return (
    <View>
      <ListRow
        icon="tag"
        title="Pris"
        subtitle={on ? 'Vises for alle · betaling skjer utenfor appen' : 'Gratis, eller ikke oppgitt'}
        trailing={
          <Toggle
            value={on}
            onValueChange={(v) => {
              setOn(v);
              emit({ on: v });
            }}
            accessibilityLabel="Pris"
          />
        }
      />
      {on ? (
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <ListRow
            title="En kostnad som deles"
            subtitle="F.eks. leie av badstue – prisen per person faller jo flere som kommer"
            radio
            selected={mode === 'split'}
            onPress={() => {
              setMode('split');
              emit({ mode: 'split' });
            }}
          />
          <ListRow
            title="Fast pris per person"
            subtitle="Alle betaler det samme"
            radio
            selected={mode === 'per_person'}
            onPress={() => {
              setMode('per_person');
              emit({ mode: 'per_person' });
            }}
          />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Input
              label={mode === 'split' ? 'Hele kostnaden (kr)' : 'Pris per person (kr)'}
              placeholder={mode === 'split' ? 'F.eks. 2 500' : 'F.eks. 250'}
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={text}
              onChangeText={(t) => {
                setText(t);
                emit({ text: t });
              }}
              error={text && amount === null ? 'Skriv et beløp, f.eks. 250' : null}
              maxLength={12}
            />
            {preview ? (
              <Text variant="footnote" color="textSecondary">
                {preview.headline}
                {preview.detail ? ` · ${preview.detail}` : ''}
                {mode === 'split' && !maxParticipants ? '. Begrens antall plasser for å vise prisen når det er fullt.' : ''}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
