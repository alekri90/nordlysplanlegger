import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/brand/AppLogo';
import { FriendButton } from '@/components/people/FriendButton';
import { ShareProfileSheet } from '@/components/people/ShareProfileSheet';
import { Avatar, AvatarStack, Button, Card, EmptyState, Header, PageSkeleton, Screen, Tag, Text } from '@/components/ui';
import { usePublicProfile } from '@/data/hooks';
import { firstName } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { useSession } from '@/state/session';
import { gutter, spacing } from '@/theme';

/**
 * Profile link: planlegger.nkx.no/@alexk — in the app and as a mobile web page.
 * Shows only photo, name, @username, and what you have in common. Never e-mail or phone.
 */
export default function ProfileByHandle() {
  const { handle = '' } = useLocalSearchParams<{ handle: string }>();
  const isHandle = handle.startsWith('@') && handle.length > 1;
  const username = handle.slice(1);
  const status = useSession((s) => s.status);
  const profile = usePublicProfile(isHandle && status !== 'loading' ? { username } : null);
  const insets = useSafeAreaInsets();
  const resetDraft = useCreateDraft((s) => s.reset);
  const setDraft = useCreateDraft((s) => s.set);
  const [shareOpen, setShareOpen] = useState(false);

  const back = router.canGoBack() ? <Header /> : <View style={{ height: 52, justifyContent: 'center', paddingHorizontal: gutter }}><AppLogo size={32} /></View>;

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
  if (!profile.data) {
    return (
      <Screen>
        {back}
        <EmptyState icon="user-x" title={`Fant ikke @${username}`} body="Profilen finnes ikke, eller personen har valgt å ikke være synlig." />
      </Screen>
    );
  }

  const p = profile.data;
  const name = firstName(p.person.name);
  const self = p.friendship === 'self';
  const anonymous = p.friendship === 'anonymous';

  return (
    <Screen>
      {back}
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.huge }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Avatar name={p.person.name} uri={p.person.avatarUrl} size={112} />
          <Text variant="title1" align="center" style={{ marginTop: spacing.lg }} accessibilityRole="header">
            {p.person.name}
          </Text>
          <Text variant="body" color="textSecondary">
            @{p.person.username}
          </Text>
          {p.bio ? (
            <Text variant="body" align="center" style={{ marginTop: spacing.md, maxWidth: 320 }}>
              {p.bio}
            </Text>
          ) : null}
          {p.context ? (
            <View style={{ marginTop: spacing.md }}>
              <Tag label={p.context} icon="calendar" />
            </View>
          ) : null}
        </Animated.View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          {self ? (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Stat value={p.friendCount ?? 0} label="venner" />
                <Stat value={p.groupCount ?? 0} label="gjenger" />
              </View>
              <Button title="Del profilen" icon="share-2" variant="ink" onPress={() => setShareOpen(true)} style={{ marginTop: spacing.md }} />
            </>
          ) : anonymous ? (
            <>
              <Text variant="callout" color="textSecondary" align="center" style={{ marginBottom: spacing.sm }}>
                Lag en profil for å legge til {name} og planlegge ting sammen.
              </Text>
              <Button title={`Opprett profil og legg til ${name}`} onPress={() => router.push('/signup')} />
              <Button title="Logg inn" variant="ghost" onPress={() => router.push('/auth')} />
            </>
          ) : (
            <>
              <FriendButton userId={p.person.id} state={p.friendship} requestId={p.requestId} size="md" name={name} />
              <Button
                title={`Inviter ${name} til noe`}
                icon="calendar"
                variant="secondary"
                onPress={() => {
                  resetDraft();
                  setDraft({ memberIds: [p.person.id] });
                  router.push('/create');
                }}
              />
            </>
          )}
        </View>

        {!self && !anonymous && (p.mutualFriendCount > 0 || p.mutualGroups.length > 0) ? (
          <Card style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
            {p.mutualFriendCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <AvatarStack people={p.mutualFriends} size={30} max={4} />
                <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
                  {p.mutualFriendCount} felles {p.mutualFriendCount === 1 ? 'venn' : 'venner'}: {p.mutualFriends.slice(0, 3).map((f) => firstName(f.name)).join(', ')}
                  {p.mutualFriendCount > 3 ? ' …' : ''}
                </Text>
              </View>
            ) : null}
            {p.mutualGroups.length ? (
              <View>
                <Text variant="footnote" color="textTertiary" style={{ marginBottom: spacing.sm }}>
                  Felles gjenger
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {p.mutualGroups.map((g) => (
                    <Button key={g.id} title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`} size="sm" variant="secondary" onPress={() => router.push(`/group/${g.id}`)} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
      {self ? <ShareProfileSheet visible={shareOpen} onClose={() => setShareOpen(false)} /> : null}
    </Screen>
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
