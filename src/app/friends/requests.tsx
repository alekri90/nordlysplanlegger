import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Avatar, Button, Card, EmptyState, EventListSkeleton, Header, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useFriendRequests, useFriendsRealtime, useRespondFriendRequest } from '@/data/hooks';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { profilePath } from '@/lib/username';
import { spacing } from '@/theme';

/** Requests with context ("Dere var sammen på …") so you know who it is. */
export default function FriendRequests() {
  const toast = useToast();
  const requests = useFriendRequests();
  const respond = useRespondFriendRequest();
  useFriendsRealtime();

  const answer = async (requestId: string, accept: boolean, name: string) => {
    haptics.light();
    try {
      await respond.mutateAsync({ requestId, accept });
      if (accept) toast({ message: `Du og ${name} er nå venner`, tone: 'success', icon: 'user-check' });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Noe gikk galt', tone: 'error' });
    }
  };

  return (
    <Screen>
      <Header title="Venneforespørsler" />
      <ScreenScroll bottomInset={spacing.huge}>
        {requests.isLoading ? (
          <EventListSkeleton count={2} />
        ) : requests.data?.length ? (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {requests.data.map((r) => {
              const name = firstName(r.person.name);
              return (
                <Animated.View key={r.id} exiting={FadeOut.duration(180)} layout={LinearTransition.springify().damping(20)}>
                  <Card>
                    <PressableScale
                      onPress={() => r.person.username && router.push(profilePath(r.person.username) as never)}
                      accessibilityLabel={`${r.person.name}, @${r.person.username}. ${r.context ?? ''}`}
                      style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}
                    >
                      <Avatar name={r.person.name} uri={r.person.avatarUrl} size={56} />
                      <View style={{ flex: 1 }}>
                        <Text variant="headline">{r.person.name}</Text>
                        <Text variant="footnote" color="textSecondary">
                          @{r.person.username}
                        </Text>
                        {r.context ? (
                          <Text variant="footnote" color="textTertiary" style={{ marginTop: 2 }}>
                            {r.context}
                          </Text>
                        ) : r.mutualFriends ? (
                          <Text variant="footnote" color="textTertiary" style={{ marginTop: 2 }}>
                            {r.mutualFriends} felles venner
                          </Text>
                        ) : null}
                      </View>
                    </PressableScale>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <Button title="Ignorer" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => answer(r.id, false, name)} />
                      <Button title="Godta" variant="ink" size="md" icon="check" style={{ flex: 1 }} onPress={() => answer(r.id, true, name)} />
                    </View>
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="inbox" title="Ingen nye forespørsler" body="Når noen vil legge deg til, ser du det her." action="Finn venner" onAction={() => router.replace('/friends/find')} />
        )}
      </ScreenScroll>
    </Screen>
  );
}
