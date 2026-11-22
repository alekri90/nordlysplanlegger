import type { CategoryId, PlannerEvent } from '../data/types';
// Relative with .ts so the unit tests (plain Node) can load this file too.
import { ACTIVITY_TYPES, type ActivityTypeId } from './activities.ts';
import { coverOptionsFor, photoSetFor, suggestCategory, unsplash } from './categories.ts';
import { seasonalIdeas } from './ideas.ts';
import { activity } from './inspiration.ts';

/**
 * «Hva frister?» on the home screen: a row of pictures that make you want to plan something.
 * Shown while there's little in the calendar (nothing, or one thing); gone once two plans are ahead.
 *
 * The order: what you've done before («Gjør igjen»), then what fits the season, then the rest as
 * written below. The pictures come from the same photo sets as everything else (src/lib/categories.ts).
 * Like the other suggestions: no drinking. Pokerkveld is here because it has its own steps.
 */
export type Temptation = {
  title: string;
  /** Opens the activity's own steps (sauna master, menu, buy-in …). */
  kit?: ActivityTypeId;
  /** Only shown when it fits the coming weeks (skiing in winter, the beach in summer). */
  seasonal?: true;
};

export const TEMPTING: Temptation[] = [
  // The ones with their own steps, spread out among the classics.
  { title: 'Aufguss', kit: 'aufguss' },
  { title: 'Pizzakveld' },
  { title: 'Middagsselskap', kit: 'dinner' },
  { title: 'Søndagstur' },
  { title: 'Padel', kit: 'racket' },
  { title: 'Spillkveld' },
  { title: 'Knytteknute', kit: 'potluck' },
  { title: 'Quizkveld' },
  { title: 'Fjelltur', kit: 'hike' },
  { title: 'Filmkveld' },
  { title: 'Pokerkveld', kit: 'poker' },
  { title: 'Løpetur', kit: 'run' },
  { title: 'Brunsj' },
  { title: 'Hyttetur' },
  { title: 'Bowling' },
  { title: 'Escape room' },
  { title: 'Tapaskveld' },
  { title: 'Matlagingskveld' },
  { title: 'Keramikkurs' },
  { title: 'Konsert' },
  { title: 'Gokart' },
  { title: 'Yogakveld' },

  // The year in Norway. At most three that fit the coming weeks are shown, in this order:
  // autumn before Christmas, and mixed so late November isn't only Christmas.
  { title: 'Halloweenfest', seasonal: true },
  { title: 'Sopptur', seasonal: true },
  { title: 'Julebord', seasonal: true },
  { title: 'Isbading', seasonal: true },
  { title: 'Pepperkakebaking', seasonal: true },
  { title: 'Skitur', seasonal: true },
  { title: 'Nyttårsaften', seasonal: true },
  { title: 'Akedag', seasonal: true },
  { title: 'Juleverksted', seasonal: true },
  { title: 'Skøyter', seasonal: true },
  { title: 'Påskefjellet', seasonal: true },
  { title: '17. mai-frokost', seasonal: true },
  { title: 'Piknik', seasonal: true },
  { title: 'Stranddag', seasonal: true },
  { title: 'Grillkveld', seasonal: true },
  { title: 'Båttur', seasonal: true },
  { title: 'St. Hans', seasonal: true },
];

/** The picture on the empty home screen: friends around a long table. */
export const GATHER_PHOTO = unsplash('1528605248644-14dd04022da1', 1200);

export type TemptingCard = {
  key: string;
  title: string;
  cover: string;
  category: CategoryId;
  kit: ActivityTypeId | null;
  /** Something you did before: plan it again with the same picture, place and people. */
  again: PlannerEvent | null;
};

/** Earlier plans you were part of, one per name, newest first. «Gjenta» on step 1 uses the same list. */
export function earlierPlans(events: PlannerEvent[], meId: string | undefined, today: string, limit = 8): PlannerEvent[] {
  const seen = new Set<string>();
  return events
    .filter((e) => e.status === 'completed' || (e.status !== 'cancelled' && !!e.selectedDate && e.selectedDate < today))
    .filter((e) => e.members.find((m) => m.userId === meId)?.status !== 'declined')
    .sort((a, b) => (b.selectedDate ?? b.createdAt).localeCompare(a.selectedDate ?? a.createdAt))
    .filter((e) => {
      const key = e.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * The cards for «Hva frister?»: up to two things you've done before, then what fits now, then the
 * rest. Never something already planned (an Aufguss coming up: no Aufguss card), never the same
 * name, kind or picture twice.
 */
export function temptingNow({
  earlier = [],
  planned = [],
  avoidPhoto,
  today = new Date(),
  limit = 10,
}: {
  /** From earlierPlans(). */
  earlier?: PlannerEvent[];
  /** What's already coming up. */
  planned?: Pick<PlannerEvent, 'title' | 'activityType'>[];
  /** A picture already on screen (the big one above). */
  avoidPhoto?: string;
  today?: Date;
  limit?: number;
}): TemptingCard[] {
  const titles = new Set(planned.map((p) => p.title.trim().toLowerCase()));
  const kinds = new Set(planned.flatMap((p) => kindsOf(p.title, p.activityType)));
  const photos = new Set(avoidPhoto ? [photoKey(avoidPhoto)] : []);
  const cards: TemptingCard[] = [];

  const add = (card: TemptingCard) => {
    const key = card.title.trim().toLowerCase();
    const kind = kindsOf(card.title, card.kit);
    if (titles.has(key) || kind.some((k) => kinds.has(k)) || cards.length >= limit) return;
    titles.add(key);
    for (const k of kind) kinds.add(k);
    photos.add(photoKey(card.cover));
    cards.push(card);
  };

  for (const e of earlier.slice(0, 2)) {
    add({ key: `again-${e.id}`, title: e.title, cover: e.coverImageUrl, category: e.category, kit: (e.activityType as ActivityTypeId | null | undefined) ?? null, again: e });
  }

  const season = new Set(seasonalIdeas(today).map((t) => t.toLowerCase()));
  const fits = (t: Temptation) => season.has(t.title.toLowerCase()) || activity(t.title, today).inSeason;
  const now = TEMPTING.filter((t) => t.seasonal && fits(t)).slice(0, 3);
  const rest = TEMPTING.filter((t) => !t.seasonal);
  for (const t of [...now, ...rest]) {
    const category = t.kit ? ACTIVITY_TYPES[t.kit].category : suggestCategory(t.title);
    // A picture not shown yet: the first that fits, or the next one in its set.
    const cover = coverOptionsFor(t.title, category, t.kit).find((url) => !photos.has(photoKey(url)));
    if (!cover) continue;
    add({ key: t.title, title: t.title, cover, category, kit: t.kit ?? null, again: null });
  }
  return cards;
}

/** What a plan is, beyond its name: its activity type and its photo set («Pizzakveld fredag» → pizza). */
function kindsOf(title: string, activityType?: string | null): string[] {
  return [activityType ? 'type:' + activityType : null, photoSetFor(title, activityType)?.id ?? null].filter((k): k is string => !!k);
}

/** The same photo in different sizes counts as one. */
function photoKey(url: string): string {
  return url.replace(/[?#].*$/, '').replace(/-480\.jpg$/, '.jpg');
}
