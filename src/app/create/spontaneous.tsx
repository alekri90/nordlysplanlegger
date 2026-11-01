import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PlaceDetails } from '@/components/create/PlaceDetails';
import { StepHeader } from '@/components/create/StepHeader';
import { CalendarConflict } from '@/components/event/CalendarConflict';
import { BottomBar, Button, Chip, PageTitle, Screen, ScreenScroll, Text } from '@/components/ui';
import { addDays, today } from '@/lib/dates';
import { spontaneousTimes, timesByPartOfDay } from '@/lib/spontaneous';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

/**
 * «Spontant» — today or tomorrow, at a set time: «Vi drar i Dyreparken kl. 14 – hvem er gira?».
 * The invitation goes out as a time-sensitive notification.
 */
export default function CreateSpontaneous() {
  const draft = useCreateDraft();
  const t = today();
  const late = spontaneousTimes('today').length === 0;
  const [day, setDay] = useState<'today' | 'tomorrow'>(draft.fixedDate === addDays(t, 1) || late ? 'tomorrow' : 'today');
  const times = useMemo(() => spontaneousTimes(day), [day]);
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
        {timesByPartOfDay(times).map((part) => (
          <View key={part.label}>
            <Text variant="subhead" color="textSecondary" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {part.label}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {part.times.map((at) => (
                <Chip key={at} label={at} selected={time === at} onPress={() => choose(day, at)} />
              ))}
            </View>
          </View>
        ))}
        <PlaceDetails style={{ marginTop: spacing.xl }} />
      </ScreenScroll>
      <BottomBar>
        <CalendarConflict when={time ? { date: day === 'today' ? t : addDays(t, 1), startTime: time, timeHint: 'exact' } : null} />
        <Button title={time ? `Hvem er gira? · ${day === 'today' ? 'i dag' : 'i morgen'} ${time}` : 'Velg et tidspunkt'} disabled={!time} onPress={() => router.push('/create/who')} />
      </BottomBar>
    </Screen>
  );
}
