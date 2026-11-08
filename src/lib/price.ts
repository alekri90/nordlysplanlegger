/**
 * Price on an event, shown to participants. Payment happens outside the app.
 *
 * - `split`: a cost that is shared (e.g. renting the sauna), divided among those who pay a share.
 * - `per_person`: a fixed price for each person.
 *
 * Some people have a place but don't pay a share (the sauna master). The server counts them:
 * `payingPlaces` and `nonPayingPlaces` are places in use right now.
 *
 * Amounts are in øre (integers). Shares round *up* to whole kroner so the total always covers
 * the cost. Self-contained so it runs in the Node test runner.
 */

export type PriceMode = 'split' | 'per_person';

export interface Price {
  mode: PriceMode;
  /** split: the total · per_person: what each person pays. */
  amountOre: number;
}

export interface PriceCounts {
  maxParticipants?: number | null;
  payingPlaces?: number | null;
  nonPayingPlaces?: number | null;
}

/** Whole kroner, rounded up, back in øre. */
export const roundUpToKroner = (ore: number) => Math.ceil(ore / 100) * 100;

export function sharePerPerson(price: Price, payers: number): number {
  if (price.mode === 'per_person') return price.amountOre;
  return roundUpToKroner(price.amountOre / Math.max(1, payers));
}

export interface PriceSummary {
  /** Per person when every place is taken. Null without a limit. */
  atFull: number | null;
  /** Per person with the people who have a place right now. */
  now: number;
  /** split: the cost · per_person: the total when full (null without a limit). */
  total: number | null;
  payersAtFull: number | null;
  payersNow: number;
}

export function priceSummary(price: Price, c: PriceCounts): PriceSummary {
  const payersNow = c.payingPlaces ?? 0;
  const payersAtFull = c.maxParticipants ? Math.max(1, c.maxParticipants - (c.nonPayingPlaces ?? 0)) : null;
  return {
    atFull: payersAtFull === null ? null : sharePerPerson(price, payersAtFull),
    now: sharePerPerson(price, payersNow),
    total: price.mode === 'split' ? price.amountOre : payersAtFull === null ? null : price.amountOre * payersAtFull,
    payersAtFull,
    payersNow,
  };
}

/** "2 500 kr" (space as thousands separator, no decimals unless there are øre). */
export function formatKr(ore: number): string {
  const kr = ore / 100;
  const [int, dec] = (Number.isInteger(kr) ? String(kr) : kr.toFixed(2)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${dec ? `,${dec}` : ''} kr`;
}

/** What someone typed ("2500", "2 500", "249,50", "250 kr") in øre. Null when empty or invalid. */
export function parseKr(text: string): number | null {
  const clean = text.replace(/\s|kr/gi, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) : null;
}

/**
 * The price in words:
 * - per person: "250 kr per person" + "4 000 kr totalt når det er fullt"
 * - shared: "157 kr per person når det er fullt" + "2 500 kr delt på 16 · 313 kr per person nå (8 betaler)"
 */
export function describePrice(price: Price, c: PriceCounts): { headline: string; detail: string | null } {
  const s = priceSummary(price, c);
  if (price.mode === 'per_person') {
    return {
      headline: `${formatKr(price.amountOre)} per person`,
      detail: s.total !== null ? `${formatKr(s.total)} totalt når det er fullt` : null,
    };
  }
  const now = s.payersNow > 0 && s.payersNow !== s.payersAtFull ? `${formatKr(s.now)} per person nå (${s.payersNow} betaler)` : null;
  if (s.atFull !== null) {
    return {
      headline: `${formatKr(s.atFull)} per person når det er fullt`,
      detail: [`${formatKr(price.amountOre)} delt på ${s.payersAtFull}`, now].filter(Boolean).join(' · '),
    };
  }
  return { headline: `${formatKr(price.amountOre)} deles på de som kommer`, detail: now };
}
