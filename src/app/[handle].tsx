import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/brand/AppLogo';
import { splitEvents } from '@/components/event/EventSections';
import { GroupBubble } from '@/components/group/GroupBubble';
import { DateRow } from '@/components/home/DateRow';
import { AddToGroupList } from '@/components/people/AddToGroupList';
import { useFriendAction } from '@/components/people/FriendButton';
import { confirmDestructive } from '@/components/people/PersonSheet';
import { ReportForm } from '@/components/people/ReportSheet';
import { ShareProfileSheet } from '@/components/people/ShareProfileSheet';
import { Avatar, AvatarStack, Button, Card, Divider, EmptyState, Header, Icon, IconButton, ListRow, PageSkeleton, PressableScale, Screen, Sheet, Text, useToast } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { useBlockUser, useEvents, usePublicProfile, useRemoveFriend } from '@/data/hooks';
import type { PublicProfile } from '@/data/types';
import { formatLong } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { useMe, useSession } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

/**
 * Profile link: samlegjengen.no/@alexk — in the app and as a mobile web page.
 * Shows only photo, name, @username, and what you have in common. Never e-mail or phone.
 *
 * Someone else: who they are, three quick actions (venn · inviter · gjeng), what you have coming
 * and have done together, shared groups and friends. The rest (fjern venn, rapporter, blokker) is
 * behind ⚙ — rarely needed, never in the way.
 */
export default function ProfileByHandle() {
  const { handle = '' } = useLocalSearchParams<{ handle: string }>();
  const isHandle = handle.startsWith('@') && handle.length > 1;
  const username = handle.slice(1);
  const status = useSession((s) => s.status);
  const profile = usePublicProfile(isHandle && status !== 'loading' ? { username } : null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const p = profile.data;
  const self = p?.friendship === 'self';
  const anonymous = p?.friendship === 'anonymous';
  const right = !p ? null : self ? (
    <IconButton icon="edit-2" onPress={() => router.push('/settings/profile')} accessibilityLabel="Rediger profilen" />
  ) : anonymous ? null : (
    <IconButton icon="settings" onPress={() => setSettingsOpen(true)} accessibilityLabel={`Innstillinger for ${firstName(p.person.name)}`} />
  );
  const back = router.canGoBack() ? <Header right={right} /> : <View style={{ height: 52, justifyContent: 'center', paddingHorizontal: gutter }}><AppLogo size={32} /></View>;

  if (!isHandle) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <EmptyState icon="compass" title="Her var det tomt" body="Siden finnes ikke, eller lenken er gammel." action="Til forsiden" onAction={() => router.replace('/')} />
      </Screen>
    );
  }
  if (profile.isLoading || status === 'loading') {
    return (
      <Screen>
        {back}
        <PageSkeleton />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen>
        {back}
        <EmptyState icon="user-x" title={`Fant ikke @${username}`} body="Profilen finnes ikke, eller personen har valgt å ikke være synlig." />
      </Screen>
    );
  }

  return (
    <Screen>
      {back}
      {self ? <SelfProfile profile={p} onShare={() => setShareOpen(true)} /> : anonymous ? <AnonymousProfile profile={p} /> : <OtherProfile profile={p} />}
      {self ? <ShareProfileSheet visible={shareOpen} onClose={() => setShareOpen(false)} /> : null}
      {!self && !anonymous ? <PersonSettings profile={p} visible={settingsOpen} onClose={() => setSettingsOpen(false)} /> : null}
    </Screen>
  );
}

/** Photo, name, @username, bio — the top of every profile. */
function Hero({ profile: p, line }: { profile: PublicProfile; line?: string | null }) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: 'center', marginTop: spacing.md }}>
      <Avatar name={p.person.name} uri={p.person.avatarUrl} size={104} />
      <Text variant="title1" align="center" style={{ marginTop: spacing.lg }} accessibilityRole="header">
        {p.person.name}
      </Text>
      <Text variant="subhead" color="textSecondary">
        @{p.person.username}
      </Text>
      {line ? (
        <Text variant="footnote" color="textTertiary" align="center" style={{ marginTop: spacing.xs }}>
          {line}
        </Text>
      ) : null}
      {p.bio ? (
        <Text variant="body" align="center" style={{ marginTop: spacing.md, maxWidth: 320 }}>
          {p.bio}
        </Text>
      ) : null}
    </Animated.View>
  );
}

