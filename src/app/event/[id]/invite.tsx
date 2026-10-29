import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ShareSheet } from '@/components/event/ShareSheet';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { AvatarStack, BottomBar, Button, Card, Divider, Icon, KeyboardAware, Header, ListRow, PageSkeleton, PressableScale, Screen, ScreenScroll, SectionHeader, Text, useToast } from '@/components/ui';
import { useAddEventMembers, useEvent, useGroups } from '@/data/hooks';
import type { Group } from '@/data/types';
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
  const count = userIds.length;

  const send = async () => {
    try {
      const added = await add.mutateAsync(userIds);
      haptics.success();
      toast({ message: added ? `${added === 1 ? 'Invitasjonen' : `${added} invitasjoner`} er sendt` : 'De var allerede invitert', tone: 'success', icon: 'send' });
      router.back();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Kunne ikke invitere', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" title="Inviter" />
        <ScreenScroll bottomInset={170}>
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.lg }}>
            {e.title} · {e.members.length} invitert. Venner får beskjed i appen med en gang.
          </Text>
          <PeoplePicker
            selectedIds={userIds}
            onToggle={(p) => (p.isGuest ? toast('De uten konto får lenken – trykk «Del lenke» nederst') : toggle(p.id))}
            existingIds={existingIds}
            existingLabel="Invitert"
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
          <Button variant="ink" title={count ? `Inviter ${count} ${count === 1 ? 'venn' : 'venner'}` : 'Velg venner'} icon="send" disabled={!count} loading={add.isPending} onPress={send} />
          <Button variant="ghost" title="Del lenke til andre" icon="link" onPress={() => setShareOpen(true)} style={{ marginTop: spacing.xs }} />
        </BottomBar>
      </KeyboardAware>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} title={e.title} token={e.inviteToken} organizerName={firstName(e.organizer.name)} />
    </Screen>
  );
}
