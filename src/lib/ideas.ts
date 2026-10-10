import type { CategoryId } from '@/data/types';

/**
 * Title ideas for "Hva skal dere gjøre?": what this gjeng usually does first, then what fits the
 * time of year, then the evergreens. Plain rules — instant, offline and predictable.
 */

/** Always-good ideas, last in line. */
export const EVERGREEN_IDEAS = ['Middag', 'Spillkveld', 'Filmkveld', 'Quiz', 'Badstu', 'Padel', 'Hyttetur', 'Vors'];

/** What a gjeng named after a theme probably does ("Saunagjengen" → badstu). */
const IDEAS_FOR_THEME: Partial<Record<CategoryId, string[]>> = {
  beach: ['Bading', 'Strandtur', 'Båttur'],
  sauna: ['Badstu', 'Isbading'],
  games: ['Spillkveld', 'Kortkveld', 'Brettspillkveld'],
  quiz: ['Quiz', 'Pubquiz'],
  movie: ['Filmkveld', 'Kino'],
  gaming: ['Gamingkveld', 'FIFA-kveld'],
  brunch: ['Brunsj', 'Kaffe'],
  dinner: ['Middag', 'Taco', 'Grilling'],
  sport: ['Trening', 'Padel', 'Fotball'],
  ski: ['Skitur', 'Aking', 'Afterski'],
  travel: ['Byferie', 'Roadtrip'],
  outdoor: ['Tur', 'Fjelltur', 'Topptur'],
  cabin: ['Hyttetur', 'Hyttehelg'],
  birthday: ['Bursdag', 'Bursdagsfeiring'],
  christmas: ['Julebord', 'Pepperkakebaking', 'Gløgg'],
  party: ['Vors', 'Fest', 'Utepils'],
  concert: ['Konsert', 'Teater', 'Festival'],
  family: ['Familiemiddag', 'Søndagsmiddag'],
};

type MonthDay = [month: number, day: number];
type Season = { from: MonthDay; to: MonthDay; ideas: string[] } | { easter: [before: number, after: number]; ideas: string[] };

/**
 * The Norwegian year. Special days before seasons, so «17. mai-frokost» comes before «Grilling».
 * Windows open a while before the day itself: people plan ahead.
 */
const SEASONS: Season[] = [
  { from: [5, 1], to: [5, 17], ideas: ['17. mai-frokost'] },
  { from: [6, 5], to: [6, 23], ideas: ['St. Hans'] },
  { from: [10, 10], to: [10, 31], ideas: ['Halloweenfest'] },
  { easter: [35, 1], ideas: ['Påskefjellet', 'Påskelunsj'] },
  { from: [10, 15], to: [12, 20], ideas: ['Julebord', 'Pepperkakebaking', 'Gløgg', 'Juleverksted'] },
  { from: [12, 1], to: [12, 31], ideas: ['Romjulstreff', 'Nyttårsaften'] },
  { from: [12, 1], to: [3, 20], ideas: ['Skitur', 'Aking', 'Skøyter', 'Isbading', 'Hyttetur'] },
  { from: [3, 21], to: [5, 31], ideas: ['Tur', 'Grilling', 'Utepils'] },
  { from: [6, 1], to: [8, 20], ideas: ['Bading', 'Båttur', 'Grilling', 'Strandtur', 'Utepils'] },
  { from: [8, 21], to: [11, 15], ideas: ['Sopptur', 'Høsttur', 'Quiz', 'Spillkveld'] },
];

/** How far ahead we look: a plan made today is usually for the coming weeks. */
const LOOK_AHEAD_DAYS = 21;

/** Easter Sunday (Gregorian), local date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function inSeason(season: Season, day: Date): boolean {
  if ('easter' in season) {
    const easter = easterSunday(day.getFullYear()).getTime();
    const t = startOfDay(day).getTime();
    return t >= easter - season.easter[0] * DAY && t <= easter + season.easter[1] * DAY;
  }
  const md = (day.getMonth() + 1) * 100 + day.getDate();
  const from = season.from[0] * 100 + season.from[1];
  const to = season.to[0] * 100 + season.to[1];
  // Seasons across new year (December → March) wrap around.
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** What fits now and the coming weeks, most specific first. */
export function seasonalIdeas(today: Date): string[] {
  const days = [0, 7, 14, LOOK_AHEAD_DAYS].map((n) => new Date(startOfDay(today).getTime() + n * DAY));
  return dedupe(SEASONS.filter((s) => days.some((d) => inSeason(s, d))).flatMap((s) => s.ideas));
}

/** Titles the gjeng has used, most frequent first (newest first on a tie). */
export function historyIdeas(titlesNewestFirst: string[]): string[] {
  const counts = new Map<string, { title: string; count: number; first: number }>();
  titlesNewestFirst.forEach((raw, i) => {
    const title = raw.trim();
    if (!title) return;
    const key = title.toLowerCase();
    const seen = counts.get(key);
    if (seen) seen.count += 1;
    else counts.set(key, { title, count: 1, first: i });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first).map((x) => x.title);
}

export function suggestIdeas({
  history = [],
  nameTheme,
  today = new Date(),
  limit = 10,
}: {
  /** The gjeng's past and planned titles, newest first. */
  history?: string[];
  /** Theme read from the gjeng's name; 'hangout' when the name says nothing. */
  nameTheme?: CategoryId;
  today?: Date;
  limit?: number;
}): string[] {
  const fromName = nameTheme && nameTheme !== 'hangout' ? (IDEAS_FOR_THEME[nameTheme] ?? []) : [];
  return dedupe([...historyIdeas(history), ...fromName, ...seasonalIdeas(today), ...EVERGREEN_IDEAS]).slice(0, limit);
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