function OtherProfile({ profile: p }: { profile: PublicProfile }) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const events = useEvents();
  const resetDraft = useCreateDraft((s) => s.reset);
  const setDraft = useCreateDraft((s) => s.set);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const name = firstName(p.person.name);
  const friend = useFriendAction({ userId: p.person.id, state: p.friendship, requestId: p.requestId, name });

  // What you have coming and have done together — from the plans you're both on.
  const together = useMemo(() => {
    const { upcoming, past } = splitEvents(events.data ?? [], me?.id);
    const coming = upcoming.filter((e) => e.members.some((m) => m.userId === p.person.id && m.status !== 'declined'));
    const done = past.filter((e) => e.members.some((m) => m.userId === p.person.id && (m.status === 'attending' || m.role === 'organizer')));
    return { coming: coming.slice(0, 3), more: coming.length - 3, last: done[0] ?? null, count: done.length };
  }, [events.data, me?.id, p.person.id]);

  const relation =
    friend.state === 'friends' ? 'Venner' : friend.state === 'incoming' ? `${name} vil bli venn med deg` : friend.state === 'outgoing' ? 'Venneforespørsel sendt' : null;
  // «Dere var sammen på …» only when nothing below says it better (it's also used for plans still to come).
  const context = together.coming.length || together.last ? null : p.context;
  const line = [relation, together.count ? `${together.count} ${together.count === 1 ? 'avtale' : 'avtaler'} sammen` : null, context].filter(Boolean).join(' · ');

  const invite = () => {
    resetDraft();
    setDraft({ memberIds: [p.person.id] });
    router.push('/create');
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.huge }} showsVerticalScrollIndicator={false}>
      <Hero profile={p} line={line} />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        {friend.onPress ? (
          <QuickAction icon={friend.icon} label={friend.title} onPress={friend.onPress} accessibilityLabel={friend.accessibilityLabel} strong />
        ) : null}
        <QuickAction icon="calendar" label="Inviter" onPress={invite} accessibilityLabel={`Inviter ${name} til noe`} strong={!friend.onPress} />
        <QuickAction icon="users" label="Legg i gjeng" onPress={() => setGroupsOpen(true)} accessibilityLabel={`Legg ${name} til i en gjeng`} />
      </View>

      {together.coming.length ? (
        <Section title="Neste gang dere ses">
          <Card style={{ paddingVertical: spacing.xs }}>
            {together.coming.map((e, i) => (
              <View key={e.id}>
                {i ? <Divider /> : null}
                <DateRow event={e} onPress={() => router.push(`/event/${e.id}`)} />
              </View>
            ))}
          </Card>
          {together.more > 0 ? (
            <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
              + {together.more} til i kalenderen
            </Text>
          ) : null}
        </Section>
      ) : (
        <Section title="Sammen">
          <Card muted style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name={together.last ? 'rotate-ccw' : 'calendar'} size={20} color="textSecondary" />
            <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
              {together.last
                ? `Sist: ${together.last.title}${together.last.selectedDate ? `, ${formatLong(together.last.selectedDate).toLowerCase()}` : ''}. Ingenting nytt planlagt ennå.`
                : 'Ingenting planlagt sammen ennå.'}
            </Text>
          </Card>
        </Section>
      )}

      {p.mutualGroups.length ? (
        <Section title="Felles gjenger">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.lg }} style={{ marginHorizontal: -gutter, paddingHorizontal: gutter }}>
            {p.mutualGroups.map((g) => (
              <GroupBubble key={g.id} name={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`} imageUrl={g.imageUrl ?? undefined} size={64} onPress={() => router.push(`/group/${g.id}`)} />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {p.mutualFriendCount > 0 ? (
        <Section title="Felles venner">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <AvatarStack people={p.mutualFriends} size={32} max={4} />
            <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
              {p.mutualFriends.slice(0, 3).map((f) => firstName(f.name)).join(', ')}
              {p.mutualFriendCount > 3 ? ` og ${p.mutualFriendCount - 3} til` : ''}
            </Text>
          </View>
        </Section>
      ) : null}

      <Sheet visible={groupsOpen} onClose={() => setGroupsOpen(false)} title={`Legg ${name} til i …`} scroll>
        <AddToGroupList person={p.person} onDone={() => setGroupsOpen(false)} />
      </Sheet>
    </ScrollView>
  );
}

function SelfProfile({ profile: p, onShare }: { profile: PublicProfile; onShare: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.huge }} showsVerticalScrollIndicator={false}>
      <Hero profile={p} line="Slik ser andre profilen din" />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        <Stat value={p.friendCount ?? 0} label="venner" />
        <Stat value={p.groupCount ?? 0} label="gjenger" />
      </View>
      <Button title="Del profilen" icon="share-2" variant="ink" onPress={onShare} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

/** Opened from a link without being signed in. */
function AnonymousProfile({ profile: p }: { profile: PublicProfile }) {
  const insets = useSafeAreaInsets();
  const name = firstName(p.person.name);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.huge }} showsVerticalScrollIndicator={false}>
      <Hero profile={p} line={p.context} />
      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        <Text variant="callout" color="textSecondary" align="center" style={{ marginBottom: spacing.sm }}>
          Lag en profil for å legge til {name} og planlegge ting sammen.
        </Text>
        <Button title={`Opprett profil og legg til ${name}`} onPress={() => router.push('/signup')} />
        <Button title="Logg inn" variant="ghost" onPress={() => router.push('/auth')} />
      </View>
    </ScrollView>
  );
}

/** ⚙ on someone's profile: what you rarely need — remove as friend, report, block. */
function PersonSettings({ profile: p, visible, onClose }: { profile: PublicProfile; visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const removeFriend = useRemoveFriend();
  const block = useBlockUser();
  const [reporting, setReporting] = useState(false);
  const name = firstName(p.person.name);
  const close = () => {
    setReporting(false);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={reporting ? `Rapporter ${name}` : p.person.name} subtitle={reporting ? undefined : `@${p.person.username}`} scroll>
      {reporting ? (
        <>
          <ReportForm target={{ userId: p.person.id }} onDone={close} />
          <ListRow icon="arrow-left" title="Tilbake" onPress={() => setReporting(false)} />
        </>
      ) : (
        <>
          {p.friendship === 'friends' ? (
            <ListRow
              icon="user-x"
              title="Fjern som venn"
              subtitle="Dere kan fortsatt være med i de samme gjengene"
              onPress={() =>
                confirmDestructive(`Fjerne ${name} som venn?`, 'Dere kan fortsatt være med i de samme gjengene.', 'Fjern', async () => {
                  try {
                    await removeFriend.mutateAsync(p.person.id);
                    toast(`${name} er fjernet som venn`);
                    close();
                  } catch {
                    toast({ message: 'Kunne ikke fjerne', tone: 'error' });
                  }
                })
              }
            />
          ) : null}
          <ListRow icon="flag" title={`Rapporter ${name}`} subtitle="Si fra om noe som ikke er greit" onPress={() => setReporting(true)} />
          <ListRow
            icon="slash"
            title={`Blokker ${name}`}
            subtitle="Dere ser ikke hverandre i appen lenger"
            destructive
            onPress={() =>
              confirmDestructive(
                `Blokkere ${name}?`,
                `Dere ser ikke hverandres profil lenger, vennskapet avsluttes, og ${name} kan ikke legge deg til i noe. ${name} får ikke beskjed. Du kan oppheve det under Profil → Personvern.`,
                'Blokker',
                async () => {
                  try {
                    await block.mutateAsync(p.person.id);
                    toast(`${name} er blokkert`);
                    close();
                    if (router.canGoBack()) router.back();
                  } catch (e) {
                    toast({ message: e instanceof Error ? e.message : 'Kunne ikke blokkere', tone: 'error' });
                  }
                },
              )
            }
          />
        </>
      )}
    </Sheet>
  );
}

/** One of the three round actions under the name. The first that matters is filled. */
function QuickAction({ icon, label, onPress, accessibilityLabel, strong }: { icon: IconName; label: string; onPress: () => void; accessibilityLabel: string; strong?: boolean }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: strong ? colors.primary : colors.surfaceMuted }}>
        <Icon name={icon} size={19} tint={strong ? colors.textOnPrimary : colors.text} />
      </View>
      <Text variant="footnote" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Text variant="title3" accessibilityRole="header" style={{ marginBottom: spacing.md }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.lg }}>
      <Text variant="title2">{value}</Text>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
    </Card>
  );
}
