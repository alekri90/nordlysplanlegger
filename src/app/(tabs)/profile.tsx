import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { ShareProfileSheet } from '@/components/people/ShareProfileSheet';
import { Avatar, Button, Card, Divider, ListRow, PressableScale, Screen, Tag, Text } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useEvents, useFriendRequests, useFriends, useFriendsRealtime, useGroups } from '@/data/hooks';
import { isDemoMode } from '@/lib/config';
import { today } from '@/lib/dates';
import { eventDateLine } from '@/lib/eventText';
import { useMe, usePlan } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

export default function Profile() {
  const me = useMe();
  const { isPlus } = usePlan();
  const events = useEvents();
  const groups = useGroups();
  const friends = useFriends();
  const requests = useFriendRequests();
  useFriendsRealtime();
  const [shareOpen, setShareOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const upcoming = useMemo(() => {
    const t = today();
    return (events.data ?? [])
      .filter((e) => ['polling', 'confirmed', 'date_selected', 'draft'].includes(e.status) && (!e.selectedDate || e.selectedDate >= t))
      .sort((a, b) => (a.selectedDate ?? '9999').localeCompare(b.selectedDate ?? '9999'))
      .slice(0, 3);
  }, [events.data]);

  const signOut = async () => {
    const run = async () => {
      setSigningOut(true);
      await repo.signOut();
      queryClient.clear();
      router.replace('/welcome');
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Logge ut?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Logg ut', style: 'destructive', onPress: run },
    ]);
  };

  const pending = requests.data?.length ?? 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: spacing.xxl, paddingBottom: spacing.huge }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center' }}>
          <Avatar name={me?.name ?? ''} uri={me?.avatarUrl} size={104} />
          <Text variant="title1" style={{ marginTop: spacing.md }} align="center">
            {me?.name || 'Deg'}
          </Text>
          <Text variant="body" color="textSecondary">
            @{me?.username}
          </Text>
          {me?.bio ? (
            <Text variant="subhead" align="center" style={{ marginTop: spacing.sm, maxWidth: 300 }}>
              {me.bio}
            </Text>
          ) : null}
          {isPlus ? (
            <View style={{ marginTop: spacing.sm }}>
              <Tag label="Plus" tone="primary" />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <Stat value={friends.data?.length ?? 0} label="venner" onPress={() => router.push('/friends')} badge={pending} />
          <Stat value={groups.data?.length ?? 0} label="gjenger" onPress={() => router.push('/(tabs)/groups')} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button title="Rediger profil" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/settings/profile')} />
          <Button title="Min QR" variant="secondary" size="md" icon="maximize" style={{ flex: 1 }} onPress={() => setShareOpen(true)} />
        </View>

        {upcoming.length ? (
          <View style={{ marginTop: spacing.xxl }}>
            <Text variant="title3" style={{ marginBottom: spacing.md }}>
              Kommende
            </Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              {upcoming.map((e, i) => (
                <View key={e.id}>
                  {i ? <Divider /> : null}
                  <ListRow icon="calendar" title={e.title} subtitle={eventDateLine(e)} chevron onPress={() => router.push(`/event/${e.id}`)} />
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <Card style={{ marginTop: spacing.xxl, paddingVertical: spacing.xs }}>
          <ListRow
            icon="users"
            title="Venner"
            subtitle={pending ? `${pending} ${pending === 1 ? 'ny forespørsel' : 'nye forespørsler'}` : 'Finn og legg til venner'}
            chevron
            onPress={() => router.push('/friends')}
          />
          <Divider />
          <ListRow icon="bell" title="Varsler" subtitle="Velg hva du vil få beskjed om" chevron onPress={() => router.push('/settings/notifications')} />
          <Divider />
          <ListRow icon="shield" title="Personvern" subtitle="Hvem kan finne meg, blokkerte, eksport og sletting" chevron onPress={() => router.push('/settings/privacy')} />
          <Divider />
          <ListRow icon="help-circle" title="Hjelp og kontakt" subtitle="Spørsmål, vilkår og personvernerklæring" chevron onPress={() => router.push('/support')} />
        </Card>

        <Card style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}>
          <ListRow icon="log-out" title={signingOut ? 'Logger ut …' : 'Logg ut'} onPress={signOut} />
        </Card>

        <Text variant="caption" color="textTertiary" align="center" style={{ marginTop: spacing.xl }}>
          Nordlys Planlegger {Constants.expoConfig?.version ?? ''}
          {isDemoMode ? ' · Demomodus' : ''}
        </Text>
      </ScrollView>
      <ShareProfileSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Screen>
  );
}

function Stat({ value, label, onPress, badge }: { value: number; label: string; onPress: () => void; badge?: number }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${value} ${label}${badge ? `, ${badge} nye forespørsler` : ''}`}
      style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <Text variant="title2">{value}</Text>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
      {badge ? <View style={{ position: 'absolute', top: 10, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
    </PressableScale>
  );
}
