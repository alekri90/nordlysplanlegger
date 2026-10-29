// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPhone, normalizePhone } from '../phone.ts';

describe('normalizePhone', () => {
  it('turns the ways people write a Norwegian number into one', () => {
    for (const raw of ['91234567', '912 34 567', '+47 912 34 567', '0047 91234567', '4791234567', '+47-912-34-567', '(+47) 91234567']) {
      assert.equal(normalizePhone(raw), '+4791234567', raw);
    }
  });

  it('keeps other countries when they have a country code', () => {
    assert.equal(normalizePhone('+46 70 123 45 67'), '+46701234567');
    assert.equal(normalizePhone('0046701234567'), '+46701234567');
  });

  it('says no to what is not a phone number', () => {
    for (const raw of ['', '   ', '1234', 'ring meg', '+0123456789', '912345678']) assert.equal(normalizePhone(raw), null, raw);
  });
});

describe('formatPhone', () => {
  it('shows Norwegian numbers the way we write them', () => {
    assert.equal(formatPhone('+4791234567'), '912 34 567');
    assert.equal(formatPhone('+46701234567'), '+46701234567');
  });
});
