// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { spontaneousTimes, timesByPartOfDay } from '../spontaneous.ts';

const at = (h: number, m: number) => new Date(2030, 4, 10, h, m);

describe('spontaneous times', () => {
  it('tomorrow is the whole day, every half hour', () => {
    const times = spontaneousTimes('tomorrow', at(22, 0));
    assert.equal(times.length, 48);
    assert.equal(times[0], '00:00');
    assert.equal(times[47], '23:30');
  });
  it('today is all that is left of it, at least half an hour ahead', () => {
    const times = spontaneousTimes('today', at(9, 10));
    assert.equal(times[0], '10:00');
    assert.equal(times.at(-1), '23:30');
    assert.equal(spontaneousTimes('today', at(8, 50))[0], '09:30');
  });
  it('late in the evening there is nothing left today', () => {
    assert.deepEqual(spontaneousTimes('today', at(23, 20)), []);
    assert.deepEqual(spontaneousTimes('today', at(22, 50)), ['23:30']);
  });
  it('every time lands in exactly one part of the day', () => {
    const parts = timesByPartOfDay(spontaneousTimes('tomorrow'));
    assert.deepEqual(parts.map((p) => p.label), ['Morgen', 'Dag', 'Kveld', 'Natt']);
    assert.equal(parts.flatMap((p) => p.times).length, 48);
  });
  it('empty parts are left out', () => {
    assert.deepEqual(timesByPartOfDay(spontaneousTimes('today', at(19, 0))).map((p) => p.label), ['Kveld']);
  });
});
