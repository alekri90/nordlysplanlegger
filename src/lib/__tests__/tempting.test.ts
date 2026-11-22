// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlannerEvent } from '../../data/types.ts';
import { ACTIVITY_TYPES } from '../activities.ts';
import { defaultCover, defaultCoverFor, photoSetFor, suggestCategory } from '../categories.ts';
import { earlierPlans, featuredCards, GANG_PHOTO, GATHER_PHOTO, TEMPTING, temptingNow } from '../tempting.ts';

const ME = 'me';
const day = (iso: string) => new Date(`${iso}T12:00:00`);

function past(id: string, title: string, date: string, over: Partial<PlannerEvent> = {}): PlannerEvent {
  return {
    id,
    title,
    status: 'confirmed',
    selectedDate: date,
    createdAt: `${date}T10:00:00Z`,
    category: 'dinner',
    coverImageUrl: `https://example.com/${id}.jpg`,
    members: [{ userId: ME, status: 'attending', person: { id: ME } }],
    ...over,
  } as unknown as PlannerEvent;
}

describe('Hva frister?', () => {
  it('the three on the home screen, with our own pictures', () => {
    const cards = featuredCards();
    assert.deepEqual(
      cards.map((c) => [c.title, c.cover.split('/').pop()]),
      [
        ['Badstu og sjøbad', 'badstu-sjobad.jpg'],
        ['Pizzakveld', 'pizzakveld.jpg'],
        ['Søndagstur', 'sondagstur.jpg'],
      ],
    );
    // A plan started from a card gets the same picture by default.
    for (const c of cards) assert.equal(defaultCoverFor(c.title, c.category), c.cover);
    assert.ok(GATHER_PHOTO.endsWith('/samle.jpg') && GANG_PHOTO.endsWith('/gjeng-480.jpg'));
  });


  it('every suggestion has a picture of its own, not the catch-all', () => {
    for (const t of TEMPTING) {
      const category = t.kit ? ACTIVITY_TYPES[t.kit].category : suggestCategory(t.title);
      assert.ok(photoSetFor(t.title, t.kit) || category !== 'hangout', `${t.title} has no fitting picture`);
    }
  });

  it('includes every activity with its own steps', () => {
    const kits = new Set(TEMPTING.map((t) => t.kit).filter(Boolean));
    for (const id of Object.keys(ACTIVITY_TYPES)) assert.ok(kits.has(id as never), `${id} missing`);
  });

  it('a run looks like running, not padel', () => {
    assert.equal(photoSetFor('Løpetur', 'run')?.id, 'run');
    assert.equal(photoSetFor('Joggetur med gjengen')?.id, 'run');
  });

  it('late November: what fits the season first, nothing from summer', () => {
    const titles = temptingNow({ today: day('2026-11-22') }).map((c) => c.title);
    assert.deepEqual(titles.slice(0, 3), ['Julebord', 'Isbading', 'Pepperkakebaking']);
    for (const t of ['Stranddag', 'Båttur', 'Grillkveld', 'Halloweenfest']) assert.ok(!titles.includes(t), t);
    assert.ok(titles.includes('Aufguss'));
  });

  it('July: the summer, not Christmas', () => {
    const titles = temptingNow({ today: day('2027-07-05') }).map((c) => c.title);
    assert.ok(titles.includes('Stranddag'));
    assert.ok(!titles.includes('Julebord'));
  });

  it('never the same picture twice, and never the one already on screen', () => {
    for (const d of ['2026-11-22', '2027-01-20', '2027-04-10', '2027-07-05', '2027-10-10']) {
      const cards = temptingNow({ today: day(d), avoidPhoto: GATHER_PHOTO, limit: 50 });
      const photos = cards.map((c) => c.cover.replace(/\?.*$/, ''));
      assert.equal(new Set(photos).size, photos.length, d);
      assert.ok(!photos.includes(GATHER_PHOTO.replace(/\?.*$/, '')), d);
    }
    // The dinner party doesn't fall back to the generic picture when its first one is taken.
    const dinner = temptingNow({ avoidPhoto: GATHER_PHOTO, limit: 50 }).find((c) => c.title === 'Middagsselskap');
    assert.ok(dinner && dinner.cover !== GATHER_PHOTO && dinner.cover !== defaultCover('hangout'));
  });

  it('what you did before comes first (two at most), and nothing already planned', () => {
    const earlier = earlierPlans(
      [past('a', 'Aufguss med Kari', '2026-11-10', { activityType: 'aufguss', category: 'sauna' }), past('b', 'Taco hos Maja', '2026-10-02'), past('c', 'Quiz', '2026-09-01')],
      ME,
      '2026-11-22',
    );
    const cards = temptingNow({ earlier, planned: [{ title: 'Julebord', activityType: null }], today: day('2026-11-22') });
    assert.deepEqual(
      cards.slice(0, 2).map((c) => [c.title, !!c.again, c.kit]),
      [
        ['Aufguss med Kari', true, 'aufguss'],
        ['Taco hos Maja', true, null],
      ],
    );
    assert.ok(!cards.some((c) => c.title === 'Julebord'));
    assert.ok(cards.length <= 10);
  });

  it('an Aufguss coming up: no Aufguss card, no «Gjør igjen» Aufguss', () => {
    const earlier = earlierPlans([past('a', 'Aufguss med Lorna', '2026-11-10', { activityType: 'aufguss', category: 'sauna' })], ME, '2026-11-22');
    const cards = temptingNow({ earlier, planned: [{ title: 'Aufguss med Kari', activityType: 'aufguss' }], today: day('2026-11-22') });
    assert.ok(!cards.some((c) => c.kit === 'aufguss'), cards.map((c) => c.title).join(', '));
    // A pizza night coming up: no «Pizzakveld» either.
    const pizza = temptingNow({ planned: [{ title: 'Pizzakveld fredag', activityType: null }], today: day('2026-11-22') });
    assert.ok(!pizza.some((c) => c.title === 'Pizzakveld'));
  });

  it('earlier plans: over, not declined or cancelled, one per name', () => {
    const list = earlierPlans(
      [
        past('a', 'Badstu', '2026-11-01'),
        past('b', 'badstu ', '2026-10-01'),
        past('c', 'Kino', '2026-11-05', { members: [{ userId: ME, status: 'declined', person: { id: ME } }] as never }),
        past('d', 'Bowling', '2026-11-06', { status: 'cancelled' }),
        past('e', 'Padel', '2026-12-01'),
      ],
      ME,
      '2026-11-22',
    );
    assert.deepEqual(
      list.map((e) => e.id),
      ['a'],
    );
  });
});
