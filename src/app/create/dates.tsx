import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CalendarLegend, MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { StepHeader } from '@/components/create/StepHeader';
import { TimePicker } from '@/components/create/TimePicker';
import { BottomBar, Button, Chip, PageTitle, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useStartPoll } from '@/data/hooks';
import { addMonths, monthKey, monthName, today } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { applyQuickPick, periodDates, periodMonths, QUICK_PICKS, suggestedMonth, type Period, type QuickPick } from '@/lib/period';
import { useCreateDraft } from '@/state/createDraft';
import { gutter, spacing } from '@/theme';

/**
 * Step 3 — which days could work? Pick a period, tap days (or use a quick pick), choose a time.
 * Also used to "find the next date" for a group, pre-filled with the group's usual weekdays.
 */
export default function CreateDates() {
  const toast = useToast();
  const draft = useCreateDraft();
  const startPoll = useStartPoll(draft.existingEventId ?? '');
  const [customMonth, setCustomMonth] = useState(suggestedMonth());

  const first = suggestedMonth();
  const second = addMonths(first, 1);
  const periods: { label: string; period: Period }[] = [
    { label: monthName(first), period: { kind: 'month', month: first } },
    { label: monthName(second), period: { kind: 'month', month: second } },
    { label: 'Neste 30 dager', period: { kind: 'next30' } },
    { label: 'Velg selv', period: { kind: 'custom' } },
  ];

  const selectable = useMemo(() => new Set(periodDates(draft.period)), [draft.period]);
  const months = draft.period.kind === 'custom' ? [customMonth] : periodMonths(draft.period);
  const chosen = useMemo(() => new Set(draft.optionDates), [draft.optionDates]);
  const [activePick, setActivePick] = useState<QuickPick | null>(null);

  const getState = (date: string): DayState => (chosen.has(date) ? 'candidate' : selectable.has(date) ? 'idle' : 'disabled');

  const selectPeriod = (p: Period) => {
    draft.set({ period: p, optionDates: draft.optionDates.filter((d) => periodDates(p).includes(d)) });
    setActivePick(null);
  };

  const quickPick = (pick: QuickPick) => {
    haptics.light();
    if (activePick === pick) {
      setActivePick(null);
      draft.set({ optionDates: [] });
      return;
    }
    const visible = [...selectable].filter((d) => months.some((m) => d.startsWith(m)));
    draft.set({ optionDates: applyQuickPick(pick, visible) });
    setActivePick(pick);
  };

  const count = draft.optionDates.length;
  const isPeriodSelected = (p: Period) =>
    p.kind === draft.period.kind && (p.kind !== 'month' || (draft.period.kind === 'month' && draft.period.month === p.month));

  const next = async () => {
    if (draft.existingEventId) {
      try {
        await startPoll.mutateAsync(draft.optionDates);
        haptics.success();
        router.dismissAll();
        router.push(`/event/${draft.existingEventId}`);
        toast({ message: 'Gjengen kan nå svare', tone: 'success' });
      } catch {
        toast({ message: 'Noe gikk galt. Prøv igjen.', tone: 'error' });
      }
      return;
    }
    router.push('/create/who');
  };

  return (
    <Screen>
      <StepHeader step={draft.source === 'new' ? 2 : 0} total={draft.source === 'new' ? 4 : 2} />
      <ScreenScroll bottomInset={140}>
        <PageTitle
          title="Hvilke dager passer?"
          subtitle={draft.source === 'group' ? `Vi har foreslått dager for ${draft.title}. Juster om du vil.` : 'Velg aktuelle dager, så får gjestene markere hva som ikke passer.'}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: gutter }} style={{ marginHorizontal: -gutter }}>
          {periods.map((p) => (
            <Chip key={p.label} label={p.label} selected={isPeriodSelected(p.period)} onPress={() => selectPeriod(p.period)} />
          ))}
        </ScrollView>

        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          {months.map((m) => (
            <Animated.View key={m} entering={FadeIn.duration(220)}>
              <MonthCalendar
                month={m}
                getState={getState}
                onPressDay={(d) => {
                  setActivePick(null);
                  draft.toggleDate(d);
                }}
                onPrev={draft.period.kind === 'custom' && customMonth > monthKey(today()) ? () => setCustomMonth(addMonths(customMonth, -1)) : undefined}
                onNext={draft.period.kind === 'custom' ? () => setCustomMonth(addMonths(customMonth, 1)) : undefined}
                dayHint="Trykk for å legge til eller fjerne som mulig dag"
              />
            </Animated.View>
          ))}
        </View>
        <CalendarLegend items={[{ state: 'candidate', label: 'Mulig dag' }]} />

        <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
          Hurtigvalg
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {QUICK_PICKS.map((q) => (
            <Chip key={q.id} label={q.label} selected={activePick === q.id} onPress={() => quickPick(q.id)} />
          ))}
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <TimePicker hint={draft.timeHint} time={draft.startTime} onChange={(timeHint, startTime) => draft.set({ timeHint, startTime })} />
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          title={count === 0 ? 'Velg minst én dag' : draft.existingEventId ? `Send til gjengen · ${count} ${count === 1 ? 'dag' : 'dager'}` : `Fortsett · ${count} ${count === 1 ? 'dag' : 'dager'}`}
          disabled={count === 0}
          loading={startPoll.isPending}
          onPress={next}
        />
      </BottomBar>
    </Screen>
  );
}
