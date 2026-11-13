import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Icon, Input, Text, useToast } from '@/components/ui';
import type { EventKit, KitRef } from '@/data/types';
import { useKitActions } from '@/data/hooks';
import { spacing } from '@/theme';

import { kitError } from './kitShared';

/**
 * Diets and allergies. Each person writes their own; only the organizer side sees everyone's
 * («3 har sagt fra»), so a nut allergy isn't on show for the whole guest list.
 */
export function KitDiet({ kit, kitRef }: { kit: EventKit; kitRef: KitRef }) {
  const toast = useToast();
  const actions = useKitActions(kitRef);
  const [text, setText] = useState<string | null>(null);
  const value = text ?? kit.myDiet ?? '';
  const changed = value.trim() !== (kit.myDiet ?? '');

  const save = async () => {
    try {
      await actions.diet.mutateAsync(value.trim() || null);
      setText(null);
      toast({ message: value.trim() ? 'Verten har fått beskjed' : 'Fjernet', tone: 'success', icon: 'check' });
    } catch (e) {
      toast({ message: kitError(e), tone: 'error' });
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="heart" size={16} color="primary" />
        <Text variant="headline" style={{ flex: 1 }}>
          Kostbehov og allergier
        </Text>
      </View>

      {kit.organizer ? (
        kit.diets?.length ? (
          <View style={{ gap: spacing.sm }}>
            {kit.diets.map((d) => (
              <Text key={d.memberId} variant="callout">
                <Text variant="callout" style={{ fontWeight: '600' }}>
                  {d.name}:
                </Text>{' '}
                {d.diet}
              </Text>
            ))}
            <Text variant="footnote" color="textSecondary">
              Bare du (og medarrangører) ser dette.
            </Text>
          </View>
        ) : (
          <Text variant="footnote" color="textSecondary">
            Ingen har sagt fra ennå. Gjestene kan skrive det her når de har svart – bare du ser det.
          </Text>
        )
      ) : null}

      {kit.me && !kit.organizer ? (
        <>
          {kit.organizer ? <Divider /> : null}
          <Input
            placeholder="F.eks. vegetar, nøtteallergi – eller ingenting"
            value={value}
            onChangeText={(t) => setText(t.slice(0, 200))}
            accessibilityLabel="Dine kostbehov og allergier"
          />
          <Text variant="footnote" color="textSecondary">
            Bare verten ser dette.
          </Text>
          {changed ? <Button title={value.trim() ? 'Send til verten' : 'Fjern'} variant="ink" size="sm" loading={actions.diet.isPending} onPress={save} /> : null}
        </>
      ) : null}

      {!kit.me && !kit.organizer ? (
        <Text variant="footnote" color="textSecondary">
          Svar på invitasjonen, så kan du si fra om kostbehov og allergier til verten.
        </Text>
      ) : null}
    </Card>
  );
}
