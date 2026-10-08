import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Avatar, Divider, ListRow, Sheet, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useBlockUser, useGroups, usePublicProfile, useRemoveFriend } from '@/data/hooks';
import type { Person } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { profilePath } from '@/lib/username';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';
import { FriendButton } from './FriendButton';
import { ReportForm } from './ReportSheet';

type Props = {
  person: Person | null;
  onClose: () => void;
  /** Extra, context-specific actions (e.g. "Fjern fra gruppen"). */
  extra?: React.ReactNode;
};

function confirm(title: string, message: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ]);
}

/** Quick actions for anyone you see in the app: profile, friend, invite, add to a group. */
export function PersonSheet({ person, onClose, extra }: Props) {
  const toast = useToast();
  const me = useMe();
  const [groupPicker, setGroupPicker] = useState(false);
  const [reporting, setReporting] = useState(false);
  const block = useBlockUser();
  const isUser = !!person && !person.isGuest && person.id !== me?.id;
  const profile = usePublicProfile(isUser ? { userId: person!.id } : null);
  const groups = useGroups();
  const removeFriend = useRemoveFriend();
  const resetDraft = useCreateDraft((s) => s.reset);
  const setDraft = useCreateDraft((s) => s.set);

  const close = () => {
    setGroupPicker(false);
    setReporting(false);
    onClose();
  };
  if (!person) return <Sheet visible={false} onClose={close}>{null}</Sheet>;

  const name = firstName(person.name);
  const friendship = profile.data?.friendship ?? 'none';
  const myGroups = (groups.data ?? []).filter((g) => !g.members.some((m) => m.id === person.id));

  const inviteToEvent = () => {
    close();
    resetDraft();
    setDraft(person.isGuest ? { guestIds: [person.id] } : { memberIds: [person.id] });
    router.push('/create');
  };

  const addToGroup = async (groupId: string, groupName: string) => {
    try {
      const added = await repo.addGroupMembers(groupId, person.isGuest ? { guestIds: [person.id] } : { userIds: [person.id] });
      queryClient.invalidateQueries();
      toast({ message: added ? `${name} er lagt til i ${groupName}` : `${name} er allerede med`, tone: 'success' });
      close();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke legge til', tone: 'error' });
    }
  };

  return (
    <Sheet visible={!!person} onClose={close}>
      {reporting ? (
        <View>
          <Text variant="title3" style={{ marginBottom: spacing.sm }}>
            Rapporter {name}
          </Text>
          <ReportForm target={{ userId: person.id }} onDone={close} />
          <ListRow icon="arrow-left" title="Tilbake" onPress={() => setReporting(false)} />
        </View>
      ) : groupPicker ? (
        <View>
          <Text variant="title3" style={{ marginBottom: spacing.md }}>
            Legg {name} til i …
          </Text>
          {myGroups.length ? (
            myGroups.map((g) => <ListRow key={g.id} icon="users" title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`} subtitle={`${g.members.length} medlemmer`} onPress={() => addToGroup(g.id, g.name)} />)
          ) : (
            <Text variant="subhead" color="textSecondary">
              {name} er allerede med i alle gjengene dine.
            </Text>
          )}
          <ListRow icon="arrow-left" title="Tilbake" onPress={() => setGroupPicker(false)} />
        </View>
      ) : (
        <View>
          <View style={{ alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
            <Avatar name={person.name} uri={person.avatarUrl} size={80} />
            <Text variant="title3" style={{ marginTop: spacing.sm }}>
              {person.name}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {person.username ? `@${person.username}` : person.isGuest ? 'Har ikke konto ennå' : ''}
            </Text>
            {profile.data?.context ? (
              <Text variant="footnote" color="textTertiary" align="center">
                {profile.data.context}
              </Text>
            ) : null}
            {isUser && profile.data ? (
              <View style={{ marginTop: spacing.md }}>
                <FriendButton userId={person.id} state={friendship} requestId={profile.data.requestId} size="md" name={name} />
              </View>
            ) : null}
          </View>
          <Divider />
          {isUser && person.username ? (
            <ListRow
              icon="user"
              title="Se profil"
              onPress={() => {
                close();
                router.push(profilePath(person.username!) as never);
              }}
            />
          ) : null}
          {person.id !== me?.id ? <ListRow icon="calendar" title="Inviter til noe" onPress={inviteToEvent} /> : null}
          {person.id !== me?.id ? <ListRow icon="users" title="Legg til i gjeng" onPress={() => setGroupPicker(true)} /> : null}
          {extra}
          {isUser && friendship === 'friends' ? (
            <ListRow
              icon="user-x"
              title="Fjern venn"
              destructive
              onPress={() =>
                confirm(`Fjerne ${name} som venn?`, 'Dere kan fortsatt være med i de samme gjengene.', 'Fjern', async () => {
                  await removeFriend.mutateAsync(person.id);
                  toast(`${name} er fjernet som venn`);
                  close();
                })
              }
            />
          ) : null}
          {isUser ? <ListRow icon="flag" title={`Rapporter ${name}`} onPress={() => setReporting(true)} /> : null}
          {isUser ? (
            <ListRow
              icon="slash"
              title={`Blokker ${name}`}
              destructive
              onPress={() =>
                confirm(
                  `Blokkere ${name}?`,
                  `Dere ser ikke hverandres profil lenger, vennskapet avsluttes, og ${name} kan ikke legge deg til i noe. ${name} får ikke beskjed. Du kan oppheve det under Profil → Personvern.`,
                  'Blokker',
                  async () => {
                    try {
                      await block.mutateAsync(person.id);
                      toast(`${name} er blokkert`);
                      close();
                    } catch (e) {
                      toast({ message: e instanceof Error ? e.message : 'Kunne ikke blokkere', tone: 'error' });
                    }
                  },
                )
              }
            />
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

export { confirm as confirmDestructive };
