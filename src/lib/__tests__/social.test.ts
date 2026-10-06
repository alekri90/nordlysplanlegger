// Client-side mirrors of the social rules. The database is the authority (see supabase/tests).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestGroupName } from '../groupName.ts';
import { shortNames } from '../names.ts';
import { normalizeUsername, sanitizeUsernameInput, usernameFormatProblem, usernameFromName } from '../username.ts';

describe('usernames', () => {
  it('normalizes case, @ and whitespace', () => {
    assert.equal(normalizeUsername(' @Alexander '), 'alexander');
    assert.equal(normalizeUsername('@ALEXANDER'), normalizeUsername('alexander'));
  });

  it('accepts letters, digits, underscore and dots', () => {
    for (const ok of ['alexander', 'alex.k', 'alex90', 'pokerpetter', 'a_b']) assert.equal(usernameFormatProblem(ok), null, ok);
  });

  it('rejects bad formats and reserved names', () => {
    assert.equal(usernameFormatProblem('ab'), 'too_short');
    assert.equal(usernameFormatProblem('x'.repeat(25)), 'too_long');
    assert.equal(usernameFormatProblem('alex k'), 'invalid_chars');
    assert.equal(usernameFormatProblem('.alex'), 'invalid_dots');
    assert.equal(usernameFormatProblem('al..ex'), 'invalid_dots');
    assert.equal(usernameFormatProblem('admin'), 'reserved');
    assert.equal(usernameFormatProblem('support_team'), 'reserved');
    assert.equal(usernameFormatProblem('help'), 'reserved');
  });

  it('sanitizes typing without losing case', () => {
    assert.equal(sanitizeUsernameInput('@Alex K!'), 'AlexK');
    assert.equal(sanitizeUsernameInput('bjørn'), 'bjorn');
    assert.equal(usernameFromName('Alexander Kristensen'), 'alexander');
  });
});

describe('suggestGroupName', () => {
  it('derives a short group name from the event title', () => {
    assert.equal(suggestGroupName('Poker hos Alexander'), 'Poker');
    assert.equal(suggestGroupName('Badstu med jentene'), 'Jentene');
    assert.equal(suggestGroupName('Pokerkveld'), 'Poker');
    assert.equal(suggestGroupName('Middag'), 'Middag');
  });
});

describe('shortNames', () => {
  it('uses first names, adding the last initial only when first names collide', () => {
    const names = shortNames([
      { id: 'a', name: 'Alexander Kristensen' },
      { id: 'b', name: 'alexander berg' },
      { id: 'c', name: 'Marius Holm' },
      { id: 'd', name: 'Alexander' },
    ]);
    assert.equal(names.get('a'), 'Alexander K.');
    assert.equal(names.get('b'), 'alexander B.');
    assert.equal(names.get('c'), 'Marius');
    assert.equal(names.get('d'), 'Alexander');
  });
  it('counts the same person once', () => {
    const names = shortNames([{ id: 'a', name: 'Ida Hansen' }, { id: 'a', name: 'Ida Hansen' }]);
    assert.equal(names.get('a'), 'Ida');
  });
});
