import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GroupLookPicker } from '@/components/group/GroupLookPicker';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { PersonRow } from '@/components/people/PersonRow';
import { BottomBar, Button, Header, Input, KeyboardAware, PageTitle, Screen, ScreenScroll, SectionHeader, Text, useToast } from '@/components/ui';
import { useCreateGroup, useEvent } from '@/data/hooks';
import type { Person } from '@/data/types';
import { coverOptions, suggestCategory } from '@/lib/categories';
import { suggestGroupName } from '@/lib/groupName';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/**
 * Name it, pick people, pick a look. `?fromEvent=` pre-selects everyone from that event
 * and suggests a name ("Poker hos Alexander" → "Poker").
 */
export default function NewGroup() {
  const { fromEvent } = useLocalSearchParams<{ fromEvent?: string }>();
  const event = useEvent(fromEvent);
  if (fromEvent && !event.data) return <Screen><Header back="close" /></Screen>;

  const e = event.data;
  const eventPeople = e ? e.members.filter((m) => m.role === 'guest' || m.userId).map((m) => m.person) : [];
  return (
    <NewGroupForm
      key={e?.id ?? 'blank'}
      initialName={e ? suggestGroupName(e.title) : ''}
      initialCover={e?.coverImageUrl}
      eventPeople={eventPeople}
      eventTitle={e?.title}
    />
  );
}

function NewGroupForm({ initialName, initialCover, eventPeople, eventTitle }: { initialName: string; initialCover?: string; eventPeople: Person[]; eventTitle?: string }) {
  const toast = useToast();
  const me = useMe();
  const create = useCreateGroup();
  const fromEvent = eventPeople.filter((p) => p.id !== me?.id);
  const [name, setName] = useState(initialName);
  const [userIds, setUserIds] = useState<string[]>(fromEvent.filter((p) => !p.isGuest).map((p) => p.id));
  const [guestIds, setGuestIds] = useState<string[]>(fromEvent.filter((p) => p.isGuest).map((p) => p.id));
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const photos = useMemo(() => {
    const base = coverOptions(suggestCategory(name || eventTitle || ''), 600);
    return initialCover && !base.includes(initialCover) ? [initialCover, ...base] : base;
  }, [name, eventTitle, initialCover]);
  const [photo, setPhoto] = useState<string | null>(null);
  const chosenPhoto = photo && photos.includes(photo) ? photo : photos[0];

  const toggleUser = (p: Person) => setUserIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]));
  const toggleGuest = (p: Person) => setGuestIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]));
  const count = userIds.length + guestIds.length + guestNames.length;

  const save = async () => {
    try {
      const g = await create.mutateAsync({ name: name.trim(), emoji, coverImageUrl: chosenPhoto, userIds, guestIds, guestNames });
      haptics.success();
      toast({ message: `${g.name} er klar`, tone: 'success' });
      router.replace(`/group/${g.id}`);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke lage gjengen', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" />
        <ScreenScroll bottomInset={140}>
          <PageTitle title={eventTitle ? 'Lag gruppe av gjengen' : 'Ny gjeng'} subtitle={eventTitle ? `Alle fra ${eventTitle} er valgt. Neste gang er det ett trykk.` : 'Folk du gjør ting med igjen og igjen.'} />
          <Input size="lg" autoFocus={!initialName} placeholder="F.eks. Poker" value={name} onChangeText={setName} maxLength={60} accessibilityLabel="Navn på gjengen" />

          <View style={{ marginTop: spacing.xl }}>
            <GroupLookPicker photos={photos} photo={chosenPhoto} onPhoto={setPhoto} emoji={emoji} onEmoji={setEmoji} />
          </View>

          <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
            Hvem er med?
          </Text>
          <PeoplePicker
            selectedIds={[...userIds, ...guestIds]}
            onToggle={(p) => (p.isGuest ? toggleGuest(p) : toggleUser(p))}
            guestNames={guestNames}
            onGuestNamesChange={setGuestNames}
            header={
              fromEvent.length ? (
                <View>
                  <SectionHeader title={`Fra ${eventTitle}`} />
                  {fromEvent.map((p) => (
                    <PersonRow key={p.id} person={p} selected={p.isGuest ? guestIds.includes(p.id) : userIds.includes(p.id)} onPress={() => (p.isGuest ? toggleGuest(p) : toggleUser(p))} />
                  ))}
                </View>
              ) : undefined
            }
          />
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title={count ? `Lag gjengen · ${count + 1} personer` : 'Lag gjengen'} disabled={!name.trim()} loading={create.isPending} onPress={save} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
