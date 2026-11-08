import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { StepHeader } from '@/components/create/StepHeader';
import { PersonRow } from '@/components/people/PersonRow';
import { BottomBar, Button, Card, Input, ListRow, PageTitle, Screen, ScreenScroll, SectionHeader, Text, useToast } from '@/components/ui';
import { useCreateDateClearance, useFriends } from '@/data/hooks';
import { formatShort } from '@/lib/dates';
import { firstName, timeHintLabel } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { useCreateDraft } from '@/state/createDraft';
import { useIsSignedIn } from '@/state/session';
import { spacing } from '@/theme';

/**
 * «Avklar med noen først» — last step: who checks the days? A friend in the app gets a notice;
 * anyone else gets the link from the organizer. Nothing is created and nobody is invited yet.
 */
export default function CreateClear() {
  const toast = useToast();
  const draft = useCreateDraft();
  const signedIn = useIsSignedIn();
  const friends = useFriends();
  const create = useCreateDateClearance();
  const awaitingAuth = useRef(false);
  const [keyUserId, setKeyUserId] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [note, setNote] = useState('');

  const friendList = friends.data ?? [];
  const chosen = friendList.find((f) => f.id === keyUserId) ?? null;
  const name = chosen ? firstName(chosen.name) : keyName.trim() ? firstName(keyName.trim()) : null;
  const ready = !!chosen || (outside && !!keyName.trim());
  const dates = [...draft.optionDates].sort();

  const send = async () => {
    if (!signedIn) {
      awaitingAuth.current = true;
      router.push({ pathname: '/auth', params: { reason: 'send' } });
      return;
    }
    try {
      const r = await create.mutateAsync({
        keyUserId: chosen?.id ?? null,
        keyName: chosen ? chosen.name : keyName.trim(),
        note: note.trim() || null,
        dates,
        draft: {
          title: draft.title.trim(),
          category: draft.category,
          coverImageUrl: draft.coverImageUrl,
          timeHint: draft.timeHint,
          startTime: draft.startTime,
          groupId: draft.groupId,
          memberIds: draft.memberIds,
          guestIds: draft.guestIds,
          guestNames: draft.guestNames,
          saveAsGroupName: !draft.groupId && draft.saveAsGroup && draft.groupName.trim() ? draft.groupName.trim() : null,
          location: draft.placeName.trim() ? { name: draft.placeName.trim() } : null,
          description: draft.details.trim() || null,
          maxParticipants: draft.maxParticipants,
          guestsCanInvite: draft.guestsCanInvite,
          price: draft.price,
        },
      });
      haptics.success();
      draft.reset();
      router.dismissAll();
      router.push({ pathname: '/avklaring/[id]', params: { id: r.id, fresh: '1' } });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende. Prøv igjen.', tone: 'error' });
    }
  };

  // Continue once the organizer has signed in.
  useEffect(() => {
    if (signedIn && awaitingAuth.current) {
      awaitingAuth.current = false;
      send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  return (
    <Screen>
      <StepHeader step={4} total={5} />
      <ScreenScroll bottomInset={160}>
        <PageTitle title="Hvem skal avklare dagene?" subtitle="Hen krysser av hvilke dager som passer. Ingen andre får vite noe før du inviterer." />

        <Card muted style={{ gap: 4 }}>
          <Text variant="headline">{draft.title || 'Arrangementet'}</Text>
          <Text variant="footnote" color="textSecondary">
            {dates.length} {dates.length === 1 ? 'dag' : 'dager'} · {timeHintLabel(draft.timeHint, draft.startTime)}
            {draft.placeName.trim() ? ` · ${draft.placeName.trim()}` : ''}
          </Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={2}>
            {dates.slice(0, 6).map(formatShort).join(', ')}
            {dates.length > 6 ? ` og ${dates.length - 6} til` : ''}
          </Text>
        </Card>

        {friendList.length ? (
          <>
            <SectionHeader title="Venner" />
            <View style={{ gap: spacing.xs }}>
              {friendList.map((f) => (
                <PersonRow
                  key={f.id}
                  person={f}
                  selected={keyUserId === f.id}
                  onPress={() => {
                    haptics.tap();
                    setOutside(false);
                    setKeyUserId(keyUserId === f.id ? null : f.id);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        <Card style={{ paddingVertical: spacing.xs, marginTop: spacing.lg }}>
          <ListRow
            icon="link"
            title="Noen uten appen"
            subtitle="Du får en lenke du sender selv, f.eks. på SMS"
            radio
            selected={outside}
            onPress={() => {
              setOutside(!outside);
              setKeyUserId(null);
            }}
          />
          {outside ? (
            <View style={{ paddingBottom: spacing.md }}>
              <Input placeholder="Navn, f.eks. Ola" value={keyName} onChangeText={setKeyName} maxLength={60} autoFocus />
            </View>
          ) : null}
        </Card>

        <View style={{ marginTop: spacing.xl }}>
          <Input
            label="Melding (valgfritt)"
            placeholder="F.eks. «Kan vi ha badstua disse kveldene?»"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ minHeight: 80, paddingTop: spacing.md, textAlignVertical: 'top' }}
          />
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          icon="send"
          title={ready && name ? `Send til ${name}` : 'Velg hvem som skal avklare'}
          disabled={!ready}
          loading={create.isPending}
          onPress={send}
        />
      </BottomBar>
    </Screen>
  );
}
