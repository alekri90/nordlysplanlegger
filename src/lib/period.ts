import { addDays, addMonths, dateRange, daysInMonth, monthKey, today, weekday } from './dates';

export type Period = { kind: 'month'; month: string } | { kind: 'next30' } | { kind: 'custom' };

export type QuickPick = 'fridays' | 'saturdays' | 'friSat' | 'weekdays' | 'weekends';

export const QUICK_PICKS: { id: QuickPick; label: string; weekdays: number[] }[] = [
  { id: 'friSat', label: 'Fre + lør', weekdays: [4, 5] },
  { id: 'fridays', label: 'Alle fredager', weekdays: [4] },
  { id: 'saturdays', label: 'Alle lørdager', weekdays: [5] },
  { id: 'weekends', label: 'Helger', weekdays: [4, 5, 6] },
  { id: 'weekdays', label: 'Hverdager', weekdays: [0, 1, 2, 3] },
];

/** First month worth suggesting: this month if there's at least a week left, else next. */
export function suggestedMonth(from = today()): string {
  const key = monthKey(from);
  const daysLeft = daysInMonth(key) - Number(from.slice(8, 10));
  return daysLeft >= 7 ? key : addMonths(key, 1);
}

/** Selectable dates for a period. Never includes today or the past. */
export function periodDates(period: Period, from = today()): string[] {
  const start = addDays(from, 1);
  if (period.kind === 'next30') return dateRange(start, addDays(from, 30));
  if (period.kind === 'month') {
    const first = `${period.month}-01`;
    const last = `${period.month}-${String(daysInMonth(period.month)).padStart(2, '0')}`;
    return dateRange(first < start ? start : first, last).filter((d) => d >= start);
  }
  return dateRange(start, addDays(from, 365));
}

/** Months to show in the calendar for a period. */
export function periodMonths(period: Period, from = today()): string[] {
  if (period.kind === 'month') return [period.month];
  if (period.kind === 'next30') {
    const a = monthKey(addDays(from, 1));
    const b = monthKey(addDays(from, 30));
    return a === b ? [a] : [a, b];
  }
  return Array.from({ length: 12 }, (_, i) => addMonths(monthKey(from), i));
}

export function applyQuickPick(pick: QuickPick, available: string[]): string[] {
  const days = QUICK_PICKS.find((q) => q.id === pick)!.weekdays;
  return available.filter((d) => days.includes(weekday(d)));
}

/** Suggest dates on the group's usual weekdays over the next four weeks. */
export function suggestDatesForWeekdays(weekdays: number[], from = today(), weeks = 4): string[] {
  if (!weekdays.length) return [];
  return dateRange(addDays(from, 3), addDays(from, weeks * 7 + 2)).filter((d) => weekdays.includes(weekday(d)));
}

/** The weekdays most used in a list of dates (for remembering a group's rhythm). */
export function dominantWeekdays(dates: string[]): number[] {
  const counts = new Map<number, number>();
  for (const d of dates) counts.set(weekday(d), (counts.get(weekday(d)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w).sort();
}
