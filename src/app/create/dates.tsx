import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CalendarLegend, MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { PlansNote, usePlannedDays, withoutOurs } from '@/components/calendar/usePlannedDays';
import { ACTIVITY_STEPS, StepHeader } from '@/components/create/StepHeader';
import { RepeatEditor, RepeatSection } from '@/components/create/RepeatEditor';
import { PlaceDetails } from '@/components/create/PlaceDetails';
import { TimePicker } from '@/components/create/TimePicker';
import { ConflictNote } from '@/components/event/CalendarConflict';
import { BottomBar, Button, Chip, PageTitle, Screen, ScreenScroll, Segmented, Text, useToast } from '@/components/ui';
import { useStartPoll } from '@/data/hooks';
import { activityType, weekdaysIn } from '@/lib/activities';
import { useBusyItems } from '@/lib/calendarBusy';
import { conflictsFor } from '@/lib/calendarConflicts';
import { addMonths, hasWholeWeekday, monthDates, monthKey, monthName, today, toggleWeekday, weekday } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { applyQuickPick, periodDates, periodMonths, QUICK_PICKS, suggestedMonth, type Period, type QuickPick } from '@/lib/period';
import { useCreateDraft } from '@/state/createDraft';
import { gutter, spacing } from '@/theme';

const WEEKDAY_PLURALS = ['Mandager', 'Tirsdager', 'Onsdager', 'Torsdager', 'Fredager', 'Lørdager', 'Søndager'];

/**
 * Step 3 — which days could work? Pick a period, tap days (or use a quick pick), choose a time.
 * Also used to "find the next date" for a group, pre-filled with the group's usual weekdays.
 */
