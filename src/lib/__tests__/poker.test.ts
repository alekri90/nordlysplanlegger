// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { settlePoker } from '../poker.ts';

describe('poker settlement', () => {
  const kr = (n: number) => n * 100;

  it('the pot is buy-ins × buy-in, and those who are down pay those who are up', () => {
    const s = settlePoker(
      [
        { id: 'a', name: 'Anna', buyIns: 1, cashOutOre: kr(600) },
        { id: 'b', name: 'Bo', buyIns: 2, cashOutOre: 0 },
        { id: 'c', name: 'Cia', buyIns: 1, cashOutOre: kr(200) },
      ],
      kr(200),
    );
    assert.deepEqual([s.potOre, s.paidOutOre, s.differenceOre, s.complete], [kr(800), kr(800), 0, true]);
    assert.deepEqual(s.nets.map((n) => [n.name, n.netOre]), [['Anna', kr(400)], ['Cia', 0], ['Bo', -kr(400)]]);
    assert.deepEqual(s.transfers.map((t) => `${t.from}→${t.to} ${t.amountOre / 100}`), ['Bo→Anna 400']);
  });

  it('splits one loser across several winners with few transfers', () => {
    const s = settlePoker(
      [
        { id: 'a', name: 'Anna', buyIns: 1, cashOutOre: kr(300) },
        { id: 'b', name: 'Bo', buyIns: 1, cashOutOre: kr(250) },
        { id: 'c', name: 'Cia', buyIns: 2, cashOutOre: kr(250) },
      ],
      kr(200),
    );
    assert.deepEqual(s.transfers.map((t) => `${t.from}→${t.to} ${t.amountOre / 100}`), ['Cia→Anna 100', 'Cia→Bo 50']);
  });

  it('waits with transfers until everyone is counted and the pot adds up', () => {
    const open = settlePoker([{ id: 'a', name: 'Anna', buyIns: 1, cashOutOre: null }, { id: 'b', name: 'Bo', buyIns: 1, cashOutOre: kr(400) }], kr(200));
    assert.deepEqual([open.complete, open.transfers.length], [false, 0]);
    const off = settlePoker([{ id: 'a', name: 'Anna', buyIns: 1, cashOutOre: kr(100) }, { id: 'b', name: 'Bo', buyIns: 1, cashOutOre: kr(250) }], kr(200));
    assert.deepEqual([off.complete, off.differenceOre, off.transfers.length], [true, kr(50), 0]);
  });
});
