import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EventHero } from '@/components/event/EventHero';
import { groupNextLine } from '@/components/group/GroupCard';
import { GroupFriendsCard } from '@/components/group/GroupFriendsCard';
import { GroupInviteCard } from '@/components/group/GroupInviteCard';
import { PersonRow } from '@/components/people/PersonRow';
import { confirmDestructive, PersonSheet } from '@/components/people/PersonSheet';
import { BottomBar, Button, Card, Divider, ErrorState, IconButton, ListRow, PageSkeleton, Screen, SectionHeader, Sheet, Text, useToast } from '@/components/ui';
import { useGroup, useLeaveGroup, useRemoveGroupMember, useSetGroupMemberRole } from '@/data/hooks';
import type { GroupMember } from '@/data/types';
import { daysBetween, formatDayMonth, today } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, spacing, useColors } from '@/theme';

const ROLE_LABEL: Record<GroupMember['role'], string | undefined> = { owner: 'Eier', admin: 'Admin', member: undefined };

/** A crew that meets again and again. The main action: plan something — everyone pre-selected. */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const group = useGroup(id);
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const leave = useLeaveGroup(id);
  const removeMember = useRemoveGroupMember(id);
  const setRole = useSetGroupMemberRole(id);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<GroupMember | null>(null);

  if (group.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!group.data) return <Screen><ErrorState title="Fant ikke gjengen" onRetry={() => group.refetch()} /></Screen>;

  const g = group.data;
  const isAdmin = g.myRole === 'owner' || g.myRole === 'admin';
  const registered = g.members.filter((m) => !m.isGuest).length;
  const guests = g.members.length - registered;
  const weeksSince = g.lastEvent?.date ? Math.floor(daysBetween(g.lastEvent.date, today()) / 7) : null;

  const plan = () => {
    prefillFromGroup(g, me?.id);
    router.push('/create/dates');
  };

  const leaveGroup = () => {
    setMoreOpen(false);
    confirmDestructive(`Forlate ${g.name}?`, g.myRole === 'owner' ? 'Neste admin blir eier av gjengen.' : 'Du kan bli lagt til igjen senere.', 'Forlat', async () => {
      try {
        await leave.mutateAsync();
        toast(`Du har forlatt ${g.name}`);
        router.replace('/(tabs)/groups');
      } catch (e) {
        toast({ message: e instanceof Error ? e.message : 'Noe gikk galt', tone: 'error' });
      }
    });
  };

  const memberActions = selected && isAdmin && selected.id !== me?.id && selected.role !== 'owner' ? (
    <>
      {!selected.isGuest ? (
        <ListRow
          icon="shield"
          title={selected.role === 'admin' ? 'Fjern som admin' : 'Gjør til admin'}
          onPress={async () => {
            await setRole.mutateAsync({ memberId: selected.memberId, role: selected.role === 'admin' ? 'member' : 'admin' });
            setSelected(null);
          }}
        />
      ) : null}
      <ListRow
        icon="user-minus"
        title={`Fjern fra ${g.name}`}
        destructive
        onPress={() =>
          confirmDestructive(`Fjerne ${firstName(selected.name)}?`, `${firstName(selected.name)} blir ikke lenger invitert med gjengen.`, 'Fjern', async () => {
            await removeMember.mutateAsync(selected.memberId);
            toast(`${firstName(selected.name)} er fjernet`);
            setSelected(null);
          })
        }
      />
    </>
  ) : null;

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <EventHero
          imageUrl={g.coverImageUrl.replace(/w=\d+/, 'w=1200')}
          height={270}
          dim
          right={<IconButton icon="more-horizontal" variant="glass" accessibilityLabel="Flere valg" onPress={() => setMoreOpen(true)} />}
        >
          <Text variant="display" style={{ color: '#fff' }} accessibilityRole="header">
            {g.emoji ? `${g.emoji} ` : ''}
            {g.name}
          </Text>
          <Text variant="callout" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
            {registered} {registered === 1 ? 'medlem' : 'medlemmer'}
            {guests ? ` · ${guests} ${guests === 1 ? 'gjest' : 'gjester'}` : ''}
          </Text>
        </EventHero>

        <View style={{ paddingHorizontal: gutter, paddingTop: spacing.xl }}>
          {g.description ? (
            <Text variant="body" color="textSecondary" style={{ marginBottom: spacing.lg }}>
              {g.description}
            </Text>
          ) : null}

          <Animated.View entering={FadeInDown.duration(320)}>
            <Card style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="overline" color="textTertiary">
                  Sist
                </Text>
                <Text variant="headline">{g.lastEvent?.date ? formatDayMonth(g.lastEvent.date) : '–'}</Text>
                {weeksSince !== null && weeksSince > 0 ? (
                  <Text variant="footnote" color="textSecondary">
                    for {weeksSince} uker siden
                  </Text>
                ) : null}
              </View>
              <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="overline" color="textTertiary">
                  Neste
                </Text>
                <Text variant="headline" numberOfLines={2}>
                  {groupNextLine(g)}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {g.nextEvent ? (
            <Card style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}>
              <ListRow icon="calendar" title={g.nextEvent.title} subtitle={g.nextEvent.date ? formatDayMonth(g.nextEvent.date) : 'Finner dato'} chevron onPress={() => router.push(`/event/${g.nextEvent!.id}`)} />
            </Card>
          ) : null}

          <GroupInviteCard group={g} style={{ marginTop: spacing.xxl }} />

          <SectionHeader title="Medlemmer" action="Legg til" onAction={() => router.push(`/group/${g.id}/add-members`)} style={{ marginTop: spacing.xxl }} />
          <Card style={{ paddingVertical: spacing.xs }}>
            {g.members.map((m, i) => (
              <View key={m.memberId}>
                {i ? <Divider /> : null}
                <PersonRow
                  person={m}
                  size={44}
                  tag={m.isGuest ? 'Gjest' : ROLE_LABEL[m.role]}
                  detail={m.id === me?.id ? 'Deg' : null}
                  onPress={m.id === me?.id ? undefined : () => setSelected(m)}
                />
              </View>
            ))}
          </Card>

          <GroupFriendsCard group={g} style={{ marginTop: spacing.md }} />

          {g.pastEvents.length ? (
            <>
              <SectionHeader title="Tidligere" style={{ marginTop: spacing.xxl }} />
              <Card style={{ paddingVertical: spacing.xs }}>
                {g.pastEvents.map((e, i) => (
                  <View key={e.id}>
                    {i ? <Divider /> : null}
                    <ListRow icon="check-circle" title={e.title} subtitle={e.date ? formatDayMonth(e.date) : undefined} chevron onPress={() => router.push(`/event/${e.id}`)} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>

      <BottomBar>
        <Button title="Planlegg noe" icon="plus" onPress={plan} accessibilityHint={`Nytt arrangement med alle i ${g.name} valgt`} />
      </BottomBar>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={g.name}>
        {isAdmin ? <ListRow icon="edit-2" title="Rediger gjengen" onPress={() => { setMoreOpen(false); router.push(`/group/${g.id}/edit`); }} /> : null}
        <ListRow icon="user-plus" title="Inviter eller legg til" onPress={() => { setMoreOpen(false); router.push(`/group/${g.id}/add-members`); }} />
        <ListRow icon="log-out" title="Forlat gjengen" destructive onPress={leaveGroup} />
      </Sheet>

      <PersonSheet person={selected} onClose={() => setSelected(null)} extra={memberActions} />
    </Screen>
  );
}
