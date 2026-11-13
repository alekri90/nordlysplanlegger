import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Icon, Input, PressableScale, Text, useToast } from '@/components/ui';
import type { EventKit, KitPokerRow, KitRef, PlannerEvent } from '@/data/types';
import { useKitActions } from '@/data/hooks';
import { haptics } from '@/lib/haptics';
import { settlePoker } from '@/lib/poker';
import { formatKr, parseKr } from '@/lib/price';
import { spacing, useColors } from '@/theme';

import { kitError } from './kitShared';

/**
 * Poker: the buy-in and the pot before, the score and who owes whom after. The organizer keeps
 * the score (rebuys and what each player ended with); everyone in the game sees the settlement.
 */
export function KitPoker({ kit, kitRef, event }: { kit: EventKit; kitRef: KitRef; event: PlannerEvent | null }) {
  const toast = useToast();
  const actions = useKitActions(kitRef);
  const buyIn = event?.price?.mode === 'per_person' ? event.price.amountOre : 0;
  const players = kit.poker.map((p) => ({ id: p.memberId, name: p.name, buyIns: p.buyIns, cashOutOre: p.cashOutOre }));
  const s = settlePoker(players, buyIn);
  const coming = (event?.members ?? []).filter((m) => (m.status === 'attending' || m.role === 'organizer') && !kit.poker.some((p) => p.memberId === m.id));

  const set = async (row: { memberId: string }, buyIns: number | null, cashOutOre: number | null) => {
    if (!event) return;
    try {
      await actions.poker.mutateAsync({ eventId: event.id, memberId: row.memberId, buyIns, cashOutOre });
    } catch (e) {
      toast({ message: kitError(e), tone: 'error' });
    }
  };

  const addEveryone = async () => {
    if (!event) return;
    haptics.light();
    try {
      for (const m of coming) await actions.poker.mutateAsync({ eventId: event.id, memberId: m.id, buyIns: 1, cashOutOre: null });
    } catch (e) {
      toast({ message: kitError(e), tone: 'error' });
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="award" size={16} color="primary" />
        <Text variant="headline" style={{ flex: 1 }}>
          Potten og oppgjør
        </Text>
      </View>
      <Text variant="footnote" color="textSecondary">
        {buyIn ? `Buy-in ${formatKr(buyIn)} per spiller. ` : 'Ingen buy-in er satt. '}
        {kit.poker.length ? `Potten er ${formatKr(s.potOre)} (${kit.poker.reduce((n, p) => n + p.buyIns, 0)} buy-ins).` : 'Spillerne føres inn når kvelden starter.'}
      </Text>

      {kit.poker.length ? (
        <View>
          {kit.poker.map((p, i) => (
            <View key={p.memberId}>
              {i ? <Divider /> : null}
              {kit.organizer && event ? (
                <EditRow row={p} buyIn={buyIn} busy={actions.poker.isPending} onSet={(b, c) => set(p, b, c)} />
              ) : (
                <ViewRow row={p} buyIn={buyIn} />
              )}
            </View>
          ))}
        </View>
      ) : null}

      {kit.organizer && event && coming.length ? (
        <Button title={kit.poker.length ? `Legg til ${coming.length} til` : `Start: legg inn ${coming.length} ${coming.length === 1 ? 'spiller' : 'spillere'}`} icon="user-plus" variant="secondary" size="sm" loading={actions.poker.isPending} onPress={addEveryone} />
      ) : null}

      {kit.poker.length && buyIn ? <Settlement s={s} /> : null}
    </Card>
  );
}

function ViewRow({ row, buyIn }: { row: KitPokerRow; buyIn: number }) {
  const net = row.cashOutOre === null ? null : row.cashOutOre - row.buyIns * buyIn;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md }}>
      <Text variant="callout" style={{ flex: 1 }}>
        {row.name}
      </Text>
      <Text variant="footnote" color="textSecondary">
        {row.buyIns} buy-in{row.buyIns === 1 ? '' : 's'}
      </Text>
      <Text variant="callout" color={net === null ? 'textTertiary' : net > 0 ? 'success' : net < 0 ? 'danger' : 'text'} style={{ minWidth: 80, textAlign: 'right' }}>
        {net === null ? '–' : `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatKr(Math.abs(net))}`}
      </Text>
    </View>
  );
}

