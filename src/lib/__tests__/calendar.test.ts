// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlannerEvent } from '../../data/types.ts';
import { calendarEntries, calendarFingerprint, calendarLink, eventIdFromNotes, planCalendarSync, type CalendarEntry } from '../calendarPlan.ts';

const ME = 'aaaaaaaa-1111-2222-3333-444444444444';
const OTHER = 'bbbbbbbb-1111-2222-3333-444444444444';
const WEB = 'https://planlegger.test';
const TODAY = '2030-05-10';

function event(over: Partial<PlannerEvent> & { myStatus?: string; unavailable?: string[]; cohost?: boolean; organizerId?: string } = {}): PlannerEvent {
  const { myStatus = 'attending', unavailable = [], cohost, organizerId = OTHER, ...rest } = over;
  return {
    id: 'ev1',
    title: 'Grilling',
    status: 'confirmed',
    selectedDate: '2030-05-20',
    selectedOptionId: 'o1',
    timeHint: 'exact',
    startTime: '19:00',
    organizer: { id: organizerId, name: 'Oda' },
    members: [{ id: 'm1', userId: ME, person: { id: ME, name: 'Meg' }, role: organizerId === ME ? 'organizer' : 'guest', status: myStatus, unavailableOptionIds: unavailable, isCohost: cohost }],
    ...rest,
  } as unknown as PlannerEvent;
}
const entriesOf = (...events: PlannerEvent[]) => calendarEntries(events, ME, TODAY, WEB);
const entry = (over: Partial<CalendarEntry> = {}): CalendarEntry => ({ ...entriesOf(event())[0], ...over });

describe('which arrangements go in the calendar', () => {
  it('those you are going to, and those you host', () => {
    assert.equal(entriesOf(event()).length, 1);
    assert.equal(entriesOf(event({ myStatus: 'responded' })).length, 1);
    assert.equal(entriesOf(event({ organizerId: ME, myStatus: 'invited' })).length, 1);
    assert.equal(entriesOf(event({ cohost: true, myStatus: 'invited' })).length, 1);
  });
  it('not what you have not answered, said no to, or are waiting for a place on', () => {
    for (const myStatus of ['invited', 'opened', 'declined', 'waitlisted']) assert.equal(entriesOf(event({ myStatus })).length, 0, myStatus);
    assert.equal(entriesOf(event({ myStatus: 'responded', unavailable: ['o1'] })).length, 0, 'said they cannot that day');
  });
  it('not what is cancelled, past or without a date', () => {
    assert.equal(entriesOf(event({ status: 'cancelled' })).length, 0);
    assert.equal(entriesOf(event({ status: 'polling', selectedDate: null })).length, 0);
    assert.equal(entriesOf(event({ selectedDate: '2030-05-09' })).length, 0);
    assert.equal(entriesOf(event({ selectedDate: TODAY })).length, 1, 'today still counts');
  });
  it('«etter kl. 18» starts at 18, and no time is all day', () => {
    assert.equal(entriesOf(event({ startTime: null, timeHint: 'evening' }))[0].startTime, '18:00');
    assert.equal(entriesOf(event({ startTime: null, timeHint: 'any' }))[0].startTime, null);
  });
});

describe('finding our own entries again', () => {
  it('reads the arrangement back from the notes, wherever the link is', () => {
    const notes = `Husk grillkull\n\n${calendarLink(WEB, 'ev-1', ME)}`;
    assert.equal(eventIdFromNotes(notes, ME), 'ev-1');
  });
  it('leaves other people, and anything else, alone', () => {
    assert.equal(eventIdFromNotes(calendarLink(WEB, 'ev-1', OTHER), ME), null, 'someone else in a shared calendar');
    assert.equal(eventIdFromNotes(`${WEB}/event/ev-1`, ME), null, 'a link pasted without a mark');
    assert.equal(eventIdFromNotes('Tannlege kl. 10', ME), null);
    assert.equal(eventIdFromNotes(null, ME), null);
  });
});

describe('what to do in the calendar', () => {
  const synced = (e: CalendarEntry) => ({ [e.eventId]: calendarFingerprint(e) });

  it('a new arrangement is added', () => {
    const plan = planCalendarSync([entry()], {}, {});
    assert.equal(plan.create.length, 1);
  });
  it('nothing changed, nothing done', () => {
    const e = entry();
    assert.deepEqual(planCalendarSync([e], synced(e), { ev1: 'x' }), { create: [], update: [], remove: [], forget: [] });
  });
  it('a new date or time updates the same entry', () => {
    const plan = planCalendarSync([entry({ date: '2030-05-21' })], synced(entry()), { ev1: 'x' });
    assert.deepEqual(plan.update.map((u) => u.existing), ['x']);
    assert.equal(plan.create.length, 0);
  });
  it('cancelled or no longer going removes it', () => {
    const plan = planCalendarSync([], synced(entry()), { ev1: 'x' });
    assert.deepEqual(plan.remove, [{ eventId: 'ev1', existing: 'x' }]);
  });
  it('deleted by hand: stays deleted, until the arrangement changes', () => {
    const e = entry();
    assert.equal(planCalendarSync([e], synced(e), {}).create.length, 0);
    assert.equal(planCalendarSync([entry({ date: '2030-05-21' })], synced(e), {}).create.length, 1);
  });
  it('new phone: finds what is already there instead of adding it twice', () => {
    const plan = planCalendarSync([entry()], {}, { ev1: 'x' });
    assert.equal(plan.create.length, 0);
    assert.equal(plan.update.length, 1);
  });
  it('new phone: what was cancelled in the meantime still goes', () => {
    assert.equal(planCalendarSync([], {}, { gone: 'x' }).remove.length, 1);
  });
  it('past arrangements are forgotten, not deleted', () => {
    const plan = planCalendarSync([], synced(entry()), {});
    assert.deepEqual(plan.forget, ['ev1']);
    assert.equal(plan.remove.length, 0);
  });
});