export default function CreateDates() {
  const toast = useToast();
  const draft = useCreateDraft();
  const type = activityType(draft.activityType);
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

  // The same insight as Kalender: what you have planned in the app (a ring) and the phone's calendar (a dot).
  const planned = usePlannedDays([draft.existingEventId]);
  const allBusy = useBusyItems(months.length ? `${months[0]}-01` : null, months.length ? monthDates(months[months.length - 1]).at(-1) : null);
  const busy = useMemo(() => withoutOurs(allBusy, planned), [allBusy, planned]);
  const hasPlan = (date: string) => selectable.has(date) && planned.has(date);
  const anyPlan = months.some((m) => monthDates(m).some(hasPlan));
  const [lastDay, setLastDay] = useState<string | null>(null);
  const moment = (date: string) => ({ date, startTime: draft.startTime, timeHint: draft.timeHint, eventId: draft.existingEventId });
  const isBusy = (date: string) => selectable.has(date) && conflictsFor(busy, moment(date)).length > 0;

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
  const visibleDates = [...selectable].filter((d) => months.some((m) => d.startsWith(m)));

  // «Aufguss tirsdager og torsdager»: those weekdays are picked for the period to begin with.
  const named = useRef(false);
  useEffect(() => {
    if (named.current || !type || draft.optionDates.length) return;
    named.current = true;
    const wds = weekdaysIn(draft.title);
    if (wds.length) draft.set({ optionDates: wds.reduce((acc, wd) => toggleWeekday(acc, wd, visibleDates), [] as string[]) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
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
    router.push(type ? '/create/role' : '/create/who');
  };

  return (
    <Screen>
      <StepHeader step={draft.source === 'event' ? 0 : 2} total={draft.source === 'event' ? 2 : type ? ACTIVITY_STEPS : draft.clearance ? 5 : 4} />
      <ScreenScroll bottomInset={140}>
        <PageTitle
          title={type ? 'Hvilke datoer vil du forespørre?' : draft.clearance ? 'Hvilke dager vil du foreslå?' : 'Hvilke dager passer?'}
          subtitle={type ? (draft.activityMode === 'each' ? `Hver dato blir et eget arrangement, foreløpig til ${type.role.lower} har sagt ja.` : `Alternative datoer for ett arrangement. ${type.role.label} svarer på hver av dem.`) : draft.clearance ? 'Velg alle dagene du vil sjekke. Den du spør, krysser av hvilke som passer.' : draft.source === 'group' ? `Vi har foreslått dager for ${draft.title}. Juster om du vil.` : 'Velg aktuelle dager, så får gjestene markere hva som ikke passer.'}
        />

        {type ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Segmented<'each' | 'poll'>
              value={draft.activityMode}
              onChange={(activityMode) => draft.set({ activityMode })}
              items={[
                { id: 'each', label: 'Hver dato for seg' },
                { id: 'poll', label: 'Alternativer for ett' },
              ]}
            />
          </View>
        ) : null}

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
                  setLastDay(d);
                  draft.toggleDate(d);
                }}
                isBusy={isBusy}
                hasPlan={hasPlan}
                onPrev={draft.period.kind === 'custom' && customMonth > monthKey(today()) ? () => setCustomMonth(addMonths(customMonth, -1)) : undefined}
                onNext={draft.period.kind === 'custom' ? () => setCustomMonth(addMonths(customMonth, 1)) : undefined}
                dayHint="Trykk for å legge til eller fjerne som mulig dag"
              />
            </Animated.View>
          ))}
        </View>
        <CalendarLegend
          items={[
            { state: 'candidate', label: 'Mulig dag' },
            ...(anyPlan ? [{ state: 'plan' as const, label: 'Har noe planlagt' }] : []),
            ...(busy.length ? [{ state: 'busy' as const, label: 'Noe i kalenderen' }] : []),
          ]}
        />
        <PlansNote plans={lastDay && chosen.has(lastDay) ? planned.get(lastDay) : undefined} date={lastDay} showDay style={{ marginTop: spacing.md }} />
        <ConflictNote busy={busy} when={lastDay && chosen.has(lastDay) ? moment(lastDay) : null} showDay style={{ marginTop: spacing.sm }} />

        <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
          Hurtigvalg
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {QUICK_PICKS.map((q) => (
            <Chip key={q.id} label={q.label} selected={activePick === q.id} onPress={() => quickPick(q.id)} />
          ))}
        </View>
        <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Alle i perioden
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {WEEKDAY_PLURALS.map((label, wd) => (
            <Chip
              key={label}
              label={label}
              selected={hasWholeWeekday(draft.optionDates, wd, visibleDates)}
              onPress={() => {
                haptics.light();
                setActivePick(null);
                draft.set({ optionDates: toggleWeekday(draft.optionDates, wd, visibleDates) });
              }}
              accessibilityHint={`Velger eller fjerner alle ${label.toLowerCase()} i perioden`}
            />
          ))}
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <TimePicker hint={draft.timeHint} time={draft.startTime} onChange={(timeHint, startTime) => draft.set({ timeHint, startTime })} />
        </View>

        {!draft.existingEventId ? <PlaceDetails style={{ marginTop: spacing.xl }} detailsOnly={!!type} /> : null}

        {!draft.existingEventId && !draft.clearance && !type ? (
          <RepeatSection
            enabled={draft.repeat.enabled}
            onToggle={(enabled) =>
              draft.set({
                repeat: {
                  ...draft.repeat,
                  enabled,
                  dateMode: 'poll_each',
                  unit: draft.repeat.enabled ? draft.repeat.unit : 'month',
                  // Suggest the weekdays they picked ("Torsdager").
                  weekdays: draft.repeat.weekdays.length ? draft.repeat.weekdays : [...new Set(draft.optionDates.map(weekday))].sort(),
                },
              })
            }
          >
            <RepeatEditor value={draft.repeat} poll onChange={(patch) => draft.set({ repeat: { ...draft.repeat, ...patch } })} />
          </RepeatSection>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          title={count === 0 ? 'Velg minst én dag' : type ? `Fortsett · ${count} ${count === 1 ? 'dato' : draft.activityMode === 'each' ? 'arrangementer' : 'datoer'}` : draft.existingEventId ? `Send til gjengen · ${count} ${count === 1 ? 'dag' : 'dager'}` : `Fortsett · ${count} ${count === 1 ? 'dag' : 'dager'}`}
          disabled={count === 0}
          loading={startPoll.isPending}
          onPress={next}
        />
      </BottomBar>
    </Screen>
  );
}
