import type { IconName } from '@/components/ui/Icon';
import type { CategoryId } from '@/data/types';

/** Curated, verified Unsplash photos. MVP uses a fixed set per category; AI covers can come later. */
export function unsplash(id: string, width = 1200) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;
}

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Lower-case keywords matched against the title. */
  keywords: string[];
  photos: string[];
}

export const CATEGORIES: Record<CategoryId, Category> = {
  sauna: {
    id: 'sauna',
    label: 'Badstu',
    icon: 'sunset',
    keywords: ['badstu', 'sauna', 'bad', 'spa', 'kaldbad', 'isbad', 'sjøbad'],
    photos: [
      '1579457870378-16e766c0c266', // friends at the shore, sunset
      '1739869481946-c054e37a55b1', // sauna interior with people
      '1758599669742-e90b390b50bc', // silhouettes watching sunset over water
      '1712659606957-b7395ba9ebb2', // sauna with window
      '1741601274134-fa98352f1c95', // water on sauna rocks
      '1728404259075-209cfb5bb89c', // wood stove in cabin
    ],
  },
  poker: {
    id: 'poker',
    label: 'Spillkveld',
    icon: 'layers',
    keywords: ['poker', 'kort', 'spill', 'brettspill', 'quiz', 'blackjack'],
    photos: [
      '1746635732312-0083b7f9423f', // friends playing cards
      '1780091891244-8e6d48ce53a4', // chips and cards on dark table
      '1774660980275-3a2e7100a1fa', // chips on felt
      '1609818698346-8cb3be6e0bc0', // cards on wood
      '1780092430602-75499580866a', // chip case
    ],
  },
  dinner: {
    id: 'dinner',
    label: 'Middag',
    icon: 'coffee',
    keywords: ['middag', 'mat', 'lunsj', 'brunsj', 'frokost', 'restaurant', 'dinner', 'taco', 'pizza', 'grill'],
    photos: [
      '1528605248644-14dd04022da1', // friends eating together
      '1659690402718-ea07d943fd42', // friends enjoying a meal
      '1696627958251-775068a8ddbc', // table with wine glasses
      '1530062845289-9109b2c9c868', // eating in a backyard
      '1670899460364-ebc917bac09a', // long table
      '1527529482837-4698179dc6ce', // raising glasses
    ],
  },
  sport: {
    id: 'sport',
    label: 'Trening',
    icon: 'activity',
    keywords: ['padel', 'tennis', 'fotball', 'trening', 'løp', 'løpe', 'yoga', 'squash', 'golf', 'bowling'],
    photos: [
      '1658723826297-fe4d1b1e6600', // padel rackets
      '1612534847738-b3af9bc31f0c', // holding padel racket
      '1759355456246-6937354a395d', // hitting with paddle
      '1657704358775-ed705c7388d2', // racket and ball
      '1646649853703-7645147474ba', // rackets on court
    ],
  },
  outdoor: {
    id: 'outdoor',
    label: 'Tur',
    icon: 'map',
    keywords: ['tur', 'fjell', 'topptur', 'hike', 'hiking', 'ski', 'skitur', 'telt', 'padling', 'kajakk'],
    photos: [
      '1629185752152-fe65698ddee4', // hiking towards peaks
      '1520880867055-1e30d1cb001c', // friends on mountain edge
      '1490578474895-699cd4e2cf59', // sitting on trail
    ],
  },
  cabin: {
    id: 'cabin',
    label: 'Hyttetur',
    icon: 'home',
    keywords: ['hytte', 'hyttetur', 'cabin', 'helg', 'weekend'],
    photos: [
      '1504233529578-6d46baba6d34', // red house by the water
      '1663428520845-056989f8a664', // Lofoten
      '1546876575-5d8b6dbcb22a', // house by a lake
      '1573471584109-479cc6696e82', // shack by water
      '1534067058742-a4585f7d4ff4',
    ],
  },
  party: {
    id: 'party',
    label: 'Fest',
    icon: 'music',
    keywords: ['fest', 'bursdag', 'vors', 'øl', 'vin', 'drinks', 'bar', 'utepils', 'party', 'feiring', 'jubileum', 'konsert'],
    photos: [
      '1699730164892-d7c433524ff3', // glasses up
      '1640766322140-ab90a7bc71e5', // drinks
      '1519671482749-fd09be7ccebf', // toast
      '1513309914637-65c20a5962e1', // cheering with mugs
      '1641631366865-8f7aa9fbc584', // beers
      '1758599670006-d7fe945b5966', // dancing at sunset
    ],
  },
  family: {
    id: 'family',
    label: 'Familie',
    icon: 'heart',
    keywords: ['familie', 'familien', 'søndagsmiddag', 'mamma', 'pappa', 'besteforeldre', 'jul', 'påske', 'bursdag til'],
    photos: [
      '1533777419517-3e4017e2e15a', // toast at table
      '1578496780896-7081cc23c111', // eating indoors
      '1556025329-d40ee6fcaa94', // around the dining table
      '1576867757603-05b134ebc379', // food on table
    ],
  },
  hangout: {
    id: 'hangout',
    label: 'Noe sosialt',
    icon: 'users',
    keywords: [],
    photos: [
      '1579457870378-16e766c0c266',
      '1699730148588-42aabafe9c72', // toasting with drinks
      '1528605248644-14dd04022da1',
      '1758599670008-ec1888a04d49', // sunset silhouettes
      '1628336707631-68131ca720c3',
    ],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

/** Suggest a category from what the user typed. "Badstu med jentene" → sauna. */
export function suggestCategory(title: string): CategoryId {
  const t = title.toLowerCase();
  let best: CategoryId = 'hangout';
  let bestIndex = Infinity;
  for (const c of CATEGORY_LIST) {
    for (const k of c.keywords) {
      const i = t.indexOf(k);
      // Earliest keyword wins: "Middag og poker" → dinner.
      if (i >= 0 && i < bestIndex) {
        best = c.id;
        bestIndex = i;
      }
    }
  }
  return best;
}

export function coverOptions(category: CategoryId, width = 1200): string[] {
  return CATEGORIES[category].photos.map((id) => unsplash(id, width));
}

export function defaultCover(category: CategoryId): string {
  return unsplash(CATEGORIES[category].photos[0]);
}

/** Smaller variant of a cover URL for thumbnails. Leaves non-Unsplash URLs untouched. */
export function thumb(url: string, width = 400): string {
  return url.includes('images.unsplash.com') ? url.replace(/w=\d+/, `w=${width}`) : url;
}
