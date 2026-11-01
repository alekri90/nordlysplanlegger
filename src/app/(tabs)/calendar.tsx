import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CalendarLegend, MonthCalendar } from '@/components/calendar/MonthCalendar';
import { EventCard } from '@/components/event/EventCard';
import { DecidingSection, PastSection, splitEvents } from '@/components/event/EventSections';
import { Button, Card, Chip, Divider, EmptyState, ErrorState, EventListSkeleton, ListRow, PageTitle, Screen, SectionHeader, Text } from '@/components/ui';
import { useEvents } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { useBusyItems } from '@/lib/calendarBusy';
import { busyOnDay, conflictTime } from '@/lib/calendarConflicts';
import { addMonths, formatLong, monthDates, monthKey, today } from '@/lib/dates';
import { useCalendarSyncState } from '@/state/calendarSync';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, spacing, useColors } from '@/theme';

/**
 * Kalender — the overview: a month with your plans marked, then what's coming, what's still
 * finding a date, and what you've done (with «Gjør igjen»). Tap a day to see it, or plan something then.
 */
export default function CalendarTab() {
  const colors = useColors();
  const me = useMe();
  const events = useEvents();
  const resetDraft = useCreateDraft((s) => s.reset);
  const setDraft = useCreateDraft((s) => s.set);
  const t = today();
  const [month, setMonth] = useState(monthKey(t));
  const [day, setDay] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { upcoming, deciding, past } = useMemo(() => splitEvents(events.data ?? [], me?.id), [events.data, me?.id]);
  // Dated plans you're part of (not ones you said no to), by day.
  const byDay = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    for (const e of [...upcoming, ...past]) {
      if (!e.selectedDate) continue;
      map.set(e.selectedDate, [...(map.get(e.selectedDate) ?? []), e]);
    }
    return map;
  }, [upcoming, past]);
  const onDay = day ? (byDay.get(day) ?? []) : [];

  // The rest of the phone's calendar. Our own entries are already shown as plans.
  const showsBusy = useCalendarSyncState((s) => s.conflicts);
  const eveningOnly = useCalendarSyncState((s) => s.eveningOnly);
  const setEveningOnly = useCalendarSyncState((s) => s.setEveningOnly);
  const days = monthDates(month);
  const allBusy = useBusyItems(days[0], days[days.length - 1]);
  const busy = useMemo(() => {
    const ours = new Set((events.data ?? []).map((e) => e.id));
    return allBusy.filter((i) => !i.eventId || !ours.has(i.eventId));
  }, [allBusy, events.data]);
  const busyDay = day ? busyOnDay(busy, day, eveningOnly) : [];
  const hidden = day ? busyOnDay(busy, day).length - busyDay.length : 0;

  const planOn = (date: string) => {
    resetDraft();
    setDraft({ dateMode: 'fixed', fixedDate: date, datePreset: true });
    router.push('/create');
  };

  const refresh = async () => {
    setRefreshing(true);
    await events.refetch();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageTitle title="Kalender" style={{ marginTop: spacing.lg }} />

        <MonthCalendar
          month={month}
          getState={(d) => (d === day ? 'selected' : byDay.has(d) ? 'event' : 'idle')}
          onPressDay={(d) => setDay((cur) => (cur === d ? null : d))}
          onPrev={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
          dayHint="Trykk for å se dagen"
          isBusy={(d) => busyOnDay(busy, d, eveningOnly).length > 0}
        />
        {showsBusy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <CalendarLegend items={[{ state: 'busy', label: 'Noe i kalenderen' }]} style={{ marginTop: 0 }} />
            <Chip label="Etter kl. 16" selected={eveningOnly} onPress={() => setEveningOnly(!eveningOnly)} />
          </View>
        ) : null}

        {events.isError ? (
          <ErrorState onRetry={() => events.refetch()} />
        ) : events.isLoading ? (
          <View style={{ marginTop: spacing.xxl }}>
            <EventListSkeleton count={2} />
          </View>
        ) : day ? (
          <Animated.View key={day} entering={FadeIn.duration(200)} style={{ marginTop: spacing.xxl }}>
            <SectionHeader title={formatLong(day)} action="Lukk" onAction={() => setDay(null)} />
            {onDay.length ? (
              <View style={{ gap: spacing.md }}>
                {onDay.map((e) => (
                  <EventCard key={e.id} event={e} meId={me?.id} onPress={() => router.push(`/event/${e.id}`)} />
                ))}
              </View>
            ) : !busyDay.length ? (
              <Card muted>
                <Text variant="body" color="textSecondary">
                  Ingenting planlagt denne dagen.
                </Text>
              </Card>
            ) : null}
            {busyDay.length ? (
              <View style={{ marginTop: onDay.length ? spacing.lg : 0 }}>
                <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.sm }}>
                  I kalenderen
                </Text>
                <Card style={{ paddingVertical: spacing.xs }}>
                  {busyDay.map((b, i) => (
                    <View key={`${b.title}${b.start.getTime()}${b.calendar}`}>
                      {i ? <Divider /> : null}
                      <ListRow title={b.title} subtitle={[conflictTime(b, day!), b.calendar].filter(Boolean).join(' · ')} />
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
            {hidden ? (
              <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
                {hidden === 1 ? '1 ting' : `${hidden} ting`} tidligere på dagen er skjult
              </Text>
            ) : null}
            {day >= t ? <Button title="Planlegg noe denne dagen" icon="plus" variant="secondary" onPress={() => planOn(day)} style={{ marginTop: spacing.md }} /> : null}
          </Animated.View>
        ) : (
          <>
            <View style={{ marginTop: spacing.xxl }}>
              <SectionHeader title="Kommende" />
              {upcoming.length ? (
                <View style={{ gap: spacing.md }}>
                  {upcoming.map((e, i) => (
                    <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                      <EventCard event={e} meId={me?.id} onPress={() => router.push(`/event/${e.id}`)} />
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <Card muted padded={false}>
                  <EmptyState icon="calendar" title="Ingen datoer satt ennå" body="Når en dato er låst, kommer arrangementet her og i kalenderen over." />
                </Card>
              )}
            </View>
            <DecidingSection events={deciding} meId={me?.id} />
            <PastSection events={past} meId={me?.id} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
