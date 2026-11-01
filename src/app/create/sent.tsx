import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { ShareGrid } from '@/components/event/ShareSheet';
import { PersonalLinks } from '@/components/event/PersonalLinks';
import { namesLine } from '@/components/people/SelectedSummary';
import { BottomBar, Button, Card, Confetti, Icon, Screen, ScreenScroll, Text } from '@/components/ui';
import type { GuestInvite } from '@/data/types';
import { useEvent } from '@/data/hooks';
import { thumb } from '@/lib/categories';
import { inviteUrl } from '@/lib/config';
import { repeatSummary } from '@/lib/recurrence';
import { inviteMessage } from '@/lib/share';
import { eventDateLine, firstName } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { motion, radius, spacing, useColors } from '@/theme';

/** Sent! Says who has been told; the link is for whoever is left. */
export default function CreateSent() {
  const colors = useColors();
  const { id, token, guests: guestsParam } = useLocalSearchParams<{ id: string; token: string; guests?: string }>();
  const guests = parseGuests(guestsParam);
  const event = useEvent(id);
  const resetDraft = useCreateDraft((s) => s.reset);
  const [linkOpen, setLinkOpen] = useState(false);

  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { ...motion.spring, damping: 11 }));
  }, [scale]);
  const check = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const e = event.data;
  const isPoll = e?.status === 'polling';
  const notified = (e?.members ?? []).filter((m) => m.role === 'guest' && m.userId).map((m) => m.person.name);

  const finish = () => {
    resetDraft();
    router.dismissAll();
    router.push(`/event/${id}`);
  };

  return (
    <Screen>
      <Confetti count={28} />
      <ScreenScroll contentContainerStyle={{ paddingTop: spacing.xxxl }} bottomInset={130}>
        <Animated.View style={[{ alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }, check]}>
          <Icon name="check" size={38} tint="#fff" />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).duration(380)}>
          <Text variant="title1" align="center" style={{ marginTop: spacing.xl }} accessibilityRole="header">
            {notified.length ? 'Invitasjonen er sendt!' : isPoll ? 'Invitasjonen er klar!' : 'Arrangementet er klart!'}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
            {notified.length
              ? `${namesLine(notified)} har fått beskjed.`
              : isPoll
                ? 'Del lenken med gjengen. De trykker på dagene de ikke kan – uten app eller konto.'
                : 'Del lenken, så kan alle svare om de kommer.'}
          </Text>
        </Animated.View>

        {e ? (
          <Animated.View entering={FadeInDown.delay(300).duration(380)}>
            <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.xxl }}>
              <Image source={{ uri: thumb(e.coverImageUrl, 240) }} style={{ width: 56, height: 56, borderRadius: radius.md }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text variant="headline" numberOfLines={1}>
                  {e.title}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {eventDateLine(e)} · fra {firstName(e.organizer.name)}
                </Text>
                {e.series ? (
                  <Text variant="footnote" color="primary" style={{ marginTop: 2 }}>
                    {repeatSummary(e.series, e.selectedDate)}
                  </Text>
                ) : null}
              </View>
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.delay(450)} style={{ marginTop: spacing.xxl }}>
          {notified.length && !linkOpen ? (
            <Button title="Noen uten appen? Del lenken" variant="ghost" icon="link" onPress={() => setLinkOpen(true)} />
          ) : (
            <ShareGrid
              url={inviteUrl(token ?? '')}
              title={e?.title ?? ''}
              message={inviteMessage(e?.title ?? '', inviteUrl(token ?? ''), e ? firstName(e.organizer.name) : undefined)}
            />
          )}
        </Animated.View>

        {guests.length ? (
          <Animated.View entering={FadeInDown.delay(520).duration(380)} style={{ marginTop: spacing.xxl }}>
            <PersonalLinks guests={guests} title={e?.title ?? ''} organizerName={e ? firstName(e.organizer.name) : undefined} />
          </Animated.View>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button variant="ink" title="Se arrangementet" onPress={finish} />
      </BottomBar>
    </Screen>
  );
}

function parseGuests(raw?: string): GuestInvite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GuestInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
