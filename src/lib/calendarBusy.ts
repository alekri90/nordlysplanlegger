import { useQuery } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { useCalendarSyncState } from '@/state/calendarSync';
import { toBusyItems, type BusyItem, type RawCalendarEvent } from './calendarConflicts';
import { calendarAccess, calendarSyncSupported, listAllCalendars } from './calendarSync';
import { addDays, dateRange, parseISODate } from './dates';

const NOTHING: BusyItem[] = [];

const DEMO_DAYS = [
  { every: 3, title: 'Jobbmøte', calendarId: 'demo-jobb', from: '10:00', to: '11:00' },
  { every: 7, title: 'Tannlege', calendarId: 'demo-privat', from: '18:00', to: '19:00' },
  { every: 5, title: 'Foreldremøte', calendarId: 'demo-familie', from: '18:30', to: '20:00' },
  { every: 11, title: 'Kundemiddag', calendarId: 'demo-jobb', from: '19:00', to: '22:00' },
];

/** Made-up calendar for the demo, so the warnings can be seen on web. */
function demoEvents(from: string, to: string): RawCalendarEvent[] {
  return dateRange(from, to).flatMap((date) =>
    DEMO_DAYS.filter((d) => Number(date.slice(8)) % d.every === 0).map((d) => ({
      title: d.title,
      calendarId: d.calendarId,
      startDate: `${date}T${d.from}:00`,
      endDate: `${date}T${d.to}:00`,
    })),
  );
}

async function readBusy(from: string, to: string, skipped: string[]) {
  const calendars = (await listAllCalendars()).filter((c) => !skipped.includes(c.id));
  const titles = Object.fromEntries(calendars.map((c) => [c.id, c.title]));
  if (Platform.OS === 'web') return toBusyItems(demoEvents(from, to).filter((e) => e.calendarId! in titles), titles);
  if (!calendars.length || (await calendarAccess()) !== 'granted') return NOTHING;
  // A day wider on each side: something can run in from the night before.
  const events = await Calendar.listEvents(calendars.map((c) => c.id), parseISODate(addDays(from, -1)), parseISODate(addDays(to, 2)));
  return toBusyItems(events, titles);
}

/**
 * What's in the calendar between two dates, for «Vis kollisjoner». Read on this phone, kept in
 * memory only, and empty for anyone who hasn't turned it on.
 */
export function useBusyItems(from?: string | null, to: string | null | undefined = from) {
  const on = useCalendarSyncState((s) => s.conflicts);
  const skipped = useCalendarSyncState((s) => s.skippedCalendars);
  const userId = useCalendarSyncState((s) => s.userId);
  const enabled = on && calendarSyncSupported && !!from && !!to;
  const busy = useQuery({
    queryKey: ['calendar-busy', userId, from, to, skipped],
    queryFn: () => readBusy(from!, to!, skipped),
    enabled,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
  });
  return enabled ? (busy.data ?? NOTHING) : NOTHING;
}
