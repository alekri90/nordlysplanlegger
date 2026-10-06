import * as Calendar from 'expo-calendar';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { parseISODate } from './dates';

export interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  durationMinutes?: number;
  location?: string | null;
  notes?: string | null;
  url?: string | null;
}

function toRange(e: CalendarEventInput) {
  const start = parseISODate(e.date);
  const allDay = !e.startTime;
  if (e.startTime) {
    const [h, m] = e.startTime.split(':').map(Number);
    start.setHours(h, m, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }
  const end = new Date(start.getTime() + (allDay ? 24 * 60 : e.durationMinutes ?? 180) * 60_000);
  return { start, end, allDay };
}

/**
 * Opens the system "new event" form, pre-filled. The user stays in control and we only need
 * write access — we never read the user's calendar. On web we download an .ics file instead.
 */
export async function addToCalendar(e: CalendarEventInput): Promise<'saved' | 'canceled' | 'downloaded'> {
  const { start, end, allDay } = toRange(e);

  if (Platform.OS === 'web') {
    downloadIcs(e, start, end, allDay);
    return 'downloaded';
  }

  const details = {
    title: e.title,
    startDate: start,
    endDate: end,
    allDay,
    location: e.location ?? undefined,
    notes: [e.notes, e.url].filter(Boolean).join('\n\n') || undefined,
  };

  try {
    const { granted } = await Calendar.requestCalendarPermissions(true);
    if (granted) {
      const calendar =
        Platform.OS === 'ios'
          ? Calendar.getDefaultCalendarSync()
          : (await Calendar.getCalendars()).find((c) => c.isPrimary && c.allowsModifications) ??
            (await Calendar.getCalendars()).find((c) => c.allowsModifications);
      if (calendar) {
        const result = await calendar.addEventWithForm({ ...details, url: e.url ?? undefined });
        return result.action === 'canceled' ? 'canceled' : 'saved';
      }
    }
  } catch {
    // Fall through to the legacy system dialog below.
  }
  const result = await createEventInCalendarAsync(details);
  return result.action === 'canceled' ? 'canceled' : 'saved';
}

const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: Date, allDay: boolean) =>
  allDay
    ? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    : `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsEscape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildIcs(e: CalendarEventInput, start: Date, end: Date, allDay: boolean) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nordlys Planlegger//NO',
    'BEGIN:VEVENT',
    `UID:${e.date}-${encodeURIComponent(e.title)}@nordlys-planlegger`,
    `DTSTAMP:${icsDate(new Date(), false)}`,
    allDay ? `DTSTART;VALUE=DATE:${icsDate(start, true)}` : `DTSTART:${icsDate(start, false)}`,
    allDay ? `DTEND;VALUE=DATE:${icsDate(end, true)}` : `DTEND:${icsDate(end, false)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : null,
    e.notes || e.url ? `DESCRIPTION:${icsEscape([e.notes, e.url].filter(Boolean).join('\n\n'))}` : null,
    e.url ? `URL:${e.url}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

function downloadIcs(e: CalendarEventInput, start: Date, end: Date, allDay: boolean) {
  const blob = new Blob([buildIcs(e, start, end, allDay)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${e.title.replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'arrangement'}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
