import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Icon, Input, PressableScale, Text, useToast } from '@/components/ui';
import type { EventKit, KitRef, KitRide } from '@/data/types';
import { useKitActions } from '@/data/hooks';
import { haptics } from '@/lib/haptics';
import { spacing, useColors } from '@/theme';

import { kitError } from './kitShared';

/** Car sharing: offer seats, or hop in with someone who has room. */
export function KitRides({ kit, kitRef }: { kit: EventKit; kitRef: KitRef }) {
  const toast = useToast();
  const actions = useKitActions(kitRef);
  const mine = kit.rides.find((r) => r.mine);
  const [offering, setOffering] = useState(false);
  const [seats, setSeats] = useState(mine?.seats ?? 3);
  const [from, setFrom] = useState(mine?.from ?? '');
  const free = kit.rides.reduce((n, r) => n + Math.max(0, r.seats - r.passengers.length), 0);

  const run = async (action: 'offer' | 'cancel' | 'join' | 'leave', ride?: KitRide) => {
    try {
      haptics.light();
      await actions.ride.mutateAsync({ action, rideId: ride?.id, seats: action === 'offer' ? seats : undefined, from: action === 'offer' ? from : undefined });
      if (action === 'offer') {
        setOffering(false);
        toast({ message: 'Turen din er lagt ut', tone: 'success', icon: 'check' });
      }
      if (action === 'join') toast({ message: `Du sitter på med ${ride!.driver}`, tone: 'success', icon: 'check' });
    } catch (e) {
      toast({ message: kitError(e), tone: 'error' });
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="truck" size={16} color="primary" />
        <Text variant="headline" style={{ flex: 1 }}>
          Samkjøring
        </Text>
        {kit.rides.length ? (
          <Text variant="footnote" color={free ? 'primary' : 'textSecondary'}>
            {free ? `${free} ledig${free === 1 ? '' : 'e'} sete${free === 1 ? '' : 'r'}` : 'Fullt'}
          </Text>
        ) : null}
      </View>

      {kit.rides.map((r, i) => (
        <View key={r.id}>
          {i ? <Divider /> : null}
          <RideRow ride={r} canJoin={!!kit.me && !mine} busy={actions.ride.isPending} onAction={(a) => run(a, r)} onEdit={() => setOffering(true)} />
        </View>
      ))}
      {!kit.rides.length && !offering ? (
        <Text variant="footnote" color="textSecondary">
          Ingen har tilbudt plass ennå.
        </Text>
      ) : null}

      {kit.me ? (
        offering ? (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <SeatPicker seats={seats} onChange={setSeats} />
            <Input placeholder="Kjører fra (valgfritt)" value={from} onChangeText={(t) => setFrom(t.slice(0, 80))} accessibilityLabel="Hvor du kjører fra" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Avbryt" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setOffering(false)} />
              <Button title={mine ? 'Lagre' : 'Legg ut'} variant="ink" size="sm" style={{ flex: 1 }} loading={actions.ride.isPending} onPress={() => run('offer')} />
            </View>
          </View>
        ) : !mine ? (
          <Button title="Jeg kan kjøre" icon="plus" variant="secondary" size="sm" style={{ marginTop: spacing.sm }} onPress={() => setOffering(true)} />
        ) : null
      ) : (
        <Text variant="footnote" color="textSecondary">
          Svar på invitasjonen, så kan du tilby plass eller sitte på.
        </Text>
      )}
    </Card>
  );
}

function RideRow({ ride, canJoin, busy, onAction, onEdit }: { ride: KitRide; canJoin: boolean; busy: boolean; onAction: (a: 'cancel' | 'join' | 'leave') => void; onEdit: () => void }) {
  const left = ride.seats - ride.passengers.length;
  return (
    <View style={{ paddingVertical: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="callout">
            {ride.mine ? 'Du kjører' : `${ride.driver} kjører`}
            {ride.from ? ` fra ${ride.from}` : ''}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {left > 0 ? `${left} av ${ride.seats} seter ledig` : 'Fullt'}
            {ride.passengers.length ? ` · ${ride.passengers.join(', ')}` : ''}
          </Text>
        </View>
        {ride.mine ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <PressableScale onPress={onEdit} accessibilityRole="button" accessibilityLabel="Endre turen din">
              <Text variant="footnote" color="primary">
                Endre
              </Text>
            </PressableScale>
            <PressableScale onPress={() => onAction('cancel')} disabled={busy} accessibilityRole="button" accessibilityLabel="Avlys turen din">
              <Text variant="footnote" color="danger">
                Avlys
              </Text>
            </PressableScale>
          </View>
        ) : ride.joined ? (
          <Button title="Gå av" size="sm" variant="secondary" fullWidth={false} disabled={busy} onPress={() => onAction('leave')} />
        ) : canJoin && left > 0 ? (
          <Button title="Sitt på" size="sm" variant="ink" fullWidth={false} disabled={busy} onPress={() => onAction('join')} />
        ) : null}
      </View>
    </View>
  );
}

function SeatPicker({ seats, onChange }: { seats: number; onChange: (n: number) => void }) {
  const colors = useColors();
  const btn = { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      <PressableScale onPress={() => onChange(Math.max(1, seats - 1))} accessibilityLabel="Færre seter" style={btn}>
        <Icon name="minus" size={16} />
      </PressableScale>
      <Text variant="headline" style={{ minWidth: 110, textAlign: 'center' }}>
        {seats} ledig{seats === 1 ? '' : 'e'} sete{seats === 1 ? '' : 'r'}
      </Text>
      <PressableScale onPress={() => onChange(Math.min(8, seats + 1))} accessibilityLabel="Flere seter" style={btn}>
        <Icon name="plus" size={16} />
      </PressableScale>
    </View>
  );
}
