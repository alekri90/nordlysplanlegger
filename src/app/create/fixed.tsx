import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { StepHeader } from '@/components/create/StepHeader';
import { RepeatEditor, RepeatSection } from '@/components/create/RepeatEditor';
import { TimePicker } from '@/components/create/TimePicker';
import { BottomBar, Button, PageTitle, Screen, ScreenScroll } from '@/components/ui';
import { addMonths, formatLong, monthKey, today } from '@/lib/dates';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

/** Step 3b — the date is already known. One day, one time. */
export default function CreateFixed() {
  const draft = useCreateDraft();
  const t = today();
  const [month, setMonth] = useState(draft.fixedDate ? monthKey(draft.fixedDate) : monthKey(t));

  const getState = (d: string): DayState => (d === draft.fixedDate ? 'selected' : d > t ? 'idle' : 'disabled');

  return (
    <Screen>
      <StepHeader step={2} />
      <ScreenScroll bottomInset={140}>
        <PageTitle title="Hvilken dag?" />
        <MonthCalendar
          month={month}
          getState={getState}
          onPressDay={(d) => draft.set({ fixedDate: d })}
          onPrev={month > monthKey(t) ? () => setMonth(addMonths(month, -1)) : undefined}
          onNext={() => setMonth(addMonths(month, 1))}
          dayHint="Trykk for å velge dagen"
        />
        <View style={{ marginTop: spacing.xxl }}>
          <TimePicker
            hint={draft.timeHint === 'exact' ? 'exact' : 'any'}
            time={draft.startTime}
            allowHints={false}
            onChange={(timeHint, startTime) => draft.set({ timeHint, startTime })}
          />
        </View>

        <RepeatSection enabled={draft.repeat.enabled} onToggle={(enabled) => draft.set({ repeat: { ...draft.repeat, enabled, dateMode: 'fixed' } })}>
          <RepeatEditor value={draft.repeat} poll={false} firstDate={draft.fixedDate} onChange={(patch) => draft.set({ repeat: { ...draft.repeat, ...patch } })} />
        </RepeatSection>
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          title={draft.fixedDate ? `Fortsett · ${formatLong(draft.fixedDate)}` : 'Velg en dag'}
          disabled={!draft.fixedDate}
          onPress={() => router.push('/create/who')}
        />
      </BottomBar>
    </Screen>
  );
}
