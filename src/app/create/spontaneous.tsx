import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PlaceDetails } from '@/components/create/PlaceDetails';
import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Chip, PageTitle, Screen, ScreenScroll, Text } from '@/components/ui';
import { addDays, today } from '@/lib/dates';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today: the next half hours from now (up to 23:30). Tomorrow: the usual hours. */
function timesFor(day: 'today' | 'tomorrow', now = new Date()): string[] {
  if (day === 'tomorrow') return ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const out: string[] = [];
  const start = new Date(now.getTime() + 30 * 60_000);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  for (let t = start; t.getDate() === now.getDate() && out.length < 12; t = new Date(t.getTime() + 30 * 60_000)) out.push(`${pad(t.getHours())}:${pad(t.getMinutes())}`);
  return out;
}

/**
 * «Spontant» — today or tomorrow, at a set time: «Vi drar i Dyreparken kl. 14 – hvem er gira?».
 * The invitation goes out as a time-sensitive notification.
 */
export default function CreateSpontaneous() {
  const draft = useCreateDraft();
  const t = today();
  const late = timesFor('today').length === 0;
  const [day, setDay] = useState<'today' | 'tomorrow'>(draft.fixedDate === addDays(t, 1) || late ? 'tomorrow' : 'today');
  const times = useMemo(() => timesFor(day), [day]);
  const time = draft.startTime && times.includes(draft.startTime) ? draft.startTime : null;

  const choose = (d: 'today' | 'tomorrow', at: string | null) => {
    setDay(d);
    draft.set({ dateMode: 'fixed', spontaneous: true, fixedDate: d === 'today' ? t : addDays(t, 1), timeHint: 'exact', startTime: at });
  };

  return (
    <Screen>
      <StepHeader step={2} />
      <ScreenScroll>
        <PageTitle title="Når drar dere?" subtitle="Velg et tidspunkt – så spør vi hvem som er gira." />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {!late ? <Chip label="I dag" selected={day === 'today'} onPress={() => choose('today', null)} /> : null}
          <Chip label="I morgen" selected={day === 'tomorrow'} onPress={() => choose('tomorrow', null)} />
        </View>
        <Text variant="subhead" color="textSecondary" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Klokken
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {times.map((at) => (
            <Chip key={at} label={at} selected={time === at} onPress={() => choose(day, at)} />
          ))}
        </View>
        <PlaceDetails style={{ marginTop: spacing.xl }} />
      </ScreenScroll>
      <BottomBar>
        <Button title={time ? `Hvem er gira? · ${day === 'today' ? 'i dag' : 'i morgen'} ${time}` : 'Velg et tidspunkt'} disabled={!time} onPress={() => router.push('/create/who')} />
      </BottomBar>
    </Screen>
  );
}
