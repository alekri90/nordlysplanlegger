import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card, Chip, Icon, PressableScale, Text } from '@/components/ui';
import type { TimeHint } from '@/data/types';
import { haptics } from '@/lib/haptics';
import { fonts, radius, spacing, useColors } from '@/theme';

const HINTS: { id: TimeHint; label: string }[] = [
  { id: 'evening', label: 'Etter kl. 18' },
  { id: 'daytime', label: 'På dagtid' },
  { id: 'any', label: 'Når som helst' },
  { id: 'exact', label: 'Velg klokkeslett' },
];

/** Quick picks; any minute can be set with the arrows or by typing. */
const TIMES = ['10:00', '12:00', '16:00', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '21:00'];

const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (t: string | null) => {
  const [h, m] = (t ?? '18:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 18) * 60 + (Number.isFinite(m) ? m : 0);
};
const fromMinutes = (total: number) => {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
};

/** Time preference in one row. The exact time appears only when asked for. */
export function TimePicker({
  hint,
  time,
  onChange,
  allowHints = true,
}: {
  hint: TimeHint;
  time: string | null;
  onChange: (hint: TimeHint, time: string | null) => void;
  allowHints?: boolean;
}) {
  const hints = allowHints ? HINTS : HINTS.filter((h) => h.id === 'exact' || h.id === 'any');
  const scroller = useRef<ScrollView>(null);
  const current = time ? time.slice(0, 5) : null;

  // Keep the chosen quick pick in view (evening times sit at the end of the row).
  useEffect(() => {
    if (hint !== 'exact' || !current) return;
    const i = TIMES.indexOf(current);
    if (i < 0) return;
    const t = setTimeout(() => scroller.current?.scrollTo({ x: Math.max(0, i * 92 - 60), animated: false }), 0);
    return () => clearTimeout(t);
  }, [hint]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View>
      <Text variant="title3" style={{ marginBottom: spacing.md }}>
        Tidspunkt
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {hints.map((h) => (
          <Chip
            key={h.id}
            label={h.id === 'any' && !allowHints ? 'Hele dagen' : h.label}
            selected={hint === h.id}
            onPress={() => onChange(h.id, h.id === 'exact' ? current ?? '18:00' : null)}
          />
        ))}
      </View>
      {hint === 'exact' ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.md, gap: spacing.md }}>
          <ClockDial value={current ?? '18:00'} onChange={(t) => onChange('exact', t)} />
          <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {TIMES.map((t) => (
              <Chip key={t} label={t} selected={current === t} onPress={() => onChange('exact', t)} />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The exact time: hours and minutes, each with arrows (an hour, or five minutes, at a time) and
 * typeable — tap the number and write 18:45.
 */
function ClockDial({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const total = toMinutes(value);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const step = (minutes: number) => {
    haptics.light();
    onChange(fromMinutes(total + minutes));
  };
  // Minutes move to the next (or previous) five: 18:42 → 18:45 / 18:40.
  const minuteUp = () => step(5 - (m % 5));
  const minuteDown = () => step(-(m % 5 || 5));
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Unit label="Timer" value={h} max={23} onUp={() => step(60)} onDown={() => step(-60)} onSet={(v) => onChange(`${pad(v)}:${pad(m)}`)} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, marginBottom: 4 }} accessible={false}>
        :
      </Text>
      <Unit label="Minutter" value={m} max={59} onUp={minuteUp} onDown={minuteDown} onSet={(v) => onChange(`${pad(h)}:${pad(v)}`)} />
    </Card>
  );
}

function Unit({ label, value, max, onUp, onDown, onSet }: { label: string; value: number; max: number; onUp: () => void; onDown: () => void; onSet: (v: number) => void }) {
  const colors = useColors();
  // What is being typed. The value follows as you type (the number pad on iPhone has no «Ferdig»,
  // and «Lagre» can be tapped with the keyboard still up).
  const [draft, setDraft] = useState<string | null>(null);
  const type = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setDraft(digits);
    const n = parseInt(digits, 10);
    if (Number.isFinite(n)) onSet(Math.min(max, Math.max(0, n)));
  };
  const done = () => setDraft(null);
  const arrow = { width: 56, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <PressableScale onPress={onUp} accessibilityRole="button" accessibilityLabel={`${label} opp`} hitSlop={6} style={arrow}>
        <Icon name="chevron-up" size={20} />
      </PressableScale>
      <TextInput
        value={draft ?? pad(value)}
        onChangeText={type}
        onFocus={() => setDraft('')}
        onBlur={done}
        onSubmitEditing={done}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={2}
        placeholder={pad(value)}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={`${label}: ${value}`}
        style={{ width: 84, textAlign: 'center', fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, paddingVertical: 0, color: colors.text, fontVariant: ['tabular-nums'] }}
      />
      <PressableScale onPress={onDown} accessibilityRole="button" accessibilityLabel={`${label} ned`} hitSlop={6} style={arrow}>
        <Icon name="chevron-down" size={20} />
      </PressableScale>
      <Text variant="caption" color="textTertiary">
        {label}
      </Text>
    </View>
  );
}
