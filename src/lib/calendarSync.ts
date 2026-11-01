import * as Calendar from 'expo-calendar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { repo } from '@/data';
import { keys, queryClient, useEvents } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { useCalendarSyncState } from '@/state/calendarSync';
import { calendarEntries, calendarFingerprint, eventIdFromNotes, planCalendarSync, type CalendarEntry } from './calendarPlan';
import { env, isDemoMode } from './config';
import { addDays, parseISODate, today } from './dates';

/** On web there's no calendar to write to; the demo shows the screen with made-up calendars. */
export const calendarSyncSupported = Platform.OS !== 'web' || isDemoMode;

export type CalendarAccess = 'granted' | 'denied' | 'undetermined';
export interface CalendarChoice {
  id: string;
  title: string;
  source: string;
}

const DEMO_CALENDARS: CalendarChoice[] = [
  { id: 'demo-privat', title: 'Privat', source: 'iCloud' },
  { id: 'demo-familie', title: 'Familie', source: 'iCloud' },
  { id: 'demo-jobb', title: 'Jobb', source: 'Outlook' },
];

const toAccess = (r: { granted: boolean; canAskAgain: boolean }): CalendarAccess => (r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied');

export async function calendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS === 'web') return 'granted';
  return toAccess(await Calendar.getCalendarPermissions());
}

export async function requestCalendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS === 'web') return 'granted';
  return toAccess(await Calendar.requestCalendarPermissions());
}

/** Those you can write to: not holidays, birthdays or calendars you only subscribe to. */
export async function listWritableCalendars(): Promise<CalendarChoice[]> {
  if (Platform.OS === 'web') return DEMO_CALENDARS;
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars.filter((c) => c.allowsModifications).map((c) => ({ id: c.id, title: c.title ?? 'Kalender', source: c.source?.name ?? '' }));
}

function eventDetails(e: CalendarEntry) {
  const allDay = !e.startTime;
  const android = Platform.OS === 'android';
  const start = parseISODate(e.date);
  let end: Date;
  if (e.startTime) {
    const [h, m] = e.startTime.split(':').map(Number);
    start.setHours(h, m, 0, 0);
    end = new Date(start.getTime() + 180 * 60_000);
  } else if (android) {
    // Android stores all-day events as midnight UTC.
    start.setTime(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    end = new Date(start.getTime() + 24 * 3_600_000);
  } else {
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getTime() + 24 * 3_600_000 - 60_000);
  }
  return {
    title: e.title,
    startDate: start,
    endDate: end,
    allDay,
    location: e.location ?? '',
    notes: e.notes,
    url: e.link,
    ...(allDay && android ? { timeZone: 'UTC' } : null),
  };
}

/** Our own entries from today and on, by arrangement. What has passed is left alone. */
async function findOwnEntries(calendar: Calendar.ExpoCalendar, userId: string) {
  const from = parseISODate(today());
  const to = parseISODate(addDays(today(), 730));
  const found: Record<string, Calendar.ExpoCalendarEvent> = {};
  for (const event of await calendar.listEvents(from, to)) {
    const eventId = eventIdFromNotes(event.notes, userId) ?? eventIdFromNotes(event.url, userId);
    if (eventId) found[eventId] = event;
  }
  return found;
}

// One at a time: two runs side by side would add everything twice.
let queue: Promise<unknown> = Promise.resolve();
const inTurn = <T,>(run: () => Promise<T>) => {
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
};

/** Still yours? The list stops at the newest events, so being absent from it isn't proof. */
async function stillWanted(eventId: string, userId: string) {
  try {
    return calendarEntries([await repo.getEvent(eventId)], userId, today(), env.webUrl).length > 0;
  } catch {
    return false;
  }
}

function syncCalendar(events: PlannerEvent[], userId: string, calendarId: string) {
  return inTurn(async () => {
    const state = useCalendarSyncState.getState();
    if (state.calendarId !== calendarId || state.userId !== userId) return;
    const calendar = await Calendar.ExpoCalendar.get(calendarId);
    const found = await findOwnEntries(calendar, userId);
    const entries = calendarEntries(events, userId, today(), env.webUrl);
    const plan = planCalendarSync(entries, state.synced, found);

    // Saved after each step, so an interrupted run carries on instead of starting over.
    const remember = (entry: CalendarEntry) => state.setSynced((s) => ({ ...s, [entry.eventId]: calendarFingerprint(entry) }));
    const drop = (eventId: string) =>
      state.setSynced((s) => {
        const { [eventId]: _gone, ...rest } = s;
        return rest;
      });

    for (const entry of plan.create) {
      await calendar.createEvent(eventDetails(entry));
      remember(entry);
    }
    for (const { entry, existing } of plan.update) {
      await existing.update(eventDetails(entry));
      remember(entry);
    }
    for (const { eventId, existing } of plan.remove) {
      if (await stillWanted(eventId, userId)) continue;
      await existing.delete();
      drop(eventId);
    }
    plan.forget.forEach(drop);
  });
}

/** Takes everything this person's sync put there, from today and on, back out. */
export function removeSyncedEntries(userId: string, calendarId: string) {
  if (Platform.OS === 'web') return Promise.resolve();
  return inTurn(async () => {
    const calendar = await Calendar.ExpoCalendar.get(calendarId);
    for (const event of Object.values(await findOwnEntries(calendar, userId))) await event.delete();
  });
}

/**
 * Keeps the chosen calendar in step with the arrangements. It runs while the app is open, so
 * something cancelled while it's closed goes from the calendar the next time it's opened.
 */
export function useCalendarSync(userId: string | null) {
  const events = useEvents();
  const load = useCalendarSyncState((s) => s.load);
  const calendarId = useCalendarSyncState((s) => (s.userId === userId ? s.calendarId : null));

  useEffect(() => {
    if (calendarSyncSupported) load(userId);
  }, [load, userId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !calendarId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') queryClient.invalidateQueries({ queryKey: keys.events });
    });
    return () => sub.remove();
  }, [calendarId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !calendarId || !events.isSuccess) return;
    calendarAccess()
      .then((access) => (access === 'granted' ? syncCalendar(events.data, userId, calendarId) : undefined))
      // Back at the next change: a calendar that's gone shows up on the settings screen.
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.dataUpdatedAt, userId, calendarId]);
}
