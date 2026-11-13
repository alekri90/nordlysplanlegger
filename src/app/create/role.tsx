import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ACTIVITY_STEPS, StepHeader } from '@/components/create/StepHeader';
import { PersonRow } from '@/components/people/PersonRow';
import { BottomBar, Button, Card, Divider, Icon, Input, ListRow, PageTitle, PressableScale, Screen, ScreenScroll, SectionHeader, Text } from '@/components/ui';
import { useFriends, useVenues } from '@/data/hooks';
import { roleActivity, venueIn } from '@/lib/activities';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { useCreateDraft } from '@/state/createDraft';
import { radius, spacing, useColors } from '@/theme';

/**
 * An activity type, step 4 — the venue (which sauna) and who is asked to take the role (the sauna
 * master). Only the request goes out from here; no participant is invited in this step.
 */
export default function CreateRole() {
  const colors = useColors();
  const draft = useCreateDraft();
  const type = roleActivity(draft.activityType);
  const venues = useVenues(type?.id);
  const friends = useFriends();
  const [adding, setAdding] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueCap, setVenueCap] = useState('');
  const [outsideName, setOutsideName] = useState('');

  // «Aufguss på Sørenga»: a saved sauna named in the title is picked to begin with.
  const guessed = useRef(false);
  useEffect(() => {
    if (guessed.current || draft.venue || !venues.data?.length) return;
    guessed.current = true;
    const v = venueIn(draft.title, venues.data);
    if (v) draft.set({ venue: { id: v.id, name: v.name, capacity: v.capacity } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues.data]);

  if (!type) return null;
  const saved = venues.data ?? [];
  const friendList = friends.data ?? [];
  const picked = draft.roleCandidates;
  const isPicked = (userId: string) => picked.some((c) => c.userId === userId);
  const names = picked.filter((c) => !c.userId);

  const toggleFriend = (id: string, name: string) => {
    haptics.tap();
    draft.set({ roleCandidates: isPicked(id) ? picked.filter((c) => c.userId !== id) : [...picked, { userId: id, name }] });
  };
  const addOutside = () => {
    const name = outsideName.trim();
    if (!name || names.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    haptics.light();
    draft.set({ roleCandidates: [...picked, { userId: null, name }] });
    setOutsideName('');
  };
  const chooseNewVenue = () => {
    const name = venueName.trim();
    if (!name) return;
    const cap = Number.parseInt(venueCap, 10);
    draft.set({ venue: { name, capacity: Number.isFinite(cap) && cap > 0 ? Math.min(cap, 1000) : null } });
    setAdding(false);
    setVenueName('');
    setVenueCap('');
  };

  const ready = !!draft.venue?.name && picked.length > 0;
  const who = picked.map((c) => firstName(c.name));
  const role = type.role;

  return (
    <Screen>
      <StepHeader step={3} total={ACTIVITY_STEPS} />
      <ScreenScroll bottomInset={160}>
        <PageTitle title={`${type.venue.label} og ${role.lower}`} subtitle={`Forespørselen går bare til ${role.lower}. Deltagere inviterer du i et eget steg.`} />

        <SectionHeader title={type.venue.label} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {saved.map((v, i) => (
            <View key={v.id}>
              {i ? <Divider /> : null}
              <ListRow
                icon="map-pin"
                title={v.name}
                subtitle={v.capacity ? `Plass til ${v.capacity} totalt` : 'Kapasitet ikke oppgitt'}
                radio
                selected={draft.venue?.id === v.id}
                onPress={() => draft.set({ venue: { id: v.id, name: v.name, capacity: v.capacity } })}
              />
            </View>
          ))}
          {draft.venue && !draft.venue.id ? (
            <>
              {saved.length ? <Divider /> : null}
              <ListRow
                icon="map-pin"
                title={draft.venue.name}
                subtitle={`${draft.venue.capacity ? `Plass til ${draft.venue.capacity} totalt` : 'Kapasitet ikke oppgitt'} · lagres til neste gang`}
                radio
                selected
                onPress={() => {
                  setVenueName(draft.venue?.name ?? '');
                  setVenueCap(draft.venue?.capacity ? String(draft.venue.capacity) : '');
                  setAdding(true);
                }}
              />
            </>
          ) : null}
          {saved.length || draft.venue ? <Divider /> : null}
          {adding ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              <Input placeholder={type.venue.placeholder} value={venueName} onChangeText={setVenueName} maxLength={120} autoFocus accessibilityLabel={`Navn på ${type.venue.definite}`} />
              <Input
                placeholder={`Plass til totalt, med ${role.lower} (valgfritt)`}
                value={venueCap}
                onChangeText={(t) => setVenueCap(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel={`Hvor mange ${type.venue.definite} har plass til`}
              />
              <Button title={`Bruk ${venueName.trim() || type.venue.definite}`} size="md" variant="ink" disabled={!venueName.trim()} onPress={chooseNewVenue} />
            </Animated.View>
          ) : (
            <ListRow icon="plus" title={`Ny ${type.venue.label.toLowerCase()}`} subtitle="Navn og hvor mange det er plass til" onPress={() => setAdding(true)} />
          )}
        </Card>

        <SectionHeader title={`Hvem spør du som ${role.lower}?`} />
        <Text variant="footnote" color="textSecondary" style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}>
          {role.pitch} Spør du flere, velger du selv hvem som får hver dato.
        </Text>
        {friendList.length ? (
          <View style={{ gap: spacing.xs }}>
            {friendList.map((f) => (
              <PersonRow key={f.id} person={f} selected={isPicked(f.id)} onPress={() => toggleFriend(f.id, f.name)} />
            ))}
          </View>
        ) : null}

        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="link" size={18} color="textSecondary" />
            <View style={{ flex: 1 }}>
              <Text variant="callout">Noen uten appen</Text>
              <Text variant="footnote" color="textSecondary">
                Hen får en egen lenke du sender, f.eks. på SMS
              </Text>
            </View>
          </View>
          {names.map((c) => (
            <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
              <Text variant="callout" style={{ flex: 1 }}>
                {c.name}
              </Text>
              <PressableScale
                onPress={() => draft.set({ roleCandidates: picked.filter((x) => x !== c) })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Fjern ${c.name}`}
              >
                <Icon name="x" size={16} color="textSecondary" />
              </PressableScale>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input placeholder="Navn, f.eks. Ola" value={outsideName} onChangeText={setOutsideName} onSubmitEditing={addOutside} returnKeyType="done" maxLength={60} accessibilityLabel={`Navn på ${role.lower} uten appen`} />
            </View>
            <Button title="Legg til" size="sm" variant="secondary" fullWidth={false} disabled={!outsideName.trim()} onPress={addOutside} />
          </View>
        </Card>

        <View style={{ marginTop: spacing.xl }}>
          <Input
            label={`Melding til ${role.lower} (valgfritt)`}
            placeholder="F.eks. «Kan du ta disse kveldene?»"
            value={draft.roleNote}
            onChangeText={(roleNote) => draft.set({ roleNote })}
            multiline
            maxLength={500}
            style={{ minHeight: 80, paddingTop: spacing.md, textAlignVertical: 'top' }}
          />
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          title={!draft.venue ? `Velg ${type.venue.label.toLowerCase()}` : !picked.length ? `Velg ${role.lower}` : `Fortsett · ${who.slice(0, 2).join(' og ')}${who.length > 2 ? ` +${who.length - 2}` : ''}`}
          disabled={!ready}
          onPress={() => router.push('/create/places')}
        />
      </BottomBar>
    </Screen>
  );
}
