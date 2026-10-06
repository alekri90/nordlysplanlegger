import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';

import { Card, Divider, Header, ListRow, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useUpdateProfile } from '@/data/hooks';
import type { Discoverability } from '@/data/types';
import { useMe, useSession } from '@/state/session';
import { spacing } from '@/theme';

const DISCOVERABILITY: { id: Discoverability; title: string; subtitle: string }[] = [
  { id: 'everyone', title: 'Alle', subtitle: 'Alle kan søke deg opp og legge deg til' },
  { id: 'friends_of_friends', title: 'Venner av venner', subtitle: 'Bare folk dere har felles venner med' },
  { id: 'nobody', title: 'Ingen', subtitle: 'Du er ikke søkbar. Del profillenken selv.' },
];

export default function Privacy() {
  const toast = useToast();
  const me = useMe();
  const setProfile = useSession((s) => s.setProfile);
  const update = useUpdateProfile();
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    try {
      const json = await repo.exportMyData();
      await Share.share({ message: json, title: 'Mine data fra Nordlys Planlegger' });
    } catch {
      toast({ message: 'Kunne ikke eksportere akkurat nå', tone: 'error' });
    }
  };

  const deleteAccount = () => {
    const run = async () => {
      setBusy(true);
      try {
        await repo.deleteAccount();
        queryClient.clear();
        router.replace('/welcome');
      } catch {
        toast({ message: 'Kunne ikke slette kontoen. Prøv igjen.', tone: 'error' });
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Slette kontoen? Arrangementene dine slettes, og svarene dine i andres arrangementer anonymiseres.')) run();
      return;
    }
    Alert.alert('Slette kontoen?', 'Arrangementene dine slettes, og svarene dine i andres arrangementer anonymiseres. Dette kan ikke angres.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Slett', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen>
      <Header title="Personvern" />
      <ScreenScroll>
        <Text variant="title3" style={{ marginBottom: spacing.xs }}>
          Hvem kan finne meg?
        </Text>
        <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Gjelder søk og profillenken din. Folk du allerede planlegger med ser deg alltid.
        </Text>
        <Card style={{ paddingVertical: spacing.xs }}>
          {DISCOVERABILITY.map((d, i) => (
            <View key={d.id}>
              {i ? <Divider /> : null}
              <ListRow
                title={d.title}
                subtitle={d.subtitle}
                radio
                selected={(me?.discoverability ?? 'everyone') === d.id}
                onPress={async () => {
                  try {
                    setProfile(await update.mutateAsync({ discoverability: d.id }));
                  } catch {
                    toast({ message: 'Kunne ikke lagre', tone: 'error' });
                  }
                }}
              />
            </View>
          ))}
        </Card>
        <Card muted style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Text variant="headline">Det andre ser</Text>
          <Text variant="subhead" color="textSecondary">
            Profilbilde, visningsnavn og @brukernavn – og hva dere har felles. Aldri e-post, telefonnummer, arrangementer eller gjenger dere ikke deler. Vi leser aldri kalenderen din.
          </Text>
        </Card>
        <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.xs }}>
          <ListRow icon="download" title="Eksporter dataene mine" subtitle="Få en kopi av alt vi har lagret om deg" onPress={exportData} chevron />
          <Divider />
          <ListRow icon="trash-2" title={busy ? 'Sletter …' : 'Slett kontoen'} subtitle="Permanent" destructive onPress={deleteAccount} />
        </Card>
      </ScreenScroll>
    </Screen>
  );
}
