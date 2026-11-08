/**
 * «Avklar med noen først»: from the key person's answer to the events the group is invited to.
 * Self-contained so it runs in the Node test runner.
 */
import type { ClearanceDay, ClearanceDraft, CreateEventInput } from '../data/types';

/** The days that work, in order. */
export const okDates = (days: ClearanceDay[]) => days.filter((d) => d.ok).map((d) => d.date).sort();

/** «2 av 3 dager passer» · «Alle dagene passer» · «Ingen av dagene passet» · «Venter på svar». */
export function clearanceSummary(days: ClearanceDay[], answered: boolean): string {
  if (!answered) return 'Venter på svar';
  const ok = okDates(days).length;
  if (ok === 0) return 'Ingen av dagene passet';
  if (ok === days.length) return days.length === 1 ? 'Dagen passer' : 'Alle dagene passer';
  return `${ok} av ${days.length} dager passer`;
}

/** One event where the group finds the day among those that work, or one event for each day. */
export type ClearanceInviteMode = 'poll' | 'each';

/** The first (or only) event: everything from the create flow, with the dates from the answer. */
export function firstEventInput(draft: ClearanceDraft, dates: string[], mode: ClearanceInviteMode): CreateEventInput {
  const single = dates.length === 1 || mode === 'each';
  return {
    title: draft.title,
    category: draft.category,
    coverImageUrl: draft.coverImageUrl,
    timeHint: draft.timeHint,
    startTime: draft.startTime ?? null,
    groupId: draft.groupId ?? null,
    memberIds: draft.memberIds,
    guestIds: draft.guestIds ?? [],
    guestNames: draft.guestNames ?? [],
    saveAsGroupName: draft.saveAsGroupName ?? null,
    location: draft.location ?? null,
    description: draft.description ?? null,
    dateMode: single ? 'fixed' : 'poll',
    fixedDate: single ? dates[0] : null,
    optionDates: single ? [] : dates,
  };
}

/**
 * The next days when it's one event per day: the same people, without making new guests or a new
 * group again — the guests and group made by the first event are reused.
 */
export function nextEventInput(
  draft: ClearanceDraft,
  date: string,
  first: { groupId?: string | null; guests: { guestId: string }[] },
): CreateEventInput {
  return {
    ...firstEventInput(draft, [date], 'each'),
    groupId: first.groupId ?? draft.groupId ?? null,
    guestIds: [...new Set([...(draft.guestIds ?? []), ...first.guests.map((g) => g.guestId)])],
    guestNames: [],
    saveAsGroupName: null,
  };
}

/** ISO week number of a YYYY-MM-DD date. */
export function isoWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** «Uke 2», «Uke 3» … for the key person's list (dates in order). */
export function groupByWeek(dates: string[]): { label: string; dates: string[] }[] {
  const out: { label: string; dates: string[] }[] = [];
  for (const date of [...dates].sort()) {
    const label = `Uke ${isoWeek(date)}`;
    const last = out.at(-1);
    if (last && last.label === label) last.dates.push(date);
    else out.push({ label, dates: [date] });
  }
  return out;
}
