/**
 * Concrete activity types with their own fields, roles and rules, inside the usual create flow.
 * A general activity (no type) works as before. Aufguss is the first: a sauna, a sauna master who
 * confirms each date, places for paying participants, and a total price shared by them.
 *
 * Add a type by adding an entry here; the screens read labels and rules from it.
 * Self-contained so it runs in the Node test runner.
 */
import type { CategoryId } from '../data/types';

export type ActivityTypeId = 'aufguss' | 'poker' | 'dinner' | 'run' | 'potluck' | 'racket' | 'hike';

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

/** A theme for the evening, set by the organizer or the one with the role. */
export interface ActivityThemeSpec {
  /** «Tema» */
  label: string;
  placeholder: string;
  /** Quick picks. */
  suggestions: string[];
}

/** One of a type's own fields («Buy-in-struktur», «Distanse»). Stored as text in `activity_details.fields`. */
export type KitField = {
  key: string;
  label: string;
  /** Fields with the same group are shown together under it («Meny»). */
  group?: string;
} & (
  | { kind: 'text'; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; unit: string; placeholder?: string }
  | { kind: 'choice'; options: string[] }
);

/** The building blocks a type picks from. */
export interface KitSpec {
  /** «Oppmøtested» — the place field in the create flow and on the event. */
  placeLabel: string;
  placePlaceholder: string;
  /** Title and subtitle of the details step. */
  detailsTitle: string;
  detailsSubtitle: string;
  fields: KitField[];
  /** A price that fits the type: buy-in per player, a contribution per seat, a court shared. */
  price?: { mode: 'per_person' | 'split'; label: string; hint: string };
  /** Guests tell the host about diets and allergies (only the host sees them). */
  diet?: boolean;
  /** «Hvem tar med hva»: the organizer starts the list, guests take things or add their own. */
  bring?: { suggestions: string[] };
  /** Car sharing: some offer seats, others join. */
  rides?: boolean;
  /** Buy-ins and results after the game, with who owes whom. */
  poker?: boolean;
}

interface BaseActivityType {
  id: ActivityTypeId;
  name: string;
  /** One line under the suggestion. */
  description: string;
  /** Matched against what the user types (prefix, both ways). */
  keywords: string[];
  category: CategoryId;
  theme?: ActivityThemeSpec;
  /** Participant places are required. */
  requiresPlaces: boolean;
  defaultPlaces: number;
}

/** A type with a key person who confirms each date first (Aufguss and its sauna master). */
export interface RoleActivityType extends BaseActivityType {
  kind: 'role';
  venue: ActivityVenueSpec;
  role: ActivityRoleSpec;
  theme: ActivityThemeSpec;
  /** The price is a total that the participants share. */
  priceMode: 'split';
}

/** A type made of building blocks, created like any event plus a details step. */
export interface KitActivityType extends BaseActivityType {
  kind: 'kit';
  kit: KitSpec;
}

export type ActivityType = RoleActivityType | KitActivityType;

