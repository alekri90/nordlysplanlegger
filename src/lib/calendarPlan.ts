import type { PlannerEvent } from '../data/types.ts';

/** What one arrangement should look like in the phone's calendar. */
export interface CalendarEntry {
  eventId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM; null is all day
  location: string | null;
  notes: string;
  link: string;
}

/** What this phone last wrote for each arrangement: eventId → fingerprint. */
export type SyncedEntries = Record<string, string>;

export interface CalendarPlan<T> {
  create: CalendarEntry[];
  update: { entry: CalendarEntry; existing: T }[];
  /** No longer wanted. Those we can't see in the calendar are only forgotten. */
  remove: { eventId: string; existing: T }[];
  forget: string[];
}

/**
 * Every entry carries a link to the arrangement and a short mark for whose it is. That's how we
 * find our own entries again after a new phone, on a second device, and without touching what
 * someone else put in a calendar you share.
 */
export function calendarLink(webUrl: string, eventId: string, userId: string) {
  return `${webUrl}/event/${eventId}#${userId.slice(0, 8)}`;
}

/** The arrangement an entry belongs to, if it's this person's own. */
export function eventIdFromNotes(notes: string | null | undefined, userId: string): string | null {
  const match = notes?.match(/\/event\/([^\s/#]+)#([0-9a-zA-Z-]{1,8})/);
  return match && match[2] === userId.slice(0, 8) ? match[1] : null;
}

export function calendarFingerprint(e: CalendarEntry) {
  return JSON.stringify([e.title, e.date, e.startTime, e.location, e.notes]);
}

/** Only what you're actually going to: a set date, not past, and you haven't said no to it. */
export function calendarEntries(events: PlannerEvent[], meId: string, today: string, webUrl: string): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const e of events) {
    if (e.status !== 'date_selected' && e.status !== 'confirmed') continue;
    if (!e.selectedDate || e.selectedDate < today) continue;
    const mine = e.members.find((m) => m.userId === meId);
    const hosting = e.organizer.id === meId || !!mine?.isCohost;
    const going = mine?.status === 'attending' || (mine?.status === 'responded' && !mine.unavailableOptionIds.includes(e.selectedOptionId ?? ''));
    if (!hosting && !going) continue;
    if (mine?.status === 'declined') continue;
    const link = calendarLink(webUrl, e.id, meId);
    entries.push({
      eventId: e.id,
      title: e.title,
      date: e.selectedDate,
      startTime: e.startTime ?? (e.timeHint === 'evening' ? '18:00' : null),
      location: e.location ? [e.location.name, e.location.address].filter(Boolean).join(', ') : null,
      notes: [e.description, link].filter(Boolean).join('\n\n'),
      link,
    });
  }
  return entries;
}

/**
 * `found` is what's in the calendar now, today and onwards, so what has passed is left alone.
 * Someone who deleted an entry themselves doesn't get it back until the arrangement changes.
 */
export function planCalendarSync<T>(entries: CalendarEntry[], synced: SyncedEntries, found: Record<string, T>): CalendarPlan<T> {
  const plan: CalendarPlan<T> = { create: [], update: [], remove: [], forget: [] };
  const wanted = new Set(entries.map((e) => e.eventId));
  for (const entry of entries) {
    const existing = found[entry.eventId];
    const same = synced[entry.eventId] === calendarFingerprint(entry);
    if (existing !== undefined) {
      if (!same) plan.update.push({ entry, existing });
    } else if (!same) {
      plan.create.push(entry);
    }
  }
  for (const [eventId, existing] of Object.entries(found)) {
    if (!wanted.has(eventId)) plan.remove.push({ eventId, existing });
  }
  for (const eventId of Object.keys(synced)) {
    if (!wanted.has(eventId) && !(eventId in found)) plan.forget.push(eventId);
  }
  return plan;
}
