// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describePrice, formatKr, parseKr, priceSummary, priceView } from '../price.ts';

describe('price', () => {
  it('formats and parses kroner', () => {
    assert.equal(formatKr(250000), '2 500 kr');
    assert.equal(formatKr(24950), '249,50 kr');
    assert.equal(parseKr('2 500'), 250000);
    assert.equal(parseKr('249,50 kr'), 24950);
    assert.equal(parseKr(''), null);
    assert.equal(parseKr('abc'), null);
    assert.equal(parseKr('-5'), null);
  });

  it('splits a cost among those who pay, rounding up to whole kroner', () => {
    // 16 places, the sauna master doesn't pay → 15 share 2 500 kr.
    const s = priceSummary({ mode: 'split', amountOre: 250000 }, { maxParticipants: 16, payingPlaces: 8, nonPayingPlaces: 1 });
    assert.equal(s.payersAtFull, 15);
    assert.equal(s.atFull, 16700);
    assert.equal(s.now, 31300);
  });

  it('describes a shared cost and a price per person', () => {
    const split = describePrice({ mode: 'split', amountOre: 250000 }, { maxParticipants: 16, payingPlaces: 8, nonPayingPlaces: 1 });
    assert.equal(split.headline, '167 kr per person når det er fullt');
    assert.equal(split.detail, '2 500 kr delt på 15 · 313 kr per person nå (8 betaler)');
    const each = describePrice({ mode: 'per_person', amountOre: 25000 }, { maxParticipants: 16, payingPlaces: 3, nonPayingPlaces: 1 });
    assert.equal(each.headline, '250 kr per person');
    assert.equal(each.detail, '3 750 kr totalt når det er fullt');
  });

  it('without a limit the cost is shared by those who come', () => {
    const d = describePrice({ mode: 'split', amountOre: 100000 }, { maxParticipants: null, payingPlaces: 4, nonPayingPlaces: 0 });
    assert.equal(d.headline, '1 000 kr deles på de som kommer');
    assert.equal(d.detail, '250 kr per person nå (4 betaler)');
    assert.equal(describePrice({ mode: 'per_person', amountOre: 5000 }, { maxParticipants: null, payingPlaces: 0, nonPayingPlaces: 0 }).detail, null);
  });

  it('draws a shared total: about per person, the total, and the price now and when full', () => {
    // The example from the sauna: 1 000 kr, 5 places, 4 coming.
    const v = priceView({ mode: 'split', amountOre: 100000 }, { maxParticipants: 5, payingPlaces: 4 }, true);
    assert.equal(v.amount, 'Ca. 200 kr');
    assert.equal(v.unit, 'per person');
    assert.equal(v.detail, '1 000 kr totalt · delt på 5 deltagere');
    assert.deepEqual(v.meter, { filled: 4, total: 5, now: '4 påmeldt nå: 250 kr hver', full: 'Fullt: 200 kr' });
    // Full: the price is the price, no bar.
    const full = priceView({ mode: 'split', amountOre: 100000 }, { maxParticipants: 5, payingPlaces: 5 }, true);
    assert.equal(full.amount, '200 kr');
    assert.equal(full.meter, null);
    // Nobody yet.
    assert.equal(priceView({ mode: 'split', amountOre: 100000 }, { maxParticipants: 5, payingPlaces: 0 }, true).meter?.now, 'Ingen påmeldt ennå');
  });

  it('draws a fixed price and a cost without a limit', () => {
    const fixed = priceView({ mode: 'per_person', amountOre: 25000 }, { maxParticipants: 8 });
    assert.equal(fixed.amount, '250 kr');
    assert.equal(fixed.detail, '2 000 kr totalt når det er fullt');
    assert.equal(fixed.meter, null);
    const open = priceView({ mode: 'split', amountOre: 60000 }, { maxParticipants: null, payingPlaces: 3 });
    assert.equal(open.amount, '600 kr');
    assert.equal(open.unit, 'totalt');
    assert.equal(open.detail, 'Deles på de som kommer · 200 kr hver med 3 nå');
    // A general event with places: the one who doesn't pay is not among those who share.
    const general = priceView({ mode: 'split', amountOre: 100000 }, { maxParticipants: 6, payingPlaces: 2, nonPayingPlaces: 1 });
    assert.equal(general.amount, 'Ca. 200 kr');
    assert.deepEqual(general.meter, { filled: 2, total: 5, now: '2 påmeldt nå: 500 kr hver', full: 'Fullt: 200 kr' });
  });
});
