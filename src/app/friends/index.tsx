import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';

import { PersonRow } from '@/components/people/PersonRow';
import { PersonSheet } from '@/components/people/PersonSheet';
import { Card, EmptyState, EventListSkeleton, Header, Icon, Input, PressableScale, Screen, Text } from '@/components/ui';
import { useFriendRequests, useFriends, useFriendsRealtime } from '@/data/hooks';
import type { Person } from '@/data/types';
import { gutter, radius, spacing, useColors } from '@/theme';

/** Your friends, A–Z. Tap someone for quick actions; requests and "find friends" up top. */
export default function Friends() {
  const colors = useColors();
  const friends = useFriends();
  const requests = useFriendRequests();
  useFriendsRealtime();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    const list = (friends.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q) || (f.username ?? '').toLowerCase().includes(q));
    const byLetter = new Map<string, Person[]>();
    for (const f of list) {
      const letter = f.name.charAt(0).toUpperCase();
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), f]);
    }
    return [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b, 'nb')).map(([title, data]) => ({ title, data }));
  }, [friends.data, query]);

  const pending = requests.data?.length ?? 0;

  return (
    <Screen>
      <Header title="Venner" />
      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Shortcut icon="user-plus" title="Finn venner" onPress={() => router.push('/friends/find')} />
              <Shortcut icon="inbox" title="Forespørsler" badge={pending} onPress={() => router.push('/friends/requests')} />
            </View>
            {(friends.data?.length ?? 0) > 6 ? <Input icon="search" placeholder="Søk i vennene dine" value={query} onChangeText={setQuery} clearable /> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="overline" color="textTertiary" style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => <PersonRow person={item} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          friends.isLoading ? (
            <EventListSkeleton count={2} />
          ) : (
            <Card muted padded={false}>
              <EmptyState
                icon="users"
                title={query ? 'Ingen treff' : 'Ingen venner ennå'}
                body={query ? undefined : 'Legg til folk du gjør ting med, så kan dere invitere hverandre direkte.'}
                action={query ? undefined : 'Finn venner'}
                onAction={() => router.push('/friends/find')}
              />
            </Card>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 60 }} />}
      />
      <PersonSheet person={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function Shortcut({ icon, title, badge, onPress }: { icon: 'user-plus' | 'inbox'; title: string; badge?: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={badge ? `${title}, ${badge} nye` : title}
      style={{ flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Icon name={icon} size={20} />
        {badge ? (
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text variant="caption" style={{ color: '#fff' }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="headline">{title}</Text>
    </PressableScale>
  );
}
