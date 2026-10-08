// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestCategory } from '../categories.ts';
import { addDays, countWeekends, dateRange, formatDayMonth, formatLong, periodLabelFor, weekday } from '../dates.ts';
import { rankDateOptions, responseProgress } from '../ranking.ts';

type M = Parameters<typeof rankDateOptions>[1][number];
const member = (id: string, status: M['status'], unavailable: string[] = [], role: M['role'] = 'guest'): M => ({ id, status, role, unavailableOptionIds: unavailable });

describe('rankDateOptions', () => {
  const options = [
    { id: 'a', date: '2026-10-09' },
    { id: 'b', date: '2026-10-10' },
    { id: 'c', date: '2026-10-17' },
  ];

  it('ranks by most available, then earliest date', () => {
    const scores = rankDateOptions(options, [
      member('org', 'responded', [], 'organizer'),
      member('m1', 'responded', ['a']),
      member('m2', 'responded', ['a', 'b']),
      member('m3', 'invited'),
    ]);
    assert.deepEqual(scores.map((s) => s.option.id), ['c', 'b', 'a']);
    assert.equal(scores[0].isBest, true);
    assert.equal(scores[0].available, 3);
    assert.equal(scores[0].responded, 3);
    assert.equal(scores[0].invited, 4);
    assert.equal(scores[1].isBest, false);
  });

  it('breaks ties by the earliest date', () => {
    const scores = rankDateOptions(options, [member('org', 'responded', [], 'organizer'), member('m1', 'responded')]);
    assert.equal(scores[0].option.id, 'a');
  });

  it('ignores marks from people who have not answered', () => {
    const scores = rankDateOptions(options, [member('org', 'responded', [], 'organizer'), member('m1', 'opened', ['c'])]);
    assert.equal(scores.find((s) => s.option.id === 'c')!.unavailable, 0);
  });

  it('flags everyoneCan only when everyone answered', () => {
    const partial = rankDateOptions(options, [member('org', 'responded', [], 'organizer'), member('m1', 'invited')]);
    assert.equal(partial[0].everyoneCan, false);
    const all = rankDateOptions(options, [member('org', 'responded', [], 'organizer'), member('m1', 'responded', ['a'])]);
    assert.equal(all[0].option.id, 'b');
    assert.equal(all[0].everyoneCan, true);
    assert.equal(all.find((s) => s.option.id === 'a')!.everyoneCan, false);
  });

  it('has no best date when nobody can', () => {
    const scores = rankDateOptions([{ id: 'a', date: '2026-10-09' }], [member('m1', 'responded', ['a'])]);
    assert.equal(scores[0].isBest, false);
  });

  it('reports progress', () => {
    assert.deepEqual(responseProgress([member('o', 'invited', [], 'organizer'), member('a', 'responded'), member('b', 'declined'), member('c', 'opened')]), {
      responded: 3,
      invited: 4,
      pending: 1,
    });
  });
});

describe('dates', () => {
  it('handles weekdays monday-first', () => {
    assert.equal(weekday('2026-10-05'), 0); // Monday
    assert.equal(weekday('2026-10-10'), 5); // Saturday
    assert.equal(weekday('2026-10-04'), 6); // Sunday
  });

  it('adds days across months and years', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-29', -1), '2026-03-28'); // DST weekend in Norway
  });

  it('formats Norwegian dates', () => {
    assert.equal(formatDayMonth('2026-10-11'), '11. oktober');
    assert.equal(formatLong('2026-10-10'), 'Lørdag 10. oktober');
  });

  it('builds ranges and period labels', () => {
    assert.equal(dateRange('2026-10-30', '2026-11-02').length, 4);
    assert.equal(periodLabelFor(['2026-10-09', '2026-10-24']), 'Oktober');
    assert.equal(periodLabelFor(['2026-10-30', '2026-11-06']), 'Oktober–november');
    assert.equal(periodLabelFor([]), null);
  });

  it('counts weekends (fri–sun of one week = one weekend)', () => {
    assert.equal(countWeekends(['2026-10-09', '2026-10-10', '2026-10-16', '2026-10-17', '2026-10-24']), 3);
  });
});

describe('suggestCategory', () => {
  it('maps titles to categories', () => {
    assert.equal(suggestCategory('Badstu med jentene'), 'sauna');
    assert.equal(suggestCategory('Kortkveld hos Marius'), 'games');
    assert.equal(suggestCategory('Middag'), 'dinner');
    assert.equal(suggestCategory('Padel'), 'sport');
    assert.equal(suggestCategory('Middag og kortspill'), 'dinner');
    assert.equal(suggestCategory('Noe helt annet'), 'hangout');
  });

  it('knows the newer themes, and resolves ties by category order', () => {
    const cases: [string, string][] = [
      ['Filmkveld', 'movie'],
      ['Quiz på puben', 'quiz'],
      ['Bursdag til Ida', 'birthday'],
      ['Julebord', 'christmas'],
      ['Julemiddag med familien', 'family'],
      ['FIFA-kveld', 'gaming'],
      ['Badetur', 'beach'],
      ['Badstu', 'sauna'],
      ['Skitur til Hemsedal', 'ski'],
      ['Fjelltur', 'outdoor'],
      ['Tur til Berlin', 'travel'],
      ['Konsert i Spektrum', 'concert'],
      ['Brunsj', 'brunch'],
      ['Brettspill', 'games'],
    ];
    for (const [title, id] of cases) assert.equal(suggestCategory(title), id, title);
  });
});
