// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { conflictsFor, conflictSummary, conflictTime, toBusyItems, type RawCalendarEvent } from '../calendarConflicts.ts';

const DAY = '2030-05-10';
const raw = (from: string, to: string, over: Partial<RawCalendarEvent> = {}): RawCalendarEvent => ({ title: 'Tannlege', startDate: new Date(`${DAY}T${from}:00`), endDate: new Date(`${DAY}T${to}:00`), ...over });
const busy = (...events: RawCalendarEvent[]) => toBusyItems(events, { c1: 'Jobb' });
const titles = (items: { title: string }[]) => items.map((i) => i.title);

describe('what counts as busy', () => {
  it('leaves out all-day, free and cancelled entries', () => {
    assert.equal(busy(raw('10:00', '11:00', { allDay: true })).length, 0, 'birthdays and holidays');
    assert.equal(busy(raw('10:00', '11:00', { availability: 'free' })).length, 0);
    assert.equal(busy(raw('10:00', '11:00', { status: 'canceled' })).length, 0);
    assert.equal(busy(raw('10:00', '11:00', { availability: 'busy' })).length, 1);
    assert.equal(busy(raw('10:00', '11:00', { availability: 'tentative' })).length, 1);
  });
  it('names the calendar, and copes with no title', () => {
    const [item] = busy(raw('10:00', '11:00', { title: ' ', calendarId: 'c1' }));
    assert.equal(item.title, 'Opptatt');
    assert.equal(item.calendar, 'Jobb');
  });
  it('reads dates that come as text', () => {
    const [item] = busy({ title: 'x', startDate: new Date(`${DAY}T10:00:00`).toISOString(), endDate: new Date(`${DAY}T11:00:00`).toISOString() });
    assert.equal(conflictTime(item, DAY), 'kl. 10:00–11:00');
  });
});

describe('what collides', () => {
  const items = busy(raw('09:00', '10:00', { title: 'Morgen' }), raw('16:00', '18:00', { title: 'Ettermiddag' }), raw('20:00', '21:00', { title: 'Kveld' }));

  it('a set time counts for three hours, as in the calendar', () => {
    assert.deepEqual(titles(conflictsFor(items, { date: DAY, startTime: '18:00', timeHint: 'exact' })), ['Kveld']);
  });
  it('ending as you start is no collision', () => {
    assert.deepEqual(titles(conflictsFor(items, { date: DAY, startTime: '10:00' })), []);
  });
  it('«etter kl. 18» and «på dagtid» look at that part of the day', () => {
    assert.deepEqual(titles(conflictsFor(items, { date: DAY, timeHint: 'evening' })), ['Kveld']);
    assert.deepEqual(titles(conflictsFor(items, { date: DAY, timeHint: 'daytime' })), ['Morgen', 'Ettermiddag']);
  });
  it('no time looks at the whole day', () => {
    assert.equal(conflictsFor(items, { date: DAY, timeHint: 'any' }).length, 3);
    assert.equal(conflictsFor(items, { date: '2030-05-11', timeHint: 'any' }).length, 0);
  });
  it('the arrangement never collides with itself, wherever the link is', () => {
    const own = busy(raw('18:00', '21:00', { notes: 'Ta med mat\n\nhttps://x.test/event/ev1#aaaaaaaa' }), raw('18:00', '21:00', { url: 'https://x.test/event/ev1' }));
    assert.equal(conflictsFor(own, { date: DAY, startTime: '18:00', eventId: 'ev1' }).length, 0);
    assert.equal(conflictsFor(own, { date: DAY, startTime: '18:00', eventId: 'ev2' }).length, 2, 'another arrangement is a real collision');
  });
  it('a night shift counts on both days', () => {
    const night = busy({ title: 'Nattevakt', startDate: new Date(`${DAY}T22:00:00`), endDate: new Date('2030-05-11T06:00:00') });
    assert.equal(conflictsFor(night, { date: '2030-05-11', timeHint: 'any' }).length, 1);
    assert.equal(conflictTime(night[0], DAY), 'fra kl. 22:00');
    assert.equal(conflictTime(night[0], '2030-05-11'), 'til kl. 06:00');
  });
  it('something longer than the day says so', () => {
    const trip = busy({ title: 'Tur', startDate: new Date('2030-05-09T16:00:00'), endDate: new Date('2030-05-12T12:00:00') });
    assert.equal(conflictTime(trip[0], DAY), 'hele dagen');
  });
});

describe('the line', () => {
  it('one thing: when. Several: how many', () => {
    const one = busy(raw('18:00', '20:00'));
    const two = busy(raw('18:00', '20:00'), raw('19:00', '20:00'));
    assert.equal(conflictSummary(one, { date: DAY, startTime: '18:00' }), 'Du har noe i kalenderen kl. 18:00–20:00');
    assert.equal(conflictSummary(two, { date: DAY, startTime: '18:00' }), 'Du har 2 ting i kalenderen');
    assert.equal(conflictSummary(two, { date: DAY, timeHint: 'any' }), 'Du har 2 ting i kalenderen denne dagen');
  });
});
