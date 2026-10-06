import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CalendarLegend, MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { BottomBar, Button, Header, Input, KeyboardAware, PageSkeleton, PageTitle, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useInvite, useSubmitAvailability } from '@/data/hooks';
import type { InviteView } from '@/data/types';
import { monthKey } from '@/lib/dates';
import { getGuestName } from '@/lib/guestIdentity';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/**
 * The core interaction: tap the days you *can't*. Everything else is assumed to work.
 * No account needed — a first name is enough.
 */
export default function Respond() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const invite = useInvite(token);
  if (!invite.data) return <Screen><PageSkeleton /></Screen>;
  return <RespondForm invite={invite.data} />;
}

function RespondForm({ invite }: { invite: InviteView }) {
  const token = invite.token;
  const toast = useToast();
  const me = useMe();
  const submit = useSubmitAvailability(token);

  // Editing an earlier answer starts from what they said last time.
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set(invite.myResponse?.unavailableOptionIds ?? []));
  const [name, setName] = useState('');
  const [knownName, setKnownName] = useState<string | null>(null);

  useEffect(() => {
    getGuestName().then(setKnownName);
  }, []);

  const options = invite.event.options;
  const byDate = useMemo(() => new Map(options.map((o) => [o.date, o.id])), [options]);
  const months = useMemo(() => [...new Set(options.map((o) => monthKey(o.date)))].sort(), [options]);

  const needsName = !me && !invite.myResponse && !knownName;
  const responderName = me?.name ?? invite.myResponse?.name ?? knownName ?? name.trim();

  const getState = (date: string): DayState => {
    const id = byDate.get(date);
    if (!id) return 'disabled';
    return unavailable.has(id) ? 'unavailable' : 'candidate';
  };

  const toggle = (date: string) => {
    const id = byDate.get(date);
    if (!id) return;
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    try {
      await submit.mutateAsync({ name: responderName, unavailableOptionIds: [...unavailable] });
      haptics.success();
      router.replace({ pathname: '/i/[token]/done', params: { token, name: responderName } });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende svaret', tone: 'error' });
    }
  };

  const allMarked = unavailable.size === options.length && options.length > 0;
  const summary =
    unavailable.size === 0 ? 'Ingen dager markert – da kan du alle.' : allMarked ? 'Du kan ingen av dagene.' : `Du kan ikke ${unavailable.size} av ${options.length} dager.`;

  return (
    <Screen>
      <KeyboardAware>
        <Header />
        <ScreenScroll bottomInset={needsName ? 230 : 170}>
          <PageTitle title="Hvilke dager kan du ikke?" subtitle="Trykk på dagene som ikke passer for deg." />
          <View style={{ gap: spacing.xxl }}>
            {months.map((m) => (
              <MonthCalendar key={m} month={m} getState={getState} onPressDay={toggle} dayHint="Trykk for å markere at du ikke kan denne dagen" />
            ))}
          </View>
          <CalendarLegend
            items={[
              { state: 'candidate', label: 'Mulig dag' },
              { state: 'unavailable', label: 'Kan ikke' },
            ]}
          />
          <PressableScale
            onPress={() => setUnavailable(allMarked ? new Set() : new Set(options.map((o) => o.id)))}
            style={{ alignSelf: 'center', padding: spacing.md, marginTop: spacing.sm }}
            accessibilityLabel={allMarked ? 'Fjern alle markeringer' : 'Jeg kan ingen av dagene'}
          >
            <Text variant="footnote" color="textSecondary" style={{ textDecorationLine: 'underline' }}>
              {allMarked ? 'Fjern alle markeringer' : 'Jeg kan ingen av dagene'}
            </Text>
          </PressableScale>
        </ScreenScroll>
        <BottomBar>
          <Animated.View key={summary} entering={FadeIn.duration(200)}>
            <Text variant="footnote" color="textSecondary" align="center" accessibilityLiveRegion="polite">
              {summary}
            </Text>
          </Animated.View>
          {needsName ? (
            <Input placeholder="Hva heter du?" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} textContentType="givenName" autoComplete="given-name" accessibilityLabel="Navnet ditt" />
          ) : null}
          <Button variant="ink" title="Send svar" disabled={!responderName} loading={submit.isPending} onPress={send} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