export const ACTIVITY_TYPES: Record<ActivityTypeId, ActivityType> = {
  aufguss: {
    kind: 'role',
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
    theme: {
      label: 'Tema',
      placeholder: 'F.eks. Eukalyptus og sitrus',
      suggestions: ['Eukalyptus', 'Sitrus', 'Mynte', 'Lavendel', 'Skog og bjørk', 'Hav og salt', 'Jul'],
    },
    priceMode: 'split',
    requiresPlaces: true,
    defaultPlaces: 10,
  },
  poker: {
    kind: 'kit',
    id: 'poker',
    name: 'Pokerkveld',
    description: 'Du er vert. Buy-in, rebuy og plasser rundt bordet – og hvem som skylder hvem etterpå.',
    keywords: ['poker', 'pokerkveld', 'holdem', 'texas', 'omaha', 'pokerturnering'],
    category: 'games',
    requiresPlaces: true,
    defaultPlaces: 8,
    kit: {
      placeLabel: 'Hvor',
      placePlaceholder: 'F.eks. hjemme hos meg',
      detailsTitle: 'Bordet',
      detailsSubtitle: 'Spillerne ser dette i invitasjonen. Du kan endre det senere.',
      fields: [
        { key: 'variant', label: 'Spill', kind: 'choice', options: ["Texas Hold'em", 'Omaha', 'Blandet'] },
        { key: 'format', label: 'Format', kind: 'choice', options: ['Turnering', 'Cash game'] },
        { key: 'rebuy', label: 'Rebuy', kind: 'choice', options: ['Ingen rebuy', '1 rebuy', 'Fri rebuy til pausen'] },
        { key: 'stack', label: 'Startstack', kind: 'text', placeholder: 'F.eks. 10 000' },
        { key: 'blinds', label: 'Blinds', kind: 'text', placeholder: 'F.eks. 25/50, opp hvert 20. minutt' },
        { key: 'end', label: 'Ferdig ca.', kind: 'text', placeholder: 'F.eks. kl. 01' },
      ],
      price: { mode: 'per_person', label: 'Buy-in', hint: 'Hver spiller betaler dette inn i potten. En rebuy koster det samme. Betaling skjer utenfor appen.' },
      poker: true,
    },
  },
  dinner: {
    kind: 'kit',
    id: 'dinner',
    name: 'Middag',
    description: 'Inviter på middag med meny. Gjestene sier fra om kostbehov og allergier.',
    keywords: ['middag', 'middagsselskap', 'dinner', 'treretters', 'tapas', 'gjestemiddag'],
    category: 'dinner',
    theme: { label: 'Tema', placeholder: 'F.eks. Italiensk', suggestions: ['Italiensk', 'Fransk', 'Tapas', 'Sjømat', 'Vilt', 'Julemat'] },
    requiresPlaces: true,
    defaultPlaces: 8,
    kit: {
      placeLabel: 'Hvor',
      placePlaceholder: 'F.eks. hjemme hos meg',
      detailsTitle: 'Menyen',
      detailsSubtitle: 'Vises i invitasjonen. Gjestene kan si fra om kostbehov og allergier – bare du ser dem.',
      fields: [
        { key: 'starter', label: 'Forrett', kind: 'text', placeholder: 'F.eks. Kamskjell med blomkålpuré', group: 'Meny' },
        { key: 'main', label: 'Hovedrett', kind: 'text', placeholder: 'F.eks. Lammeskank med rotgrønnsaker', group: 'Meny' },
        { key: 'dessert', label: 'Dessert', kind: 'text', placeholder: 'F.eks. Sjokoladefondant', group: 'Meny' },
        { key: 'drinks', label: 'Drikke', kind: 'choice', options: ['Verten ordner drikke', 'Ta med egen drikke', 'Vinpakke i bidraget'] },
        { key: 'dress', label: 'Antrekk', kind: 'text', placeholder: 'F.eks. Pent, men uformelt' },
      ],
      price: { mode: 'per_person', label: 'Bidrag per kuvert', hint: 'Valgfritt. Vises til gjestene – betaling skjer utenfor appen.' },
      diet: true,
    },
  },
  run: {
    kind: 'kit',
    id: 'run',
    name: 'Løpetur',
    description: 'Oppmøtested, distanse og tempo – så alle vet hva de blir med på.',
    keywords: ['løping', 'løpetur', 'løpe', 'jogg', 'jogging', 'joggetur', 'intervall', 'intervaller', 'langtur', 'løpegruppe'],
    category: 'sport',
    requiresPlaces: false,
    defaultPlaces: 10,
    kit: {
      placeLabel: 'Oppmøtested',
      placePlaceholder: 'F.eks. Frognerparken, hovedporten',
      detailsTitle: 'Turen',
      detailsSubtitle: 'Distanse og tempo gjør det lett å si ja – eller vite at det er for raskt.',
      fields: [
        { key: 'distance', label: 'Distanse', kind: 'number', unit: 'km', placeholder: '10' },
        { key: 'pace', label: 'Tempo', kind: 'text', placeholder: 'F.eks. 5:30 min/km' },
        { key: 'level', label: 'Nivå', kind: 'choice', options: ['Rolig – alle kan bli med', 'Middels', 'Raskt'] },
        { key: 'route', label: 'Rute', kind: 'text', placeholder: 'Lenke til Strava eller kart' },
        { key: 'meet', label: 'Oppmøte', kind: 'text', placeholder: 'F.eks. Møt 10 minutter før' },
      ],
    },
  },
  potluck: {
    kind: 'kit',
    id: 'potluck',
    name: 'Knytteknute',
    description: 'Alle tar med noe. Lag en liste, så krysser gjestene av hva de tar med.',
    keywords: ['knytteknute', 'potluck', 'spleisemiddag', 'knyttekveld', 'koldtbord'],
    category: 'dinner',
    theme: { label: 'Tema', placeholder: 'F.eks. Taco', suggestions: ['Taco', 'Italiensk', 'Asiatisk', 'Tapas', 'Julebord'] },
    requiresPlaces: false,
    defaultPlaces: 12,
    kit: {
      placeLabel: 'Hvor',
      placePlaceholder: 'F.eks. hjemme hos meg',
      detailsTitle: 'Hvem tar med hva?',
      detailsSubtitle: 'Lag listen. Gjestene tar på seg ting og kan legge til egne – så det ikke blir fem salater.',
      fields: [],
      bring: { suggestions: ['Forrett', 'Salat', 'Hovedrett', 'Brød', 'Tilbehør', 'Dessert', 'Drikke', 'Snacks'] },
      diet: true,
    },
  },
  racket: {
    kind: 'kit',
    id: 'racket',
    name: 'Padel/tennis',
    description: 'Bane, nivå og faste plasser. Baneprisen deles på dem som spiller.',
    keywords: ['padel', 'tennis', 'squash', 'badminton', 'racket', 'padelkamp'],
    category: 'sport',
    requiresPlaces: true,
    defaultPlaces: 4,
    kit: {
      placeLabel: 'Hvor',
      placePlaceholder: 'F.eks. Padel Oslo, Økern',
      detailsTitle: 'Banen',
      detailsSubtitle: 'Plassene fylles i den rekkefølgen folk svarer. Resten havner på venteliste.',
      fields: [
        { key: 'sport', label: 'Sport', kind: 'choice', options: ['Padel', 'Tennis', 'Squash', 'Badminton'] },
        { key: 'court', label: 'Bane', kind: 'text', placeholder: 'F.eks. Bane 3' },
        { key: 'level', label: 'Nivå', kind: 'choice', options: ['Nybegynner', 'Middels', 'Viderekommen'] },
        { key: 'format', label: 'Format', kind: 'choice', options: ['Double', 'Single', 'Americano'] },
      ],
      price: { mode: 'split', label: 'Banepris', hint: 'Deles på dem som spiller. Betaling skjer utenfor appen.' },
    },
  },
  hike: {
    kind: 'kit',
    id: 'hike',
    name: 'Fjelltur',
    description: 'Oppmøtested, mål og utstyrsliste – og samkjøring, så ingen kjører alene.',
    keywords: ['fjelltur', 'topptur', 'fottur', 'skogstur', 'fjellet', 'vandring', 'dagstur', 'toppturer'],
    category: 'outdoor',
    requiresPlaces: false,
    defaultPlaces: 10,
    kit: {
      placeLabel: 'Oppmøtested',
      placePlaceholder: 'F.eks. Sognsvann parkering',
      detailsTitle: 'Turen',
      detailsSubtitle: 'Deltagerne kan tilby plass i bilen eller bli med noen andre.',
      fields: [
        { key: 'goal', label: 'Mål', kind: 'text', placeholder: 'F.eks. Kolsåstoppen' },
        { key: 'distance', label: 'Distanse', kind: 'number', unit: 'km', placeholder: '12' },
        { key: 'climb', label: 'Stigning', kind: 'number', unit: 'høydemeter', placeholder: '600' },
        { key: 'level', label: 'Nivå', kind: 'choice', options: ['Lett', 'Middels', 'Krevende'] },
        { key: 'gear', label: 'Utstyr', kind: 'text', multiline: true, placeholder: 'F.eks. Gode sko, vindjakke, matpakke og drikke' },
      ],
      rides: true,
    },
  },
};

