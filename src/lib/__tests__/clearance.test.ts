// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ClearanceDraft } from '../../data/types.ts';
import { clearanceSummary, firstEventInput, groupByWeek, isoWeek, nextEventInput, okDates } from '../clearance.ts';

const draft: ClearanceDraft = {
  title: 'Badstu',
  category: 'sauna',
  coverImageUrl: 'https://x/cover.jpg',
  timeHint: 'exact',
  startTime: '18:00',
  memberIds: ['u1', 'u2'],
  guestIds: ['g-old'],
  guestNames: ['Per'],
  saveAsGroupName: 'Badstugjengen',
  location: { name: 'Sørenga' },
  maxParticipants: 10,
  price: { mode: 'split', amountOre: 250000 },
};

const days = [
  { date: '2030-01-15', ok: true },
  { date: '2030-01-08', ok: true },
  { date: '2030-01-10', ok: false },
];

describe('clearance', () => {
  it('summarises the answer', () => {
    assert.deepEqual(okDates(days), ['2030-01-08', '2030-01-15']);
    assert.equal(clearanceSummary(days, false), 'Venter på svar');
    assert.equal(clearanceSummary(days, true), '2 av 3 dager passer');
    assert.equal(clearanceSummary(days.map((d) => ({ ...d, ok: true })), true), 'Alle dagene passer');
    assert.equal(clearanceSummary([{ date: '2030-01-08', ok: true }], true), 'Dagen passer');
    assert.equal(clearanceSummary(days.map((d) => ({ ...d, ok: false })), true), 'Ingen av dagene passet');
  });

  it('one day that works becomes a fixed date; several can be a poll for the group', () => {
    const one = firstEventInput(draft, ['2030-01-08'], 'poll');
    assert.equal(one.dateMode, 'fixed');
    assert.equal(one.fixedDate, '2030-01-08');
    const poll = firstEventInput(draft, ['2030-01-08', '2030-01-15'], 'poll');
    assert.equal(poll.dateMode, 'poll');
    assert.deepEqual(poll.optionDates, ['2030-01-08', '2030-01-15']);
    assert.deepEqual(poll.guestNames, ['Per']);
    assert.equal(poll.location?.name, 'Sørenga');
  });

  it('groups the days by week for the key person', () => {
    assert.equal(isoWeek('2030-01-01'), 1);
    assert.equal(isoWeek('2029-12-31'), 1, 'a Monday in the first week of the next year');
    assert.equal(isoWeek('2027-01-01'), 53);
    assert.deepEqual(groupByWeek(['2030-01-15', '2030-01-08', '2030-01-10']), [
      { label: 'Uke 2', dates: ['2030-01-08', '2030-01-10'] },
      { label: 'Uke 3', dates: ['2030-01-15'] },
    ]);
  });

  it('one event per day reuses the guests and group made by the first', () => {
    const first = firstEventInput(draft, ['2030-01-08', '2030-01-15'], 'each');
    assert.equal(first.fixedDate, '2030-01-08');
    const next = nextEventInput(draft, '2030-01-15', { groupId: 'g-new', guests: [{ guestId: 'g-per' }] });
    assert.equal(next.fixedDate, '2030-01-15');
    assert.equal(next.groupId, 'g-new');
    assert.deepEqual(next.guestIds, ['g-old', 'g-per']);
    assert.deepEqual(next.guestNames, []);
    assert.equal(next.saveAsGroupName, null);
  });
});
