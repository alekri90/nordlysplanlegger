import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { ShareGrid } from '@/components/event/ShareSheet';
import { PersonRow } from '@/components/people/PersonRow';
import { BottomBar, Button, Card, Confetti, Divider, Icon, Screen, ScreenScroll, Text } from '@/components/ui';
import type { GuestInvite } from '@/data/types';
import { useEvent } from '@/data/hooks';
import { thumb } from '@/lib/categories';
import { inviteUrl } from '@/lib/config';
import { inviteMessage, shareTo } from '@/lib/share';
import { eventDateLine, firstName } from '@/lib/eventText';
import { pushPermissionStatus, registerForPush } from '@/lib/push';
import { useCreateDraft } from '@/state/createDraft';
import { motion, radius, spacing, useColors } from '@/theme';

/** Sent! Share the link, and — only now — offer notifications. */
export default function CreateSent() {
  const colors = useColors();
  const { id, token, guests: guestsParam } = useLocalSearchParams<{ id: string; token: string; guests?: string }>();
  const guests = parseGuests(guestsParam);
  const event = useEvent(id);
  const resetDraft = useCreateDraft((s) => s.reset);
  const [askPush, setAskPush] = useState(false);

  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { ...motion.spring, damping: 11 }));
    pushPermissionStatus().then((s) => setAskPush(s === 'undetermined'));
  }, [scale]);
  const check = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const e = event.data;
  const isPoll = e?.status === 'polling';

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
            {isPoll ? 'Invitasjonen er klar!' : 'Arrangementet er klart!'}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
            {isPoll ? 'Del lenken med gjengen. De trykker på dagene de ikke kan – uten app eller konto.' : 'Del lenken, så kan alle svare om de kommer.'}
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
              </View>
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.delay(450)} style={{ marginTop: spacing.xxl }}>
          <ShareGrid
            url={inviteUrl(token ?? '')}
            title={e?.title ?? ''}
            message={inviteMessage(e?.title ?? '', inviteUrl(token ?? ''), e ? firstName(e.organizer.name) : undefined)}
          />
        </Animated.View>

        {guests.length ? (
          <Animated.View entering={FadeInDown.delay(520).duration(380)} style={{ marginTop: spacing.xxl }}>
            <Text variant="title3">Personlige lenker</Text>
            <Text variant="footnote" color="textSecondary" style={{ marginTop: 2, marginBottom: spacing.md }}>
              Til dem uten konto. Navnet deres er fylt inn når de åpner lenken.
            </Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              {guests.map((g, i) => (
                <View key={g.guestId}>
                  {i ? <Divider /> : null}
                  <PersonRow
                    person={{ id: g.guestId, name: g.name, isGuest: true }}
                    size={40}
                    trailing={
                      <Button
                        title="Send"
                        size="sm"
                        variant="ink"
                        icon="send"
                        accessibilityLabel={`Send personlig lenke til ${g.name}`}
                        onPress={() => {
                          const url = inviteUrl(g.token);
                          const organizer = e ? firstName(e.organizer.name) : undefined;
                          shareTo('more', { url, title: e?.title ?? '', message: inviteMessage(e?.title ?? '', url, organizer, firstName(g.name)) });
                        }}
                      />
                    }
                  />
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {askPush && Platform.OS !== 'web' ? (
          <Animated.View entering={FadeInDown.delay(600).duration(380)}>
            <Card muted style={{ marginTop: spacing.xxl, gap: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <Icon name="bell" size={20} color="primary" />
                <Text variant="callout" style={{ flex: 1 }}>
                  Vil du få beskjed når gjengen svarer og når alle kan samme dag?
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Ja, gi meg beskjed"
                  size="sm"
                  variant="ink"
                  onPress={async () => {
                    await registerForPush();
                    setAskPush(false);
                  }}
                />
                <Button title="Ikke nå" size="sm" variant="ghost" onPress={() => setAskPush(false)} />
              </View>
            </Card>
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
