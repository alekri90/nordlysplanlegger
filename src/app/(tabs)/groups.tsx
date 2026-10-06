import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GroupCard } from '@/components/group/GroupCard';
import { Button, Card, EmptyState, ErrorState, PageTitle, Screen, Skeleton } from '@/components/ui';
import { useGroups } from '@/data/hooks';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { gutter, radius, spacing, useColors } from '@/theme';

export default function Groups() {
  const colors = useColors();
  const me = useMe();
  const groups = useGroups();
  const prefillFromGroup = useCreateDraft((s) => s.prefillFromGroup);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge, paddingTop: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await groups.refetch();
              setRefreshing(false);
            }}
          />
        }
      >
        <PageTitle title="Gjengene dine" subtitle="Folk du gjør ting med – igjen og igjen." />

        {groups.isError ? (
          <ErrorState onRetry={() => groups.refetch()} />
        ) : groups.isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={140} rounded={radius.lg} />
            ))}
          </View>
        ) : groups.data?.length ? (
          <View style={{ gap: spacing.md }}>
            {groups.data.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(360)}>
                <GroupCard
                  group={g}
                  onPress={() => router.push(`/group/${g.id}`)}
                  onFindDate={() => {
                    prefillFromGroup(g, me?.id);
                    router.push('/create/dates');
                  }}
                />
              </Animated.View>
            ))}
            <Button title="Ny gjeng" variant="secondary" icon="plus" onPress={() => router.push('/group/new')} style={{ marginTop: spacing.sm }} />
          </View>
        ) : (
          <Card muted padded={false}>
            <EmptyState
              icon="users"
              title="Ingen gjenger ennå"
              body="Lagre folk du gjør ting med som en gjeng. Neste gang er det ett trykk."
              action="Lag en gjeng"
              onAction={() => router.push('/group/new')}
            />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
