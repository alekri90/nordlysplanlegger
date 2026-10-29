import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button, Card, Icon, SectionHeader, Text } from '@/components/ui';
import { repo } from '@/data';
import type { PersonResult } from '@/data/types';
import { contactsSupported, hasContactsAccess, readContactPhones } from '@/lib/contacts';
import { isDemoMode } from '@/lib/config';
import { spacing, useColors } from '@/theme';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'denied' } | { kind: 'done'; people: PersonResult[] };

/**
 * People in your phone's contacts who use the app. Only the numbers are checked against
 * profiles; nothing from the address book is stored. In the app only (and the demo).
 */
export function ContactFriends({ row }: { row: (p: PersonResult) => React.ReactNode }) {
  const colors = useColors();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const find = async () => {
    setState({ kind: 'loading' });
    if (isDemoMode && !contactsSupported) {
      setState({ kind: 'done', people: await repo.matchContacts(['+4700000000']) });
      return;
    }
    const contacts = await readContactPhones();
    if (contacts.status !== 'granted') {
      setState(contacts.status === 'denied' ? { kind: 'denied' } : { kind: 'idle' });
      return;
    }
    try {
      setState({ kind: 'done', people: await repo.matchContacts(contacts.phones) });
    } catch {
      setState({ kind: 'idle' });
    }
  };

  // Already allowed before: just show who's there.
  useEffect(() => {
    hasContactsAccess().then((ok) => {
      if (ok) find();
    });
  }, []);

  if (!contactsSupported && !isDemoMode) return null;

  if (state.kind === 'done') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Fra kontaktene dine" />
        {state.people.length ? (
          state.people.map((p) => row(p))
        ) : (
          <Text variant="subhead" color="textSecondary">
            Ingen i kontaktene dine har lagt inn nummeret sitt ennå. Del profilen din, så kan de legge deg til.
          </Text>
        )}
      </View>
    );
  }

  return (
    <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="book-open" size={18} color="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout">Finn venner fra kontaktene</Text>
          <Text variant="footnote" color="textSecondary">
            {state.kind === 'denied' ? 'Du har ikke gitt tilgang. Slå det på i innstillingene til telefonen.' : 'Se hvem som har appen. Bare numrene sjekkes – ingenting lagres.'}
          </Text>
        </View>
      </View>
      {state.kind === 'denied' ? (
        <Button title="Åpne innstillinger" size="sm" variant="secondary" onPress={() => Linking.openSettings()} />
      ) : (
        <Button title="Finn venner" size="sm" variant="ink" icon="search" loading={state.kind === 'loading'} onPress={find} />
      )}
    </Card>
  );
}
