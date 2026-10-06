import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip, Text } from '@/components/ui';
import type { TimeHint } from '@/data/types';
import { spacing } from '@/theme';

const HINTS: { id: TimeHint; label: string }[] = [
  { id: 'evening', label: 'Etter kl. 18' },
  { id: 'daytime', label: 'På dagtid' },
  { id: 'any', label: 'Når som helst' },
  { id: 'exact', label: 'Velg klokkeslett' },
];

const TIMES = ['10:00', '12:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

/** Time preference in one row. Exact times appear only when asked for. */
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

  // Keep the chosen time in view (evening times sit at the end of the row).
  useEffect(() => {
    if (hint !== 'exact' || !time) return;
    const i = TIMES.indexOf(time);
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
            onPress={() => onChange(h.id, h.id === 'exact' ? time ?? '18:00' : null)}
          />
        ))}
      </View>
      {hint === 'exact' ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}>
            {TIMES.map((t) => (
              <Chip key={t} label={`Kl. ${t}`} selected={time === t} onPress={() => onChange('exact', t)} />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}
