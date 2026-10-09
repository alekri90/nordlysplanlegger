/**
 * Recurring events in plain words ("Annenhver torsdag", "Én gang hver måned"). Never shows
 * interval/frequency jargon. Weekdays are 0 = monday … 6 = sunday, as everywhere else.
 */
export type RepeatUnit = 'day' | 'week' | 'month';
/** fixed: same pattern every time · poll_each: find a new date together each time. */
export type RepeatDateMode = 'fixed' | 'poll_each';

export interface RepeatConfig {
  unit: RepeatUnit;
  count: number;
  dateMode: RepeatDateMode;
  weekdays: number[];
  requiresConfirmation: boolean;
  confirmationLeadDays: number;
  autoInviteGroup: boolean;
}

export const DEFAULT_REPEAT: RepeatConfig = {
  unit: 'week',
  count: 1,
  dateMode: 'fixed',
  weekdays: [],
  requiresConfirmation: false,
  confirmationLeadDays: 3,
  autoInviteGroup: true,
};

/** The three big choices; everything else is under "Tilpass". */
export const REPEAT_PRESETS: { id: string; unit: RepeatUnit; count: number }[] = [
  { id: 'w1', unit: 'week', count: 1 },
  { id: 'w2', unit: 'week', count: 2 },
  { id: 'm1', unit: 'month', count: 1 },
];

export const CONFIRM_LEAD_OPTIONS = [1, 2, 3, 5, 7];

const WEEKDAY_PLURAL = ['mandager', 'tirsdager', 'onsdager', 'torsdager', 'fredager', 'lørdager', 'søndager'];
const WEEKDAY = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const UNIT_SINGULAR: Record<RepeatUnit, string> = { day: 'dag', week: 'uke', month: 'måned' };
const UNIT_PLURAL: Record<RepeatUnit, string> = { day: 'dager', week: 'uker', month: 'måneder' };
const ORDINAL = ['Første', 'Andre', 'Tredje', 'Fjerde', 'Siste'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hver uke", "Annenhver uke", "Hver 3. uke", "Hver måned" … */
export function repeatLabel(unit: RepeatUnit, count: number): string {
  if (count <= 1) return `Hver ${UNIT_SINGULAR[unit]}`;
  if (count === 2) return `Annenhver ${UNIT_SINGULAR[unit]}`;
  return `Hver ${count}. ${UNIT_SINGULAR[unit]}`;
}

/** For the "Tilpass" picker: "uke"/"uker" after the number. */
export function unitWord(unit: RepeatUnit, count: number): string {
  return count === 1 ? UNIT_SINGULAR[unit] : UNIT_PLURAL[unit];
}

/** "Torsdager", "Fredager og lørdager", "Alle dager". */
export function weekdaysLabel(weekdays: number[]): string {
  const days = [...new Set(weekdays)].sort();
  if (!days.length || days.length === 7) return 'Alle dager';
  const words = days.map((d) => WEEKDAY_PLURAL[d]);
  const text = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} og ${words[words.length - 1]}`;
  return cap(text);
}

/** "Spør gjengen 3 dager før" / "1 uke før". */
export function confirmLabel(days: number): string {
  if (days === 7) return 'Spør gjengen 1 uke før';
  return `Spør gjengen ${days} ${days === 1 ? 'dag' : 'dager'} før`;
}

const isoWeekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

/**
 * One line for summaries and cards.
 * fixed + date: "Hver torsdag", "Annenhver onsdag", "Første fredag hver måned"
 * poll_each:    "Én gang hver måned · Vi finner dato sammen"
 */
export function repeatSummary(config: Pick<RepeatConfig, 'unit' | 'count' | 'dateMode'>, firstDate?: string | null): string {
  const { unit, count, dateMode } = config;
  if (dateMode === 'poll_each') {
    const often = count <= 1 ? `Én gang hver ${UNIT_SINGULAR[unit]}` : `Én gang ${repeatLabel(unit, count).toLowerCase()}`;
    return `${often} · Vi finner dato sammen`;
  }
  if (firstDate && unit === 'week') {
    const day = WEEKDAY[isoWeekday(firstDate)];
    if (count === 1) return `Hver ${day}`;
    if (count === 2) return `Annenhver ${day}`;
    return `Hver ${count}. ${day}`;
  }
  if (firstDate && unit === 'month') {
    const dayOfMonth = Number(firstDate.slice(8, 10));
    const nth = Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
    const day = WEEKDAY[isoWeekday(firstDate)];
    return `${ORDINAL[nth]} ${day} ${count === 1 ? 'hver måned' : repeatLabel(unit, count).toLowerCase()}`;
  }
  return repeatLabel(unit, count);
}

/** Short tag for cards: "Hver måned", "Annenhver uke". */
export function repeatTag(config: Pick<RepeatConfig, 'unit' | 'count'>): string {
  return repeatLabel(config.unit, config.count);
}
