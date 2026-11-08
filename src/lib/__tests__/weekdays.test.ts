// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateRange, hasWholeWeekday, toggleWeekday } from '../dates.ts';

// January 2030 starts on a Tuesday (weekday 1, Monday = 0).
const jan = dateRange('2030-01-01', '2030-01-31');

describe('weekday quick picks', () => {
  it('adds every Tuesday and Thursday, and keeps days already chosen', () => {
    let chosen = ['2030-01-04'];
    chosen = toggleWeekday(chosen, 1, jan);
    chosen = toggleWeekday(chosen, 3, jan);
    assert.deepEqual(chosen, ['2030-01-01', '2030-01-03', '2030-01-04', '2030-01-08', '2030-01-10', '2030-01-15', '2030-01-17', '2030-01-22', '2030-01-24', '2030-01-29', '2030-01-31']);
    assert.equal(hasWholeWeekday(chosen, 1, jan), true);
    assert.equal(hasWholeWeekday(chosen, 4, jan), false, 'one Friday is not all Fridays');
  });

  it('removes them again, leaving the rest', () => {
    const chosen = toggleWeekday(toggleWeekday(['2030-01-04'], 1, jan), 1, jan);
    assert.deepEqual(chosen, ['2030-01-04']);
    assert.equal(hasWholeWeekday([], 1, []), false, 'nothing to pick');
  });
});
