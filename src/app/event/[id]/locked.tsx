import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ActionButton } from '@/components/event/ActionButton';
import { ShareSheet } from '@/components/event/ShareSheet';
import { SponsoredSlot } from '@/components/sponsored/SponsoredSlot';
import { BottomBar, Button, Card, Confetti, Header, Icon, PageSkeleton, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useEvent } from '@/data/hooks';
import { thumb } from '@/lib/categories';
import { formatLong, formatTime } from '@/lib/dates';
import { addEventToCalendar } from '@/lib/eventActions';
import { firstName } from '@/lib/eventText';
import { spacing } from '@/theme';

/** "Vi har en dato!" — the payoff moment. */
export default function Locked() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const event = useEvent(id);
  const [shareOpen, setShareOpen] = useState(false);

  const pop = useSharedValue(0);
  const tilt = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(80, withSpring(1, { damping: 9, stiffness: 180 }));
    tilt.value = withDelay(250, withSequence(withTiming(-12, { duration: 120 }), withTiming(10, { duration: 140 }), withSpring(0)));
  }, [pop, tilt]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { rotate: `${tilt.value}deg` }] }));

  const e = event.data;
  if (!e) return <Screen><PageSkeleton /></Screen>;

  const done = () => router.replace(`/event/${id}`);
  const coming = e.members.filter((m) => m.status === 'attending').length;

  return (
    <Screen>
      <Confetti count={44} />
      <Header back="close" onBack={done} />
      <ScreenScroll bottomInset={130}>
        <Animated.View style={[{ alignSelf: 'center', marginTop: spacing.sm }, popStyle]}>
          <Text style={{ fontSize: 64, lineHeight: 76 }} accessibilityElementsHidden importantForAccessibility="no">
            🎉
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(380)}>
          <Text variant="title1" align="center" accessibilityRole="header" accessibilityLiveRegion="assertive">
            Vi har en dato!
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
            Alle som er invitert har fått beskjed.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(420)}>
          <Card padded={false} style={{ marginTop: spacing.xxl, overflow: 'hidden' }}>
            <Image source={{ uri: thumb(e.coverImageUrl, 900) }} style={{ height: 170 }} contentFit="cover" />
            <View style={{ padding: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
              <Text variant="title2" align="center">
                {e.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="calendar" size={15} color="textSecondary" />
                <Text variant="callout" color="textSecondary">
                  {e.selectedDate ? formatLong(e.selectedDate) : ''}
                  {e.startTime ? ` · Kl. ${formatTime(e.startTime)}` : ''}
                </Text>
              </View>
              {e.location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="map-pin" size={15} color="textSecondary" />
                  <Text variant="callout" color="textSecondary">
                    {e.location.name}
                    {e.location.detailsPending ? ' (detaljer kommer)' : ''}
                  </Text>
                </View>
              ) : null}
              <Text variant="footnote" color="success" style={{ marginTop: spacing.xs }}>
                {coming} kommer
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360).duration(380)} style={{ flexDirection: 'row', marginTop: spacing.xl }}>
          <ActionButton
            icon="calendar"
            label="Legg i kalender"
            onPress={async () => {
              try {
                const msg = await addEventToCalendar(e);
                if (msg) toast({ message: msg, tone: 'success', icon: 'calendar' });
              } catch {
                toast({ message: 'Fikk ikke tilgang til kalenderen', tone: 'error' });
              }
            }}
          />
          <ActionButton icon="share-2" label="Del" onPress={() => setShareOpen(true)} />
          <ActionButton icon="edit-2" label="Endre" onPress={() => router.push(`/event/${id}/edit`)} />
        </Animated.View>

        <Button title="Inviter flere" variant="outline" icon="user-plus" onPress={() => setShareOpen(true)} style={{ marginTop: spacing.xl }} />

        <View style={{ marginTop: spacing.xxl }}>
          <SponsoredSlot placement="post_lock_venue" category={e.category} />
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button variant="ink" title="Ferdig" onPress={done} />
      </BottomBar>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} title={e.title} token={e.inviteToken} organizerName={firstName(e.organizer.name)} />
    </Screen>
  );
}
