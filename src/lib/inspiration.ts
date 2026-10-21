import type { CategoryId } from '@/data/types';
// Relative with .ts so the unit tests (plain Node) can load this file too.
import { defaultCoverFor, photoSetFor, suggestCategory, unsplash } from './categories.ts';
import { seasonalIdeas } from './ideas.ts';

/**
 * «Trenger du inspirasjon?» — who you're doing something with, then what. Plain config: an activity is
 * written once and listed under as many groups as fit. Its picture comes from the same photo sets and
 * themes as everything else (src/lib/categories.ts), matched on the title; change a picture there.
 * Suggestions never propose drinking or gambling; typing «Fest» or «Utepils» still finds pictures that fit.
 */
export type InspirationGroup = { id: string; label: string; photo: string; activities: string[] };

export const INSPIRATION_GROUPS: InspirationGroup[] = [
  {
    id: 'friends',
    label: 'Med vennegjengen',
    photo: '1746635732312-0083b7f9423f',
    activities: ['Spillkveld', 'Hyttetur', 'Badstu og bading', 'Grillkveld', 'Quizkveld', 'Sommerfest', 'Bowling', 'Middag hjemme', 'Konsert', 'Stranddag', 'Escape room', 'Padelturnering'],
  },
  {
    id: 'guys',
    label: 'Med gutta',
    photo: '1490578474895-699cd4e2cf59',
    activities: ['Fotballkveld', 'Kortkveld', 'Golftur', 'Gokart', 'Hyttetur', 'Badstu og isbading', 'Fisketur', 'Gamingkveld', 'Paintball', 'Grillkveld', 'Skitur'],
  },
  {
    id: 'girls',
    label: 'Med jentene',
    photo: '1579457870378-16e766c0c266',
    activities: ['Spa og velvære', 'Brunsj', 'Badstu med jentene', 'Tapaskveld', 'Shoppingtur', 'Yogakveld', 'Hyttetur', 'Sommerfest', 'Keramikkurs', 'Julebord'],
  },
  {
    id: 'family',
    label: 'Med familien',
    photo: '1606474226448-4aa808468efc',
    activities: ['Tur i skogen', 'Pizzakveld', 'Filmkveld', 'Pepperkakebaking', 'Grilling ute', 'Strandtur', 'Akedag', 'Skitur', 'Spillkveld', 'Dyrepark', 'Bursdagsfeiring', 'Piknik'],
  },
  {
    id: 'partner',
    label: 'Med kjæresten',
    photo: '1541089404510-5c9a779841fc',
    activities: ['Date night', 'Restaurantbesøk', 'Spaweekend', 'Matlagingskveld', 'Kino', 'Solnedgangstur', 'Hotellovernatting', 'Konsert', 'Weekendtur'],
  },
  {
    id: 'colleagues',
    label: 'Med kollegaene',
    photo: '1582213782179-e0d53f98f2ca',
    activities: ['Sommerfest', 'Julebord', 'Afterwork', 'Felles lunsj', 'Teambuilding', 'Bowling', 'Felles middag', 'Quizkveld', 'Kickoff', 'Padelturnering', 'Faglig samling'],
  },
  {
    id: 'holidays',
    label: 'Høytider og feiringer',
    photo: '1535379665706-aea78de84a41',
    activities: ['Halloweenfest', 'Julebord', 'Pepperkakebaking', 'Nyttårsfest', 'Påskelunsj', '17. mai-feiring', 'Sommerfest', 'Bursdagsfest', 'Hagefest', 'Juleverksted'],
  },
];

export type Activity = { title: string; category: CategoryId; cover: string; inSeason: boolean };

/** Every activity once, in the order they first appear. */
export const ALL_ACTIVITIES: string[] = [...new Set(INSPIRATION_GROUPS.flatMap((g) => g.activities))];

export function groupPhoto(group: InspirationGroup, width = 800) {
  return unsplash(group.photo, width);
}

/** Title → theme, picture and whether it fits the coming weeks (same calendar as the idea chips). */
export function activity(title: string, today = new Date()): Activity {
  const category = suggestCategory(title);
  return { title, category, cover: defaultCoverFor(title, category), inSeason: fitsSeason(title, category, today) };
}

/** What fits now comes first; otherwise the order the list was written in. */
export function activitiesFor(titles: string[], today = new Date()): Activity[] {
  const list = titles.map((t) => activity(t, today));
  return [...list.filter((a) => a.inSeason), ...list.filter((a) => !a.inSeason)];
}

/** Search across all activities, local and instant. */
export function searchActivities(query: string, today = new Date()): Activity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return activitiesFor(ALL_ACTIVITIES.filter((t) => t.toLowerCase().includes(q)), today);
}

function fitsSeason(title: string, category: CategoryId, today: Date): boolean {
  const ideas = seasonalIdeas(today);
  const set = photoSetFor(title)?.id;
  if (set) return ideas.some((i) => photoSetFor(i)?.id === set);
  // Without its own photos: same theme as one of the season's ideas that has none either («Julebord», «Skitur»).
  return ideas.some((i) => !photoSetFor(i) && suggestCategory(i) === category && category !== 'hangout');
}
