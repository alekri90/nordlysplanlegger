import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { TimePicker } from '@/components/create/TimePicker';
import { Avatar, BottomBar, Button, Card, Confetti, Header, Icon, IconButton, PressableScale, Screen, ScreenScroll, Sheet, Text, useToast } from '@/components/ui';
import { useEventRealtime, useLockDate, useUpdateEvent } from '@/data/hooks';
import type { PlannerEvent, TimeHint } from '@/data/types';
import { formatDayMonth, formatLong } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { repeatSummary } from '@/lib/recurrence';
import { shortNames } from '@/lib/names';
import { hasResponded, rankDateOptions, responseProgress } from '@/lib/ranking';
import { spacing } from '@/theme';
import { DateResultRow } from './DateResultRow';
import { EventMessages } from './EventMessages';
import { ShareSheet } from './ShareSheet';

const VISIBLE = 5;

/** The organizer's live overview: who answered, which date wins, lock it. */
export function ResultsView({ event }: { event: PlannerEvent }) {
  const toast = useToast();
  const lock = useLockDate(event.id);
  const update = useUpdateEvent(event.id);
  const [showAll, setShowAll] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [time, setTime] = useState<{ hint: TimeHint; time: string | null }>({
    hint: event.startTime ? 'exact' : event.timeHint === 'evening' ? 'exact' : event.timeHint,
    time: event.startTime ?? (event.timeHint === 'evening' ? '18:00' : null),
  });

  useEventRealtime(event.id, () => {
    haptics.light();
    toast({ message: 'Nytt svar kom inn', icon: 'user-check' });
  });

  const scores = useMemo(() => rankDateOptions(event.options, event.members), [event.options, event.members]);
  const progress = responseProgress(event.members);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const best = scores[0];
  const selected = scores.find((s) => s.option.id === selectedId) ?? best;
  const everyoneCan = best?.everyoneCan ?? false;
  const short = useMemo(() => shortNames(event.members.map((m) => ({ id: m.id, name: m.person.name }))), [event.members]);
  const nameOf = (memberId: string) => short.get(memberId) ?? '';

  const pending = event.members.filter((m) => !hasResponded(m));
  const respondents = event.members.filter(hasResponded);

  const confirmLock = async () => {
    if (!selected) return;
    try {
      if (time.hint !== event.timeHint || time.time !== event.startTime) await update.mutateAsync({ timeHint: time.hint, startTime: time.time });
      await lock.mutateAsync(selected.option.id);
      setConfirmOpen(false);
      haptics.success();
      router.replace(`/event/${event.id}/locked`);
    } catch {
      toast({ message: 'Kunne ikke låse datoen. Prøv igjen.', tone: 'error' });
    }
  };

  return (
    <Screen>
      <Confetti active={everyoneCan} count={30} />
      <Header right={<IconButton icon="share" accessibilityLabel="Del invitasjonen" onPress={() => setShareOpen(true)} />} />
      <ScreenScroll bottomInset={140}>
        <Animated.View entering={FadeIn.duration(260)} style={{ marginBottom: spacing.xl }}>
          <Text variant="overline" color="textSecondary">
            {event.title}
          </Text>
          <Text variant="title1" style={{ marginTop: spacing.xs }} accessibilityRole="header" accessibilityLiveRegion="polite">
            {progress.responded} av {progress.invited} har svart
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
            {everyoneCan && best ? `Alle kan ${formatDayMonth(best.option.date)}! 🎉` : 'Her er oversikten over hva som passer.'}
          </Text>
          {event.series && event.series.status !== 'ended' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
              <Icon name="repeat" size={14} color="textSecondary" />
              <Text variant="footnote" color="textSecondary">
                {repeatSummary(event.series, null)}
                {event.series.status === 'paused' ? ' · på pause' : ''}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {scores.length ? (
          <View style={{ gap: spacing.sm }}>
            {(showAll ? scores : scores.slice(0, VISIBLE)).map((s, i) => (
              <DateResultRow
                key={s.option.id}
                score={s}
                index={i}
                selected={selected?.option.id === s.option.id}
                onPress={() => setSelectedId(s.option.id)}
                unavailableNames={s.unavailableMemberIds.map(nameOf)}
              />
            ))}
            {scores.length > VISIBLE ? (
              <PressableScale onPress={() => setShowAll((v) => !v)} style={{ alignSelf: 'center', padding: spacing.md }} accessibilityLabel={showAll ? 'Vis færre datoer' : 'Vis alle datoer'}>
                <Text variant="footnote" color="textSecondary">
                  {showAll ? 'Vis færre' : `Vis alle ${scores.length} datoene`}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : (
          <Card muted>
            <Text variant="body" color="textSecondary">
              Ingen datoer å velge mellom ennå.
            </Text>
          </Card>
        )}

        <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
          Svar fra gjestene
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {respondents.map((m) => (
            <View key={m.id} style={{ alignItems: 'center', width: 56, gap: 4 }}>
              <Avatar name={m.person.name} uri={m.person.avatarUrl} size={48} status="attending" />
              <Text variant="caption" numberOfLines={1}>
                {nameOf(m.id)}
              </Text>
            </View>
          ))}
          {pending.map((m) => (
            <View key={m.id} style={{ alignItems: 'center', width: 56, gap: 4, opacity: 0.45 }} accessibilityLabel={`${m.person.name} har ikke svart`}>
              <Avatar name={m.person.name} uri={m.person.avatarUrl} size={48} />
              <Text variant="caption" numberOfLines={1}>
                {nameOf(m.id)}
              </Text>
            </View>
          ))}
        </View>

        {pending.length ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card muted style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                Venter på {pending.slice(0, 3).map((m) => nameOf(m.id)).join(', ')}
                {pending.length > 3 ? ` og ${pending.length - 3} til` : ''}
              </Text>
              <Button title="Minn på" size="sm" variant="secondary" icon="send" onPress={() => setShareOpen(true)} />
            </Card>
          </Animated.View>
        ) : null}

        <EventMessages eventId={event.id} isOrganizer style={{ marginTop: spacing.xl }} />
      </ScreenScroll>

      <BottomBar>
        <Button
          variant="ink"
          title={selected ? `Lås ${formatDayMonth(selected.option.date)}` : 'Lås dato'}
          icon="lock"
          disabled={!selected}
          onPress={() => setConfirmOpen(true)}
          accessibilityHint="Bekreft datoen og gi beskjed til alle"
        />
      </BottomBar>

      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} title={event.title} token={event.inviteToken} organizerName={firstName(event.organizer.name)} />

      <Sheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={selected ? `Lås ${formatLong(selected.option.date).toLowerCase()}?` : ''}
        subtitle={`Alle ${progress.invited} får beskjed med en gang.${pending.length ? ` ${pending.length} har ikke svart ennå.` : ''}`}
      >
        <TimePicker hint={time.hint} time={time.time} allowHints={false} onChange={(hint, t) => setTime({ hint, time: t })} />
        <Button variant="ink" title="Lås datoen" icon="lock" loading={lock.isPending || update.isPending} onPress={confirmLock} style={{ marginTop: spacing.xl }} />
        <Button variant="ghost" title="Ikke ennå" onPress={() => setConfirmOpen(false)} style={{ marginTop: spacing.xs }} />
      </Sheet>
    </Screen>
  );
}
