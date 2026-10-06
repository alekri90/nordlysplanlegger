/**
 * Timezone-free calendar helpers. Event dates are ISO strings (`YYYY-MM-DD`)
 * and Norwegian formatting is done here, not via Intl, for consistent output on all engines.
 */

export const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
/** Monday-first. */
export const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
export const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** `YYYY-MM` for a date. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 0 = monday … 6 = sunday */
export function weekday(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export function isWeekend(iso: string): boolean {
  return weekday(iso) >= 5;
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** All dates in [from, to] inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthDates(key: string): string[] {
  return dateRange(`${key}-01`, `${key}-${pad(daysInMonth(key))}`);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "oktober" / "Oktober" */
export function monthName(key: string, capitalize = true): string {
  const name = MONTHS[Number(key.slice(5, 7)) - 1];
  return capitalize ? cap(name) : name;
}

/** "Oktober 2026" (year hidden when it's the current year unless `withYear`). */
export function monthTitle(key: string, withYear = true): string {
  return withYear ? `${monthName(key)} ${key.slice(0, 4)}` : monthName(key);
}

/** "11. oktober" */
export function formatDayMonth(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "Lørdag 11. oktober" */
export function formatLong(iso: string): string {
  return `${cap(WEEKDAYS[weekday(iso)])} ${formatDayMonth(iso)}`;
}

/** "Lør 11. okt" */
export function formatShort(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS_SHORT[weekday(iso)]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Lør 11. oktober" — used in result rows. */
export function formatMedium(iso: string): string {
  return `${WEEKDAYS_SHORT[weekday(iso)]} ${formatDayMonth(iso)}`;
}

/** Period label derived from candidate dates: "Oktober", "Oktober–november". */
export function periodLabelFor(dates: string[]): string | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  const first = monthKey(sorted[0]);
  const last = monthKey(sorted[sorted.length - 1]);
  if (first === last) return monthName(first);
  return `${monthName(first)}–${monthName(last, false)}`;
}

/** Number of distinct weekends among the dates (Fri–Sun of the same week count as one). */
export function countWeekends(dates: string[]): number {
  const keys = new Set<string>();
  for (const d of dates) {
    const w = weekday(d);
    if (w >= 4) keys.add(addDays(d, -w)); // monday of that week
  }
  return keys.size;
}

/** "for 5 min siden", "i går", "3. okt" */
export function formatRelative(isoDateTime: string, now: Date = new Date()): string {
  const then = new Date(isoDateTime);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'nå';
  if (minutes < 60) return `for ${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `for ${hours} t siden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'i går';
  if (days < 7) return `for ${days} dager siden`;
  return `${then.getDate()}. ${MONTHS_SHORT[then.getMonth()]}`;
}

/** "18:00" → "18:00"; tolerates "18:00:00" from Postgres. */
export function formatTime(time?: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}
