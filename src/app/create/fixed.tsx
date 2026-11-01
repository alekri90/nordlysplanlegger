import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { StepHeader } from '@/components/create/StepHeader';
import { RepeatEditor, RepeatSection } from '@/components/create/RepeatEditor';
import { PlaceDetails } from '@/components/create/PlaceDetails';
import { TimePicker } from '@/components/create/TimePicker';
import { ConflictNote } from '@/components/event/CalendarConflict';
import { BottomBar, Button, Card, Icon, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useBusyItems } from '@/lib/calendarBusy';
import { conflictsFor } from '@/lib/calendarConflicts';
import { addMonths, formatLong, monthDates, monthKey, today } from '@/lib/dates';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

/** Step 3b — the date is already known. One day, one time. */
export default function CreateFixed() {
  const draft = useCreateDraft();
  const t = today();
  const [month, setMonth] = useState(draft.fixedDate ? monthKey(draft.fixedDate) : monthKey(t));

  const days = monthDates(draft.datePreset && draft.fixedDate ? monthKey(draft.fixedDate) : month);
  const busy = useBusyItems(days[0], days[days.length - 1]);
  const moment = (date: string) => ({ date, startTime: draft.timeHint === 'exact' ? draft.startTime : null });
  const isBusy = (d: string) => d > t && conflictsFor(busy, moment(d)).length > 0;

  const getState = (d: string): DayState => (d === draft.fixedDate ? 'selected' : d > t ? 'idle' : 'disabled');

  return (
    <Screen>
      <StepHeader step={2} />
      <ScreenScroll bottomInset={140}>
        {draft.datePreset && draft.fixedDate ? (
          <>
            <PageTitle title="Når på dagen?" />
            {/* The day is already chosen in the calendar; it can still be changed. */}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="calendar" size={18} color="primary" />
              <Text variant="headline" style={{ flex: 1 }}>
                {formatLong(draft.fixedDate)}
              </Text>
              <PressableScale onPress={() => draft.set({ datePreset: false })} hitSlop={8} accessibilityRole="button">
                <Text variant="footnote" color="primary">
                  Bytt dag
                </Text>
              </PressableScale>
            </Card>
          </>
        ) : (
          <>
            <PageTitle title="Hvilken dag?" />
            <MonthCalendar
              month={month}
              getState={getState}
              onPressDay={(d) => draft.set({ fixedDate: d })}
              isBusy={isBusy}
              onPrev={month > monthKey(t) ? () => setMonth(addMonths(month, -1)) : undefined}
              onNext={() => setMonth(addMonths(month, 1))}
              dayHint="Trykk for å velge dagen"
            />
          </>
        )}
        <View style={{ marginTop: spacing.xxl }}>
          <TimePicker
            hint={draft.timeHint === 'exact' ? 'exact' : 'any'}
            time={draft.startTime}
            allowHints={false}
            onChange={(timeHint, startTime) => draft.set({ timeHint, startTime })}
          />
        </View>
        <ConflictNote busy={busy} when={draft.fixedDate ? moment(draft.fixedDate) : null} style={{ marginTop: spacing.lg }} />

        <PlaceDetails style={{ marginTop: spacing.xl }} />

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