function EditRow({ row, buyIn, busy, onSet }: { row: KitPokerRow; buyIn: number; busy: boolean; onSet: (buyIns: number | null, cashOutOre: number | null) => void }) {
  const colors = useColors();
  const [cash, setCash] = useState<string | null>(null);
  const shown = cash ?? (row.cashOutOre === null ? '' : String(row.cashOutOre / 100));
  const btn = { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center' as const, justifyContent: 'center' as const };
  const saveCash = () => {
    if (cash === null) return;
    const ore = cash.trim() ? parseKr(cash) : null;
    if (cash.trim() && ore === null) return;
    onSet(row.buyIns, ore);
    setCash(null);
  };
  return (
    <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="callout" style={{ flex: 1 }}>
          {row.name}
        </Text>
        <PressableScale disabled={busy || row.buyIns <= 1} onPress={() => onSet(row.buyIns - 1, row.cashOutOre)} accessibilityLabel={`Færre buy-ins for ${row.name}`} style={[btn, { opacity: row.buyIns <= 1 ? 0.4 : 1 }]}>
          <Icon name="minus" size={14} />
        </PressableScale>
        <Text variant="footnote" style={{ minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${row.buyIns} buy-ins`}>
          {row.buyIns} buy-in{row.buyIns === 1 ? '' : 's'}
        </Text>
        <PressableScale disabled={busy} onPress={() => onSet(row.buyIns + 1, row.cashOutOre)} accessibilityLabel={`Rebuy for ${row.name}`} style={btn}>
          <Icon name="plus" size={14} />
        </PressableScale>
        <PressableScale disabled={busy} onPress={() => onSet(null, null)} accessibilityLabel={`Fjern ${row.name}`} style={{ padding: 4 }}>
          <Icon name="x" size={16} color="textTertiary" />
        </PressableScale>
      </View>
      <Input
        placeholder={`Endte med (kr)${buyIn ? ` – betalte ${formatKr(row.buyIns * buyIn)}` : ''}`}
        value={shown}
        onChangeText={(t) => setCash(t.replace(/[^0-9 ,.]/g, ''))}
        onBlur={saveCash}
        onSubmitEditing={saveCash}
        keyboardType="decimal-pad"
        returnKeyType="done"
        accessibilityLabel={`Hva ${row.name} endte med, i kroner`}
      />
    </View>
  );
}

function Settlement({ s }: { s: ReturnType<typeof settlePoker> }) {
  if (!s.complete) {
    return (
      <Text variant="footnote" color="textSecondary">
        Oppgjøret vises når alle har fått en sluttsum (0 for dem som røk ut).
      </Text>
    );
  }
  if (s.differenceOre !== 0) {
    return (
      <Text variant="footnote" color="warning">
        Det stemmer ikke: potten er {formatKr(s.potOre)}, men sluttsummene blir {formatKr(s.paidOutOre)}. Sjekk tallene.
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <Divider />
      <Text variant="subhead">Hvem skylder hvem</Text>
      {s.transfers.length ? (
        s.transfers.map((t) => (
          <View key={`${t.fromId}-${t.toId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="callout" style={{ flex: 1 }}>
              {t.from} → {t.to}
            </Text>
            <Text variant="callout" style={{ fontWeight: '600' }}>
              {formatKr(t.amountOre)}
            </Text>
          </View>
        ))
      ) : (
        <Text variant="footnote" color="textSecondary">
          Alle gikk i null – ingen skylder noe.
        </Text>
      )}
      <Text variant="footnote" color="textSecondary">
        Betal med Vipps eller kontant – appen flytter ikke penger.
      </Text>
    </View>
  );
}
