import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Icon, Input, PressableScale, Text, useToast } from '@/components/ui';
import type { EventKit, KitBringItem, KitRef } from '@/data/types';
import { useKitActions } from '@/data/hooks';
import { haptics } from '@/lib/haptics';
import { spacing, useColors } from '@/theme';

import { kitError } from './kitShared';

/** «Hvem tar med hva»: take something on the list, or add what you bring yourself. */
export function KitBring({ kit, kitRef }: { kit: EventKit; kitRef: KitRef }) {
  const toast = useToast();
  const actions = useKitActions(kitRef);
  const [label, setLabel] = useState('');
  const canAct = !!kit.me || kit.organizer;
  const open = kit.bring.filter((b) => !b.claimedBy).length;

  const run = async (action: 'claim' | 'unclaim' | 'add' | 'remove', item?: KitBringItem) => {
    try {
      haptics.light();
      await actions.bring.mutateAsync({ action, itemId: item?.id, label: action === 'add' ? label : undefined });
      if (action === 'add') setLabel('');
      if (action === 'claim') toast({ message: `Du tar med ${item!.label.toLowerCase()}`, tone: 'success', icon: 'check' });
    } catch (e) {
      toast({ message: kitError(e), tone: 'error' });
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="shopping-bag" size={16} color="primary" />
        <Text variant="headline" style={{ flex: 1 }}>
          Hvem tar med hva
        </Text>
        {kit.bring.length ? (
          <Text variant="footnote" color={open ? 'primary' : 'success'}>
            {open ? `${open} ledig${open === 1 ? '' : 'e'}` : 'Alt er tatt'}
          </Text>
        ) : null}
      </View>

      {kit.bring.map((b, i) => (
        <View key={b.id}>
          {i ? <Divider /> : null}
          <Row item={b} canClaim={!!kit.me} organizer={kit.organizer} busy={actions.bring.isPending} onAction={(a) => run(a, b)} />
        </View>
      ))}
      {!kit.bring.length ? (
        <Text variant="footnote" color="textSecondary">
          Listen er tom. {canAct ? 'Legg til det første under.' : ''}
        </Text>
      ) : null}

      {canAct ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm }}>
          <Input
            containerStyle={{ flex: 1 }}
            placeholder={kit.organizer ? 'Legg til på listen' : 'Jeg tar med …'}
            value={label}
            onChangeText={(t) => setLabel(t.slice(0, 80))}
            returnKeyType="done"
            onSubmitEditing={() => label.trim() && run('add')}
            accessibilityLabel={kit.organizer ? 'Legg til på listen' : 'Legg til noe du tar med'}
          />
          <Button title="Legg til" size="sm" variant="secondary" fullWidth={false} disabled={!label.trim()} loading={actions.bring.isPending} onPress={() => run('add')} />
        </View>
      ) : (
        <Text variant="footnote" color="textSecondary">
          Svar på invitasjonen, så kan du ta på deg noe.
        </Text>
      )}
    </Card>
  );
}

function Row({ item, canClaim, organizer, busy, onAction }: { item: KitBringItem; canClaim: boolean; organizer: boolean; busy: boolean; onAction: (a: 'claim' | 'unclaim' | 'remove') => void }) {
  const colors = useColors();
  const free = !item.claimedBy;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: item.mine ? colors.primary : free ? colors.surfaceMuted : colors.successSoft,
        }}
      >
        {item.claimedBy ? <Icon name="check" size={13} tint={item.mine ? '#fff' : colors.success} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout">{item.label}</Text>
        <Text variant="footnote" color={item.mine ? 'primary' : 'textSecondary'}>
          {item.mine ? 'Du tar med' : item.claimedBy ? `${item.claimedBy} tar med` : 'Ledig'}
        </Text>
      </View>
      {free && canClaim ? (
        <Button title="Jeg tar den" size="sm" variant="ink" fullWidth={false} disabled={busy} onPress={() => onAction('claim')} />
      ) : item.mine || (organizer && item.claimedBy) ? (
        <PressableScale onPress={() => onAction('unclaim')} disabled={busy} accessibilityRole="button" accessibilityLabel={`Angre ${item.label}`}>
          <Text variant="footnote" color="textSecondary">
            Angre
          </Text>
        </PressableScale>
      ) : null}
      {(organizer || item.addedByMe) && !item.claimedBy ? (
        <PressableScale onPress={() => onAction('remove')} disabled={busy} accessibilityRole="button" accessibilityLabel={`Fjern ${item.label}`} style={{ padding: 4 }}>
          <Icon name="x" size={16} color="textTertiary" />
        </PressableScale>
      ) : null}
    </View>
  );
}
