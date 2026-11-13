// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maxParticipantsFor, matchActivities, venueIn, weekdaysIn } from '../activities.ts';
import { describeSharedPrice, sharedPrice } from '../price.ts';
import { dateStatus, dateStatusLabel, requestCounts, requestSummary, setAll, whoCan } from '../roleRequest.ts';
import type { RoleRequestDate } from '../../data/types';

describe('activity types', () => {
  it('suggests Aufguss while typing', () => {
    for (const t of ['auf', 'Aufguss', 'aufguss med jentene', 'badstue', 'Badstu tirsdag', 'sauna']) {
      assert.deepEqual(matchActivities(t).map((a) => a.id), ['aufguss'], t);
    }
    for (const t of ['', 'au', 'badetur', 'Fotball', 'Kortkveld', 'Pokemon-kveld']) assert.deepEqual(matchActivities(t), [], t);
  });

  it('suggests the other types while typing', () => {
    const cases: [string, string][] = [['Pokerkveld', 'poker'], ['Middag hos oss', 'dinner'], ['Løpetur fredag', 'run'], ['Knytteknute', 'potluck'], ['Padel', 'racket'], ['Tennis med Ola', 'racket'], ['Fjelltur til Kolsås', 'hike']];
    for (const [t, id] of cases) assert.deepEqual(matchActivities(t).map((a) => a.id), [id], t);
  });

  it('reads weekdays and a saved venue from the text', () => {
    assert.deepEqual(weekdaysIn('Aufguss tirsdager og torsdager'), [1, 3]);
    assert.deepEqual(weekdaysIn('Aufguss'), []);
    const venues = [{ name: 'Sørenga badstue' }, { name: 'KOK Oslo' }];
    assert.equal(venueIn('Aufguss på Sørenga', venues)?.name, 'Sørenga badstue');
    assert.equal(venueIn('Aufguss', venues), null);
  });

  it('the sauna master needs room in the sauna, but no participant place', () => {
    assert.equal(maxParticipantsFor(12, 1), 11);
    assert.equal(maxParticipantsFor(null, 1), null);
  });
});

describe('shared price', () => {
  it('is split on the participant places, as an estimate until full', () => {
    const s = sharedPrice(250000, { maxParticipants: 10, payingPlaces: 4 });
    assert.deepEqual([s.sharers, s.perPersonOre, s.estimate], [10, 25000, true]);
    assert.deepEqual(s.now, { sharers: 4, perPersonOre: 62500 });
    const full = sharedPrice(250000, { maxParticipants: 10, payingPlaces: 10 });
    assert.deepEqual([full.perPersonOre, full.estimate, full.now], [25000, false, null]);
    assert.equal(sharedPrice(100000, { maxParticipants: 3, payingPlaces: 0 }).perPersonOre, 33400, 'rounded up to whole kroner');
  });

  it('says clearly that it is an estimate', () => {
    const d = describeSharedPrice(250000, { maxParticipants: 10, payingPlaces: 1 });
    assert.equal(d.headline, 'Ca. 250 kr per person');
    assert.equal(d.detail, '2 500 kr totalt · delt på 10 deltagere · estimat ved fulle plasser');
    assert.equal(d.now, 'Med 1 påmeldt nå: 2 500 kr per person');
  });
});

describe('role requests', () => {
  const day = (over: Partial<RoleRequestDate> = {}): RoleRequestDate => ({ id: 'd', date: '2030-02-05', eventId: 'e', assignedCandidateId: null, eventCancelled: false, answers: [{ candidateId: 'ola', answer: null }], ...over });
  const people = [
    { id: 'ola', userId: null, name: 'Ola Mester', token: 't1', reply: null, answeredAt: null },
    { id: 'kari', userId: null, name: 'Kari', token: 't2', reply: null, answeredAt: null },
  ];

  it('gives each date a status like the database', () => {
    assert.equal(dateStatus(day()), 'pending');
    assert.equal(dateStatus(day({ answers: [{ candidateId: 'ola', answer: false }] })), 'unavailable');
    assert.equal(dateStatus(day({ answers: [{ candidateId: 'ola', answer: false }, { candidateId: 'kari', answer: null }] })), 'pending');
    assert.equal(dateStatus(day({ answers: [{ candidateId: 'ola', answer: true }, { candidateId: 'kari', answer: true }] })), 'choose');
    assert.equal(dateStatus(day({ assignedCandidateId: 'ola' })), 'confirmed');
    assert.equal(dateStatus(day({ assignedCandidateId: 'ola', eventCancelled: true })), 'cancelled');
  });

  it('shows who can, and sums up the request', () => {
    const both = day({ answers: [{ candidateId: 'ola', answer: true }, { candidateId: 'kari', answer: true }] });
    assert.deepEqual(whoCan(both, people).map((p) => p.id), ['ola', 'kari']);
    assert.equal(dateStatusLabel('choose', { roleLabel: 'Badstumester', canCount: 2 }), '2 kan – velg');
    assert.equal(dateStatusLabel('confirmed', { roleLabel: 'Badstumester', name: 'Ola Mester' }), 'Badstumester: Ola');
    const r = { status: 'open' as const, dates: [day({ assignedCandidateId: 'ola' }), both, day(), day({ eventCancelled: true })] };
    assert.deepEqual(requestCounts(r), { confirmed: 1, choose: 1, unavailable: 0, pending: 1, cancelled: 1, total: 4 });
    assert.equal(requestSummary(r), '1 av 3 bekreftet · 1 å velge · 1 venter');
  });

  it('marks many dates at once, never taken or cancelled ones', () => {
    const dates = [
      { id: 'a', taken: false, cancelled: false },
      { id: 'b', taken: true, cancelled: false },
      { id: 'c', taken: false, cancelled: true },
      { id: 'd', taken: false, cancelled: false },
    ];
    assert.deepEqual(setAll(dates, true), { a: true, d: true });
    assert.deepEqual(setAll(dates, false, ['d']), { d: false });
  });
});
