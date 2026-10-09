import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Divider, Icon, ListRow, PressableScale, Sheet, Text, Toggle } from '@/components/ui';
import {
  CONFIRM_LEAD_OPTIONS,
  confirmLabel,
  REPEAT_PRESETS,
  repeatLabel,
  repeatSummary,
  unitWord,
  weekdaysLabel,
  type RepeatConfig,
  type RepeatUnit,
} from '@/lib/recurrence';
import { spacing, useColors } from '@/theme';

const WEEKDAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const UNITS: { id: RepeatUnit; label: string }[] = [
  { id: 'day', label: 'Dager' },
  { id: 'week', label: 'Uker' },
  { id: 'month', label: 'Måneder' },
];

type Props = {
  value: RepeatConfig;
  onChange: (patch: Partial<RepeatConfig>) => void;
  /** The event finds its date with a poll: offer "find a new date each time". */
  poll: boolean;
  /** For "Hver torsdag" / "Første fredag hver måned". */
  firstDate?: string | null;
};

/**
 * How often, and — only when relevant — how the date is found and which days to suggest.
 * Three big choices up front; the rest behind "Tilpass" and "Flere valg".
 */
export function RepeatEditor({ value, onChange, poll, firstDate }: Props) {
  const colors = useColors();
  const [customOpen, setCustomOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const preset = REPEAT_PRESETS.find((p) => p.unit === value.unit && p.count === value.count);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {REPEAT_PRESETS.map((p) => (
          <Chip key={p.id} label={repeatLabel(p.unit, p.count)} selected={preset?.id === p.id} onPress={() => onChange({ unit: p.unit, count: p.count })} />
        ))}
        <Chip label={preset ? 'Tilpass' : repeatLabel(value.unit, value.count)} icon="sliders" selected={!preset} onPress={() => setCustomOpen(true)} />
      </View>

      {poll ? (
        <View>
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.xs }}>
            Hvordan finner vi dato neste gang?
          </Text>
          <ListRow
            title="Finn beste dato hver gang"
            subtitle={`Vi spør gjengen hvilke dager som passer, ${repeatLabel(value.unit, value.count).toLowerCase()}.`}
            radio
            selected={value.dateMode === 'poll_each'}
            onPress={() => onChange({ dateMode: 'poll_each' })}
          />
          <ListRow
            title="Bruk samme mønster"
            subtitle="Samme ukedag som dagen dere velger nå"
            radio
            selected={value.dateMode === 'fixed'}
            onPress={() => onChange({ dateMode: 'fixed' })}
          />
        </View>
      ) : null}

      {poll && value.dateMode === 'poll_each' ? (
        <View>
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.sm }}>
            Hvilke dager skal vi foreslå? {value.weekdays.length ? `· ${weekdaysLabel(value.weekdays)}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {WEEKDAY_SHORT.map((label, i) => {
              const on = value.weekdays.includes(i);
              return (
                <PressableScale
                  key={label}
                  onPress={() => onChange({ weekdays: on ? value.weekdays.filter((d) => d !== i) : [...value.weekdays, i].sort() })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.ink : colors.surface,
                    borderWidth: 1,
                    borderColor: on ? colors.ink : colors.border,
                  }}
                >
                  <Text variant="footnote" style={{ color: on ? colors.textOnInk : colors.text }}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
          {repeatSummary(value, value.dateMode === 'fixed' ? firstDate : null)}
          {value.requiresConfirmation ? ` · ${confirmLabel(value.confirmationLeadDays)}` : ''}
        </Text>
        <PressableScale onPress={() => setMoreOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Flere valg for gjentakelse">
          <Text variant="footnote" color="textSecondary">
            Flere valg
          </Text>
          <Icon name="chevron-right" size={14} color="textSecondary" />
        </PressableScale>
      </View>

      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Hvor ofte?">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginVertical: spacing.md }}>
          <Text variant="title3">Hver</Text>
          <PressableScale onPress={() => onChange({ count: Math.max(1, value.count - 1) })} accessibilityLabel="Færre" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="minus" size={18} />
          </PressableScale>
          <Text variant="display" style={{ minWidth: 40, textAlign: 'center' }} accessibilityLabel={`${value.count}`}>
            {value.count}
          </Text>
          <PressableScale onPress={() => onChange({ count: Math.min(52, value.count + 1) })} accessibilityLabel="Flere" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} />
          </PressableScale>
          <Text variant="title3">{unitWord(value.unit, value.count)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
          {UNITS.map((u) => (
            <Chip key={u.id} label={u.label} selected={value.unit === u.id} onPress={() => onChange({ unit: u.id })} />
          ))}
        </View>
        <Text variant="footnote" color="textSecondary" align="center" style={{ marginTop: spacing.md }}>
          {repeatLabel(value.unit, value.count)}
        </Text>
        <Button title="Ferdig" variant="ink" onPress={() => setCustomOpen(false)} style={{ marginTop: spacing.lg }} />
      </Sheet>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Flere valg">
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow
            title="Krev bekreftelse hver gang"
            subtitle="Alle får «Kommer du?» før hver gang"
            trailing={<Toggle value={value.requiresConfirmation} onValueChange={(v) => onChange({ requiresConfirmation: v })} accessibilityLabel="Krev bekreftelse hver gang" />}
          />
          {value.requiresConfirmation ? (
            <>
              <Divider />
              <View style={{ paddingVertical: spacing.md }}>
                <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.sm }}>
                  Når skal vi spørre?
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {CONFIRM_LEAD_OPTIONS.map((d) => (
                    <Chip key={d} label={d === 7 ? '1 uke før' : `${d} ${d === 1 ? 'dag' : 'dager'} før`} selected={value.confirmationLeadDays === d} onPress={() => onChange({ confirmationLeadDays: d })} />
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </Card>
        <Button title="Ferdig" variant="ink" onPress={() => setMoreOpen(false)} style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

/** The switch on the date step: off = nothing else shows. */
export function RepeatSection({ enabled, onToggle, children }: { enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: spacing.xxl }}>
      <ListRow
        icon="repeat"
        title="Gjenta arrangementet"
        subtitle={enabled ? undefined : 'Nordlys ordner neste gang selv'}
        trailing={<Toggle value={enabled} onValueChange={onToggle} accessibilityLabel="Gjenta arrangementet" />}
      />
      {enabled ? <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>{children}</View> : null}
    </Card>
  );
}
