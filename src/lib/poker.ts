/**
 * Poker night: the pot and who owes whom. Payment happens outside the app; this is only the sums.
 *
 * Each player has paid `buyIns` × the buy-in into the pot and ended with `cashOutOre` (what they
 * walked away with; 0 when they busted). Net = cash out − paid in. Those who are down pay those
 * who are up, with as few transfers as possible (largest to largest).
 *
 * Amounts in øre. Self-contained so it runs in the Node test runner.
 */

export interface PokerPlayer {
  id: string;
  name: string;
  buyIns: number;
  /** null: not counted yet. */
  cashOutOre: number | null;
}

export interface PokerTransfer {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amountOre: number;
}

export interface PokerSettlement {
  /** Paid into the pot. */
  potOre: number;
  /** Counted out at the end (players with a sum). */
  paidOutOre: number;
  /** Pot minus paid out: 0 when it adds up. Only meaningful once everyone is counted. */
  differenceOre: number;
  /** Everyone has a cash-out sum. */
  complete: boolean;
  nets: { id: string; name: string; netOre: number }[];
  transfers: PokerTransfer[];
}

export function settlePoker(players: PokerPlayer[], buyInOre: number): PokerSettlement {
  const potOre = players.reduce((sum, p) => sum + p.buyIns * buyInOre, 0);
  const counted = players.filter((p) => p.cashOutOre !== null);
  const paidOutOre = counted.reduce((sum, p) => sum + (p.cashOutOre ?? 0), 0);
  const complete = players.length > 0 && counted.length === players.length;
  const nets = counted
    .map((p) => ({ id: p.id, name: p.name, netOre: (p.cashOutOre ?? 0) - p.buyIns * buyInOre }))
    .sort((a, b) => b.netOre - a.netOre || a.name.localeCompare(b.name));

  const transfers: PokerTransfer[] = [];
  // Only settle once the pot adds up — otherwise someone would be paid money that isn't there.
  if (complete && potOre === paidOutOre) {
    const up = nets.filter((n) => n.netOre > 0).map((n) => ({ ...n, left: n.netOre }));
    const down = nets.filter((n) => n.netOre < 0).map((n) => ({ ...n, left: -n.netOre })).sort((a, b) => b.left - a.left);
    for (const d of down) {
      while (d.left > 0) {
        const u = up.filter((x) => x.left > 0).sort((a, b) => b.left - a.left)[0];
        if (!u) break;
        const amount = Math.min(d.left, u.left);
        transfers.push({ fromId: d.id, from: d.name, toId: u.id, to: u.name, amountOre: amount });
        d.left -= amount;
        u.left -= amount;
      }
    }
  }
  return { potOre, paidOutOre, differenceOre: potOre - paidOutOre, complete, nets, transfers };
}
