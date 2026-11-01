import type { TimeHint } from '../data/types.ts';

/** Something in the phone's calendar that takes up time. It stays on the phone. */
export interface BusyItem {
  title: string;
  calendar: string;
  start: Date;
  end: Date;
  /** The arrangement behind it, if it's one of ours. */
  eventId: string | null;
}

/** The parts of a calendar event we look at. */
export interface RawCalendarEvent {
  title?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  allDay?: boolean;
  availability?: string | null;
  status?: string | null;
  notes?: string | null;
  url?: string | null;
  calendarId?: string | null;
}

/** The moment being decided on. No time: the whole day counts. */
export interface ConflictWhen {
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  timeHint?: TimeHint | null;
  /** Never warn about the arrangement itself. */
  eventId?: string | null;
}

// As long as an entry in the calendar: arrangements have no end time.
const EVENT_MINUTES = 180;

const ref = (text?: string | null) => text?.match(/\/event\/([^\s/#]+)/)?.[1] ?? null;

/** Birthdays, holidays and «ledig» don't stop anyone, so they never warn. */
export function toBusyItems(events: RawCalendarEvent[], calendarTitles: Record<string, string> = {}): BusyItem[] {
  return events
    .filter((e) => !e.allDay && e.availability !== 'free' && e.status !== 'canceled')
    .map((e) => ({
      title: e.title?.trim() || 'Opptatt',
      calendar: calendarTitles[e.calendarId ?? ''] ?? '',
      start: new Date(e.startDate),
      end: new Date(e.endDate),
      eventId: ref(e.notes) ?? ref(e.url),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function at(date: string, time: string, addDays = 0) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d + addDays, h, min);
}

const dayStart = (date: string) => at(date, '00:00');
const dayEnd = (date: string) => at(date, '00:00', 1);

export function eventWindow({ date, startTime, timeHint }: ConflictWhen) {
  if (startTime) {
    const start = at(date, startTime);
    return { start, end: new Date(start.getTime() + EVENT_MINUTES * 60_000) };
  }
  if (timeHint === 'evening') return { start: at(date, '18:00'), end: dayEnd(date) };
  if (timeHint === 'daytime') return { start: at(date, '08:00'), end: at(date, '17:00') };
  return { start: dayStart(date), end: dayEnd(date) };
}

export function conflictsFor(items: BusyItem[], when: ConflictWhen) {
  const { start, end } = eventWindow(when);
  return items.filter((i) => i.start < end && i.end > start && (!when.eventId || i.eventId !== when.eventId));
}

/**
 * What's in the calendar on a day. «Etter kl. 16» goes by when something starts, so a working day
 * that ends at 17 stays out. What began on an earlier day and is still going, stays in.
 */
export function busyOnDay(items: BusyItem[], date: string, eveningOnly = false) {
  const all = conflictsFor(items, { date });
  if (!eveningOnly) return all;
  const evening = at(date, '16:00');
  return all.filter((i) => i.start >= evening || (i.start < dayStart(date) && i.end > evening));
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** «kl. 18:00–20:00», and honest about what runs in from or on past the day. */
export function conflictTime(item: BusyItem, date: string) {
  const before = item.start < dayStart(date);
  const after = item.end > dayEnd(date);
  if (before && after) return 'hele dagen';
  if (before) return `til kl. ${clock(item.end)}`;
  if (after) return `fra kl. ${clock(item.start)}`;
  return `kl. ${clock(item.start)}–${clock(item.end)}`;
}

export function conflictSummary(conflicts: BusyItem[], when: ConflictWhen) {
  if (conflicts.length === 1) return `Du har noe i kalenderen ${conflictTime(conflicts[0], when.date)}`;
  return `Du har ${conflicts.length} ting i kalenderen${when.startTime ? '' : ' denne dagen'}`;
}
