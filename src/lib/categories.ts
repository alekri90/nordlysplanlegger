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

// Order matters: when two keywords match at the same position, the earlier category wins
// ("badetur" → beach before sauna's "bad", "julebord" → christmas before family's "jul").
export const CATEGORIES: Record<CategoryId, Category> = {
  beach: {
    id: 'beach',
    label: 'Strand og sommer',
    icon: 'sun',
    keywords: ['strand', 'badetur', 'bading', 'svømm', 'sommerfest', 'sommer', 'båt', 'seiling', 'st. hans', 'sankthans'],
    photos: [
      '1536869338989-e7ffd2297454', // friends on the beach
      '1530541930197-ff16ac917b0e', // campfire on the beach
      '1496275068113-fff8c90750d1', // walking the shore at sunset
      '1675826025405-682ebe9021e8', // sitting on the sand at sunset
    ],
  },
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
  games: {
    id: 'games',
    label: 'Spillkveld',
    icon: 'layers',
    keywords: ['spillkveld', 'kortspill', 'kortkveld', 'kort', 'brettspill', 'spill', 'yatzy', 'bridge', 'sjakk', 'backgammon', 'monopol'],
    photos: [
      '1746635732312-0083b7f9423f', // friends playing cards
      '1677188010559-0667a1ed33a0', // board game at the table
      '1660327401446-749a3c2e6b8e', // hand of cards
      '1607438802263-ada36dae55c5', // playing cards on the table
      '1768768772898-dc809c01dc2a', // cards on a wooden table outdoors
      '1781917389734-282472b03a2a', // backgammon with drinks and snacks
    ],
  },
  quiz: {
    id: 'quiz',
    label: 'Quiz',
    icon: 'help-circle',
    keywords: ['quiz', 'pubquiz', 'trivia'],
    photos: [
      '1558210598-89ba75b1724e', // friends at a bar
      '1557318041-1ce374d55ebf', // question mark sign with light bulbs
      '1681641090195-5adb0c54eeb0', // friends around a table with drinks
      '1560090143-aa4d95362170', // people at tables
    ],
  },
  movie: {
    id: 'movie',
    label: 'Filmkveld',
    icon: 'film',
    keywords: ['filmkveld', 'film', 'kino', 'serie', 'netflix'],
    photos: [
      '1758525862263-af89b090fb56', // friends watching tv with popcorn
      '1721733258290-cac1a9204564', // outdoor movie on a blanket
      '1572177191856-3cde618dee1f', // popcorn
      '1791275605302-bae384ff80e8', // outdoor screening at night
      '1771574203200-0ec88f162fe0', // cinema hall
    ],
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming',
    icon: 'monitor',
    keywords: ['gaming', 'playstation', 'xbox', 'nintendo', 'fifa', 'e-sport', 'dataspill'],
    photos: [
      '1493711662062-fa541adb3fc8', // two controllers in front of the tv
      '1659535907680-0e219b46c01d', // friends on the couch with controllers
      '1714646184215-f7af62f72f80', // two friends playing video games
      '1548003693-b55d51032288', // playing in front of monitors
    ],
  },
  brunch: {
    id: 'brunch',
    label: 'Brunsj og kaffe',
    icon: 'sunrise',
    keywords: ['brunsj', 'kaffe', 'frokost', 'lunsj', 'kafé', 'kafe'],
    photos: [
      '1789758385692-38432c7bc6f8', // friends laughing over breakfast
      '1773504356091-222ee58cfd23', // friends at an outdoor cafe
      '1695141482205-08e4e76c2a79', // friends around a brunch table
      '1675159206783-b2f129e46ef0', // brunch at a wooden table
    ],
  },
  dinner: {
    id: 'dinner',
    label: 'Middag',
    icon: 'coffee',
    keywords: ['middag', 'mat', 'restaurant', 'dinner', 'taco', 'pizza', 'grill'],
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
    keywords: ['padel', 'tennis', 'fotball', 'trening', 'løp', 'løpe', 'yoga', 'squash', 'golf', 'bowling', 'badminton'],
    photos: [
      '1658723826297-fe4d1b1e6600', // padel rackets
      '1612534847738-b3af9bc31f0c', // holding padel racket
      '1759355456246-6937354a395d', // hitting with paddle
      '1657704358775-ed705c7388d2', // racket and ball
      '1646649853703-7645147474ba', // rackets on court
    ],
  },
  ski: {
    id: 'ski',
    label: 'Ski og vinter',
    icon: 'cloud-snow',
    keywords: ['skitur', 'ski', 'alpin', 'slalom', 'langrenn', 'snowboard', 'vinter', 'afterski', 'aking', 'akebakke', 'skøyte'],
    photos: [
      '1459196198227-6655e22114d8', // skiing down the slope
      '1734366965512-1ef84f81c513', // friends in the snow
      '1453694595360-51e193e121fc', // walking up with skis
      '1582048551464-8b1d42010271', // cheering on the mountain
    ],
  },
  travel: {
    id: 'travel',
    label: 'Reise',
    icon: 'globe',
    keywords: ['reise', 'tur til', 'ferie', 'byferie', 'storby', 'roadtrip', 'interrail', 'utlandet'],
    photos: [
      '1511632765486-a01980e01a18', // friends at sunset, arms around each other
      '1529156069898-49953e39b3ac', // friends sitting on a wall with a view
      '1528916451049-e5d097b61db2', // friends above a big city
      '1529424601215-d2a3daf193ff', // roadtrip, sitting in the car boot
      '1548957175-84f0f9af659e', // overlooking mountains
    ],
  },
  outdoor: {
    id: 'outdoor',
    label: 'Tur',
    icon: 'map',
    keywords: ['tur', 'fjell', 'topptur', 'hike', 'hiking', 'telt', 'padling', 'kajakk', 'sopp', 'høsttur', 'bærtur'],
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
    keywords: ['hytte', 'hyttetur', 'cabin', 'helg', 'weekend', 'påskefjell'],
    photos: [
      '1504233529578-6d46baba6d34', // red house by the water
      '1663428520845-056989f8a664', // Lofoten
      '1546876575-5d8b6dbcb22a', // house by a lake
      '1573471584109-479cc6696e82', // shack by water
      '1534067058742-a4585f7d4ff4',
    ],
  },
  birthday: {
    id: 'birthday',
    label: 'Bursdag',
    icon: 'gift',
    keywords: ['bursdag', 'bursdagsfeiring', 'jubileum', 'årsdag'],
    photos: [
      '1699730185428-d11054059c7f', // confetti and balloons
      '1714978444614-7a197c2309ee', // cake with candles
      '1741887845577-bbe0dd3ebfe2', // celebrating with a cake
      '1544155892-b2b6c64204fc', // glitter
    ],
  },
  christmas: {
    id: 'christmas',
    label: 'Julebord',
    icon: 'star',
    keywords: ['julebord', 'julefest', 'juleavslutning', 'gløgg', 'pepperkake', 'juleverksted', 'romjul'],
    photos: [
      '1601118964938-228a89955311', // toast over a festive dinner
      '1735324475776-177baaa34d5b', // glasses by the christmas tree
      '1581954548122-4dff8989c0f7', // long festive table
      '1699730148132-1409a3728479', // friends around a table with food and drinks
    ],
  },
  party: {
    id: 'party',
    label: 'Fest',
    icon: 'music',
    keywords: ['fest', 'vors', 'øl', 'vin', 'drinks', 'bar', 'utepils', 'party', 'feiring', 'nyttår', 'halloween'],
    photos: [
      '1699730164892-d7c433524ff3', // glasses up
      '1640766322140-ab90a7bc71e5', // drinks
      '1519671482749-fd09be7ccebf', // toast
      '1513309914637-65c20a5962e1', // cheering with mugs
      '1641631366865-8f7aa9fbc584', // beers
      '1758599670006-d7fe945b5966', // dancing at sunset
    ],
  },
  concert: {
    id: 'concert',
    label: 'Konsert og kultur',
    icon: 'mic',
    keywords: ['konsert', 'festival', 'teater', 'show', 'opera', 'standup', 'stand-up', 'museum', 'kultur'],
    photos: [
      '1459749411175-04bf5292ceea', // concert crowd
      '1470229722913-7c0e2dbbafd3', // stage lights over the audience
      '1501386761578-eac5c94b800a', // cheering crowd
      '1540039155733-5bb30b53aa14', // crowd facing a lit stage
      '1533174072545-7a4b6ad7a6c3', // festival field
    ],
  },
  family: {
    id: 'family',
    label: 'Familie',
    icon: 'heart',
    keywords: ['familie', 'familien', 'søndagsmiddag', 'mamma', 'pappa', 'besteforeldre', 'jul', 'påske'],
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
  let bestLength = 0;
  for (const c of CATEGORY_LIST) {
    for (const k of c.keywords) {
      const i = t.indexOf(k);
      // Earliest keyword wins: "Middag og kortspill" → dinner. At the same position the longer, more
      // specific word wins ("Badminton" → sport, not "bad"); then the earlier category.
      if (i >= 0 && (i < bestIndex || (i === bestIndex && k.length > bestLength))) {
        best = c.id;
        bestIndex = i;
        bestLength = k.length;
      }
    }
  }
  return best;
}

/** Themes that no longer exist (e.g. the old "poker") fall back to the catch-all. */
const themeOf = (category: CategoryId) => CATEGORIES[category] ?? CATEGORIES.hangout;

export function coverOptions(category: CategoryId, width = 1200): string[] {
  return themeOf(category).photos.map((id) => unsplash(id, width));
}

export function defaultCover(category: CategoryId): string {
  return unsplash(themeOf(category).photos[0]);
}

/** Smaller variant of a cover URL for thumbnails. Leaves non-Unsplash URLs untouched. */
export function thumb(url: string, width = 400): string {
  return url.includes('images.unsplash.com') ? url.replace(/w=\d+/, `w=${width}`) : url;
}

/**
 * Photos for specific occasions inside a theme ("Halloweenfest" is a party, but should look like
 * Halloween). Matched against the title like the themes; they come first in the photo grid and are the
 * default cover. Every seasonal idea in src/lib/ideas.ts has a set here or a theme whose photos fit
 * (checked by the tests). Each photo was looked at before it was added.
 */
export type PhotoSet = { id: string; keywords: string[]; photos: string[] };

export const PHOTO_SETS: PhotoSet[] = [
  {
    id: 'halloween',
    keywords: ['halloween'],
    photos: [
      '1509558567730-6c838437b06b', // lit jack-o'-lantern
      '1667852916327-c0444978d171', // carved pumpkins and candles
      '1727454145163-aad0eb3ff81c', // table with halloween decorations
      '1509557965875-b88c97052f0e', // skeletons and string lights
    ],
  },
  {
    id: 'gingerbread',
    keywords: ['pepperkake'],
    photos: [
      '1742988700812-fd76a68ad09c', // decorated gingerbread
      '1698672362756-14375dbb571c', // gingerbread men on a plate
      '1610562275255-03b7fa0d4655', // iced cookies
      '1639590229762-3c9a8c98ca31', // cookies on a cooling rack
    ],
  },
  {
    id: 'mulledWine',
    keywords: ['gløgg'],
    photos: [
      '1512589848202-673dfdab1972', // pot of gløgg with orange
      '1542143601-0b3d84693663', // glasses of mulled wine
      '1542143708653-1a0d78f64f21', // gløgg with star anise
      '1734084959344-d0228c84da82', // glass by candlelight
    ],
  },
  {
    id: 'christmasCraft',
    keywords: ['juleverksted', 'julepynt'],
    photos: [
      '1762320859632-304e91db5bf5', // handmade ornaments and a candle
      '1638829154930-9b47ff9cb533', // table with craft supplies
      '1766160796234-063e8fae3902', // dried orange on the tree
    ],
  },
  {
    id: 'newYear',
    keywords: ['nyttår'],
    photos: [
      '1535379665706-aea78de84a41', // people watching fireworks
      '1605941407951-fa62495beb54', // fireworks over the water
      '1549194400-06e6874c2fd1', // fireworks display
      '1639501252219-130096b7b904', // pink fireworks
    ],
  },
  {
    id: 'sledding',
    keywords: ['aking', 'akebakke', 'akedag'],
    photos: [
      '1767798426108-215be29507cc', // crowd sledding down a hill
      '1768065449207-8dbb71d853f7', // people sledding, cloudy day
      '1624060329290-119a2fdc7794', // red sled
      '1771365095302-5ea5ed3e1388', // sleds in the snow
    ],
  },
  {
    id: 'iceSkating',
    keywords: ['skøyte'],
    photos: [
      '1790750541235-b9f38861886a', // friends' selfie on the ice
      '1575808433605-aafc277c4d19', // people skating outdoors
      '1669184773984-b1a177330ee9', // skates on the ice
      '1609987052013-0f4e84e9ff5d', // couple by an ice rink
    ],
  },
  {
    id: 'iceBath',
    keywords: ['isbad', 'vinterbad', 'kaldbad'],
    photos: [
      '1734117928667-c7f943a27e80', // group in an ice hole
      '1701895853566-bd08afa0c422', // man in icy water
      '1701854305546-3a93741e3b37', // swimmer in a frozen lake
      '1612194881610-85422ec3eab9', // dip in the snowy sea
    ],
  },
  {
    id: 'easterMountain',
    keywords: ['påskefjell', 'påsketur', 'påskeski'],
    photos: [
      '1670510521063-ad2aea33dd96', // skier with a backpack in the mountains
      '1710198080758-01736705e8b6', // ski touring above a fjord
      '1641369022944-ff17797243c7', // people crossing a snowy slope
      '1692078138818-9a9c0abf16c2', // skiing down towards the sea
    ],
  },
  {
    id: 'easterLunch',
    keywords: ['påskelunsj', 'påskefrokost', 'påskebrunsj', 'påskemiddag'],
    photos: [
      '1775474535127-655dd8208cf3', // easter breakfast with painted eggs
      '1619854858908-8f2733bd6b8d', // painted eggs
      '1504754524776-8f4f37790ca0', // brunch spread
      '1522570778432-5c3580febe04', // eggs in a nest with flowers
    ],
  },
  {
    id: 'constitutionDay',
    keywords: ['17. mai', '17.mai', 'nasjonaldag'],
    photos: [
      '1780339500471-88f7f17f6e5d', // 17. mai parade with flags and bunads
      '1785141877073-39ef1fb4348e', // Norwegian flags in a window
      '1652787645351-ea4726aee9f5', // flag in a field of flowers
      '1520769669658-f07657f5a307', // flag over the sunset
    ],
  },
  {
    id: 'midsummer',
    keywords: ['st. hans', 'st.hans', 'sankthans', 'bål'],
    photos: [
      '1596326270763-87f26e0f9225', // friends around a bonfire at night
      '1687370139318-951abbe9d082', // people by a fire on the beach at dusk
      '1663247168201-1d6ea2d448fc', // bonfire on the beach
      '1625119161833-57f8a7009f7b', // sparks from a beach fire
    ],
  },
  {
    id: 'boatTrip',
    keywords: ['båt', 'seiling', 'seiltur'],
    photos: [
      '1519801584609-8ee5f072eddd', // friends on a sailing boat
      '1552600337-6f42e4fb2e78', // friends on a boat in clear water
      '1764677804641-62cf2722b62e', // boat on a calm river
      '1605472075294-4c73b9909d08', // sailing boat at sunset
    ],
  },
  {
    id: 'barbecue',
    keywords: ['grill'],
    photos: [
      '1579405317876-9340f1d26061', // friends grilling outside
      '1463183427169-5df5a06d5447', // food on the grill
      '1526369495938-1be4ba6257ce', // grill in the park
      '1687424201737-6c7b1eb9ff86', // table with food and drinks
    ],
  },
  {
    id: 'beerOutside',
    keywords: ['utepils'],
    photos: [
      '1770230901477-5e90b1c67be1', // friends with drinks in the sun
      '1758244241016-20a95d099de1', // friends with drinks outdoors
      '1788804360930-9510ae4a14b2', // laughing with drinks at an event
      '1759753972050-839775c071e3', // outdoor café
    ],
  },
  {
    id: 'mushrooms',
    keywords: ['sopp'],
    photos: [
      '1749592884024-dbbde04c77cd', // basket of mushrooms
      '1788507280988-8cf2683ff18f', // chanterelles
      '1762921168471-d29b18135dd8', // holding a mushroom in the forest
      '1632144808655-cfdeb247abcf', // mushrooms on the forest floor
    ],
  },
  {
    id: 'autumnHike',
    keywords: ['høsttur', 'høst'],
    photos: [
      '1700148575422-5bfa0bc0c069', // hiker on a hill in autumn
      '1738443213794-3f3f89a52a05', // autumn path
      '1441100094486-eff37b2c8e19', // autumn trees
      '1664750958844-a535c5b3d865', // path through the forest
    ],
  },
  {
    id: 'football',
    keywords: ['fotball'],
    photos: [
      '1626058914034-25e3ad6fae3c', // friends playing football
      '1773006088941-0262e88a7e60', // kicking a ball on a sunny day
      '1785240029703-c37147e77e56', // football on a grass pitch
    ],
  },
  {
    id: 'theatre',
    keywords: ['teater', 'revy'],
    photos: [
      '1516307365426-bea591f05011', // theatre hall
      '1515168985652-8454bcc8fcaf', // audience
      '1763962274119-1a0a0d418520', // audience in a dark theatre
    ],
  },
];

/** The photo set for a title ("Halloweenfest" → Halloween), or null. Earliest, then longest keyword wins. */
export function photoSetFor(title: string): PhotoSet | null {
  const t = title.toLowerCase();
  let best: PhotoSet | null = null;
  let bestIndex = Infinity;
  let bestLength = 0;
  for (const set of PHOTO_SETS) {
    for (const k of set.keywords) {
      const i = t.indexOf(k);
      if (i >= 0 && (i < bestIndex || (i === bestIndex && k.length > bestLength))) {
        best = set;
        bestIndex = i;
        bestLength = k.length;
      }
    }
  }
  return best;
}

/** Photos that fit this title first, then the theme's. */
export function coverOptionsFor(title: string, category: CategoryId, width = 1200): string[] {
  const set = photoSetFor(title);
  const own = set ? set.photos.map((id) => unsplash(id, width)) : [];
  return [...own, ...coverOptions(category, width).filter((url) => !own.includes(url))];
}

/** The picture a new plan starts with: the occasion's photo if there is one, else the theme's. */
export function defaultCoverFor(title: string, category: CategoryId): string {
  const set = photoSetFor(title);
  return set ? unsplash(set.photos[0]) : defaultCover(category);
}
