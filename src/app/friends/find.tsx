import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FriendButton } from '@/components/people/FriendButton';
import { PersonRow } from '@/components/people/PersonRow';
import { ShareProfileSheet } from '@/components/people/ShareProfileSheet';
import { Card, EventListSkeleton, Header, Icon, Input, KeyboardAware, PressableScale, Screen, ScreenScroll, SectionHeader, Text } from '@/components/ui';
import { usePeopleYouMayKnow, useSearchPeople } from '@/data/hooks';
import type { PersonResult } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { profilePath } from '@/lib/username';
import { spacing, useColors } from '@/theme';

function detail(p: PersonResult) {
  const parts = [];
  if (p.mutualFriends) parts.push(`${p.mutualFriends} felles ${p.mutualFriends === 1 ? 'venn' : 'venner'}`);
  if (p.mutualGroups) parts.push(`${p.mutualGroups} felles ${p.mutualGroups === 1 ? 'gjeng' : 'gjenger'}`);
  return parts.join(' · ') || null;
}

/** Search by name or @username. Before typing: discreet, relevant suggestions from your own history. */
export default function FindFriends() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const search = useSearchPeople(query);
  const pymk = usePeopleYouMayKnow();
  const searching = query.trim().replace(/^@/, '').length >= 2;

  const row = (p: PersonResult, sub?: string | null) => (
    <PersonRow
      key={p.id}
      person={p}
      detail={sub}
      onPress={() => router.push(profilePath(p.username) as never)}
      trailing={<FriendButton userId={p.id} state={p.friendship} name={firstName(p.name)} />}
    />
  );

  return (
    <Screen>
      <KeyboardAware>
        <Header title="Finn venner" />
        <ScreenScroll bottomInset={spacing.huge}>
          <Input icon="search" placeholder="Navn eller @brukernavn" value={query} onChangeText={setQuery} clearable autoFocus autoCapitalize="none" autoCorrect={false} />

          {searching ? (
            <View style={{ marginTop: spacing.lg }}>
              {search.isLoading && !search.data ? <EventListSkeleton count={2} /> : null}
              {(search.data ?? []).map((p) => row(p, detail(p)))}
              {search.data && !search.data.length ? (
                <Text variant="subhead" color="textSecondary" style={{ paddingVertical: spacing.xl }} align="center">
                  Ingen treff på «{query.trim()}». Noen kan ha valgt å ikke være søkbare.
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <PressableScale onPress={() => setShareOpen(true)} accessibilityLabel="Del profilen din">
                <Card muted style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="share-2" size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="callout">Del profilen din</Text>
                    <Text variant="footnote" color="textSecondary">
                      Lenke eller QR-kode – så kan venner legge deg til.
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color="textTertiary" />
                </Card>
              </PressableScale>

              {pymk.data?.length ? (
                <View style={{ marginTop: spacing.xxl }}>
                  <SectionHeader title="Personer du kanskje kjenner" />
                  {pymk.data.map((p) => row(p, p.context))}
                </View>
              ) : null}
            </>
          )}
        </ScreenScroll>
      </KeyboardAware>
      <ShareProfileSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Screen>
  );
}