/** Any activity type. */
export const activityType = (id: string | null | undefined): ActivityType | null =>
  id && id in ACTIVITY_TYPES ? ACTIVITY_TYPES[id as ActivityTypeId] : null;

/** A type whose dates go to a key person first (Aufguss). */
export const roleActivity = (id: string | null | undefined): RoleActivityType | null => {
  const t = activityType(id);
  return t?.kind === 'role' ? t : null;
};

/** A type made of building blocks (poker, dinner, run …). */
export const kitActivity = (id: string | null | undefined): KitActivityType | null => {
  const t = activityType(id);
  return t?.kind === 'kit' ? t : null;
};

/** What is stored on the event: the type's own fields as text. */
export interface ActivityDetails {
  fields?: Record<string, string>;
}

/** The filled-in fields, in the type's order, ready to show: «Distanse · 10 km». */
export type KitLine = { key: string; label: string; value: string; group: string | undefined };

export function kitLines(type: KitActivityType, details: ActivityDetails | null | undefined): KitLine[] {
  const values = details?.fields ?? {};
  return type.kit.fields
    .map((f) => {
      const raw = (values[f.key] ?? '').trim();
      if (!raw) return null;
      return { key: f.key, label: f.label, value: f.kind === 'number' ? `${raw} ${f.unit}` : raw, group: f.group };
    })
    .filter((x): x is KitLine => !!x);
}

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
