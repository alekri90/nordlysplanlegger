/**
 * Concrete activity types with their own fields, roles and rules, inside the usual create flow.
 * A general activity (no type) works as before. Aufguss is the first: a sauna, a sauna master who
 * confirms each date, places for paying participants, and a total price shared by them.
 *
 * Add a type by adding an entry here; the screens read labels and rules from it.
 * Self-contained so it runs in the Node test runner.
 */
import type { CategoryId } from '../data/types';

export type ActivityTypeId = 'aufguss';

export interface ActivityRoleSpec {
  key: string;
  /** «Badstumester» */
  label: string;
  /** «badstumester» — in sentences and notifications. */
  lower: string;
  /** «badstumesteren» */
  definite: string;
  /** A role has no participant place and pays no share; it still counts against the venue. */
  takesPlace: false;
  paysShare: false;
  /** «Badstumesteren åpner lenken …» */
  pitch: string;
}

export interface ActivityVenueSpec {
  /** «Badstue» */
  label: string;
  /** «badstua» */
  definite: string;
  placeholder: string;
}

export interface ActivityType {
  id: ActivityTypeId;
  name: string;
  /** One line under the suggestion. */
  description: string;
  /** Matched against what the user types (prefix, both ways). */
  keywords: string[];
  category: CategoryId;
  venue: ActivityVenueSpec;
  role: ActivityRoleSpec;
  /** The price is a total that the participants share. */
  priceMode: 'split';
  /** Participant places are required. */
  requiresPlaces: boolean;
  defaultPlaces: number;
}

export const ACTIVITY_TYPES: Record<ActivityTypeId, ActivityType> = {
  aufguss: {
    id: 'aufguss',
    name: 'Aufguss',
    description: 'Badstue med badstumester. Velg badstue, spør badstumesteren om datoene og del prisen.',
    keywords: ['aufguss', 'badstu', 'badstue', 'sauna', 'badstumester', 'saunagus', 'gus', 'løyly'],
    category: 'sauna',
    venue: { label: 'Badstue', definite: 'badstua', placeholder: 'F.eks. Sørenga badstue' },
    role: {
      key: 'sauna_master',
      label: 'Badstumester',
      lower: 'badstumester',
      definite: 'badstumesteren',
      takesPlace: false,
      paysShare: false,
      pitch: 'Badstumesteren svarer på hver dato med en lenke – uten å installere appen.',
    },
    priceMode: 'split',
    requiresPlaces: true,
    defaultPlaces: 10,
  },
};

export const activityType = (id: string | null | undefined): ActivityType | null =>
  id && id in ACTIVITY_TYPES ? ACTIVITY_TYPES[id as ActivityTypeId] : null;

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^a-zæøåäöü]+/)
    .filter((w) => w.length >= 3);

/** Types that fit what the user is typing: «auf», «aufguss», «badstue» → Aufguss. */
export function matchActivities(text: string): ActivityType[] {
  const typed = words(text);
  if (!typed.length) return [];
  return Object.values(ACTIVITY_TYPES).filter((t) => typed.some((w) => t.keywords.some((k) => k.startsWith(w) || w.startsWith(k))));
}

const WEEKDAY_WORDS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];

/** Weekdays named in the text («tirsdager og torsdager» → [1, 3]; Monday = 0). */
export function weekdaysIn(text: string): number[] {
  const typed = words(text);
  return WEEKDAY_WORDS.map((w, i) => (typed.some((t) => t.startsWith(w)) ? i : -1)).filter((i) => i >= 0);
}

/** A saved venue named in the text («Aufguss på Sørenga» → Sørenga badstue). */
export function venueIn<V extends { name: string }>(text: string, venues: V[]): V | null {
  const typed = words(text);
  return venues.find((v) => words(v.name).some((w) => w.length >= 4 && typed.includes(w))) ?? null;
}

/**
 * The most participants the venue allows when the roles also need room (null: unknown or no limit).
 * 12 in the sauna and a sauna master → 11 participants.
 */
export function maxParticipantsFor(venueCapacity: number | null | undefined, rolePlaces: number): number | null {
  if (!venueCapacity) return null;
  return Math.max(1, venueCapacity - rolePlaces);
}
