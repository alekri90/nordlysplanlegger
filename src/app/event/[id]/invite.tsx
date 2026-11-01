import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PersonalLinks } from '@/components/event/PersonalLinks';
import { ShareSheet } from '@/components/event/ShareSheet';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { SelectedSummary } from '@/components/people/SelectedSummary';
import { AvatarStack, BottomBar, Button, Card, Divider, Icon, KeyboardAware, Header, ListRow, PageSkeleton, PressableScale, Screen, ScreenScroll, SectionHeader, Sheet, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useAddEventMembers, useEvent, useGroups } from '@/data/hooks';
import type { Group, GuestInvite } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/state/session';
import { spacing, useColors } from '@/theme';

/**
 * Invite more people to an event that already exists: friends and gjenger first (they get a
 * notification and the event shows up in the app), the link last for those without the app.
 */
export default function InviteToEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const event = useEvent(id);
  const groups = useGroups();
  const add = useAddEventMembers(id);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [links, setLinks] = useState<GuestInvite[]>([]);
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const e = event.data;
  const existingIds = useMemo(() => (e?.members ?? []).map((m) => m.userId).filter((x): x is string => !!x), [e?.members]);
  if (!e) return <Screen><PageSkeleton /></Screen>;

  const toggle = (personId: string) => setUserIds((ids) => (ids.includes(personId) ? ids.filter((x) => x !== personId) : [...ids, personId]));
  const newFrom = (g: Group) => g.members.filter((m) => !m.isGuest && m.id !== me?.id && !existingIds.includes(m.id)).map((m) => m.id);
  const groupList = (groups.data ?? []).filter((g) => newFrom(g).length);
  const addGroup = (g: Group) => {
    haptics.light();
    setUserIds((ids) => [...new Set([...ids, ...newFrom(g)])]);
  };
  const count = userIds.length + guestNames.length;

  const send = async () => {
    setSending(true);
    try {
      const added = userIds.length ? await add.mutateAsync(userIds) : 0;
      const guests = await repo.addEventGuests(e.id, guestNames);
      queryClient.invalidateQueries();
      haptics.success();
      if (added) toast({ message: `${added === 1 ? 'Invitasjonen' : `${added} invitasjoner`} er sendt`, tone: 'success', icon: 'send' });
      // Those without an account only get it when their link is sent.
      if (guests.length) setLinks(guests);
      else router.back();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Kunne ikke invitere', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" title="Inviter" />
        <ScreenScroll bottomInset={220}>
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.lg }}>
            {e.title} · {e.members.length} invitert. Venner får beskjed i appen med en gang.
          </Text>
          <PeoplePicker
            selectedIds={userIds}
            onToggle={(p) => (p.isGuest ? toast('Skriv navnet under «Uten konto», så får de en personlig lenke') : toggle(p.id))}
            existingIds={existingIds}
            existingLabel="Invitert"
            guestNames={guestNames}
            onGuestNamesChange={setGuestNames}
            header={
              groupList.length ? (
                <View>
                  <SectionHeader title="Hele gjengen" />
                  <Card style={{ paddingVertical: spacing.xs }}>
                    {groupList.map((g, i) => {
                      const fresh = newFrom(g);
                      const all = fresh.every((x) => userIds.includes(x));
                      return (
                        <View key={g.id}>
                          {i ? <Divider /> : null}
                          <ListRow
                            title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`}
                            subtitle={`${fresh.length} ikke invitert ennå`}
                            leading={<AvatarStack people={g.members.slice(0, 3)} size={30} max={3} />}
                            trailing={all ? <Icon name="check" size={18} color="primary" /> : <Text variant="footnote" color="primary">Velg alle</Text>}
                            onPress={() => (all ? setUserIds((ids) => ids.filter((x) => !fresh.includes(x))) : addGroup(g))}
                          />
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ) : undefined
            }
          />

          <PressableScale onPress={() => router.push('/friends/find')} accessibilityRole="button" style={{ marginTop: spacing.xl }}>
            <Card muted style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user-plus" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout">Finn flere venner</Text>
                <Text variant="footnote" color="textSecondary">
                  Søk, eller se hvem i kontaktene dine som har appen.
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="textTertiary" />
            </Card>
          </PressableScale>
        </ScreenScroll>
        <BottomBar>
          <SelectedSummary ids={userIds} names={guestNames} />
          <Button variant="ink" title={count ? `Inviter ${count} ${count === 1 ? 'person' : 'personer'}` : 'Velg hvem'} icon="send" disabled={!count} loading={sending} onPress={send} />
          <Button variant="ghost" title="Del lenke til andre" icon="link" onPress={() => setShareOpen(true)} style={{ marginTop: spacing.xs }} />
        </BottomBar>
      </KeyboardAware>
      <Sheet visible={links.length > 0} onClose={() => router.back()} title="Send lenkene">
        <PersonalLinks guests={links} title={e.title} organizerName={firstName(e.organizer.name)} />
        <Button title="Ferdig" variant="ink" style={{ marginTop: spacing.lg }} onPress={() => router.back()} />
      </Sheet>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} title={e.title} token={e.inviteToken} organizerName={firstName(e.organizer.name)} />
    </Screen>
  );
}
