import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EventCard } from '@/components/event/EventCard';
import { Button, Card, Divider, Icon, PressableScale, Text } from '@/components/ui';
import type { PlannerEvent } from '@/data/types';
import { thumb } from '@/lib/categories';
import { today } from '@/lib/dates';
import { eventDateLine } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { radius, spacing, useColors } from '@/theme';

const PAST_LIMIT = 5;
const STATUS_ORDER: Record<string, number> = { polling: 0, draft: 1 };

/**
 * Du er invitert (not answered yet) · Neste (date set) · Dato bestemmes (finding a date, I'm in)
 * · Tidligere (newest first). Anything I said no to is left out.
 */
export function splitEvents(events: PlannerEvent[], meId?: string) {
  const t = today();
  const invitations: PlannerEvent[] = [];
  const upcoming: PlannerEvent[] = [];
  const deciding: PlannerEvent[] = [];
  const past: PlannerEvent[] = [];
  for (const e of events) {
    if (e.status === 'cancelled') continue;
    const mine = e.members.find((m) => m.userId === meId);
    if (mine?.role === 'guest' && mine.status === 'declined') continue;
    if (e.status === 'completed' || (e.selectedDate && e.selectedDate < t)) {
      past.push(e);
      continue;
    }
    const unanswered = mine?.role === 'guest' && (mine.status === 'invited' || mine.status === 'opened');
    if ((e.status === 'polling' || e.status === 'draft') && unanswered) invitations.push(e);
    else if (e.status === 'polling' || e.status === 'draft') deciding.push(e);
    else upcoming.push(e);
  }
  upcoming.sort((a, b) => (a.selectedDate ?? '').localeCompare(b.selectedDate ?? '') || b.createdAt.localeCompare(a.createdAt));
  deciding.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  past.sort((a, b) => (b.selectedDate ?? b.createdAt).localeCompare(a.selectedDate ?? a.createdAt));
  return { invitations, upcoming, deciding, past };
}

/** A section heading you can fold away: «Dato bestemmes (3) ⌄». */
export function FoldHeader({ title, count, open, onToggle }: { title: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}, ${count}`}
      accessibilityHint={open ? 'Skjuler listen' : 'Viser listen'}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
    >
      <Text variant="title3">
        {title} ({count})
      </Text>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="textSecondary" />
    </PressableScale>
  );
}

/** «Dato bestemmes»: plans still finding their date — folds away. */
export function DecidingSection({ events, meId, initiallyOpen = true }: { events: PlannerEvent[]; meId?: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  if (!events.length) return null;
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <FoldHeader title="Dato bestemmes" count={events.length} open={open} onToggle={() => setOpen((v) => !v)} />
      {open ? (
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          {events.map((e, i) => (
            <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <EventCard event={e} meId={meId} onPress={() => router.push(`/event/${e.id}`)} />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** «Tidligere»: folded by default, small rows with «Gjør igjen». */
export function PastSection({ events, meId }: { events: PlannerEvent[]; meId?: string }) {
  const duplicateEvent = useCreateDraft((s) => s.duplicateEvent);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  if (!events.length) return null;
  const doAgain = (e: PlannerEvent) => {
    duplicateEvent(e, meId);
    router.push('/create');
  };
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <FoldHeader title="Tidligere" count={events.length} open={open} onToggle={() => setOpen((v) => !v)} />
      {open ? (
        <Card style={{ marginTop: spacing.sm, paddingVertical: spacing.xs }}>
          {(all ? events : events.slice(0, PAST_LIMIT)).map((e, i) => (
            <View key={e.id}>
              {i ? <Divider /> : null}
              <PastRow event={e} onPress={() => router.push(`/event/${e.id}`)} onAgain={() => doAgain(e)} />
            </View>
          ))}
          {events.length > PAST_LIMIT && !all ? (
            <>
              <Divider />
              <PressableScale onPress={() => setAll(true)} style={{ paddingVertical: spacing.md, alignItems: 'center' }} accessibilityRole="button">
                <Text variant="callout" color="textSecondary">
                  Vis alle {events.length}
                </Text>
              </PressableScale>
            </>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

/** A past plan, small: picture, name, date — and «Gjør igjen». */
function PastRow({ event: e, onPress, onAgain }: { event: PlannerEvent; onPress: () => void; onAgain: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <PressableScale onPress={onPress} scaleTo={0.985} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel={`${e.title}, ${eventDateLine(e)}`}>
        <Image source={{ uri: thumb(e.coverImageUrl, 160) }} style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text variant="callout" numberOfLines={1}>
            {e.title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {eventDateLine(e)}
          </Text>
        </View>
      </PressableScale>
      <Button title="Gjør igjen" size="sm" variant="secondary" icon="copy" fullWidth={false} onPress={onAgain} accessibilityLabel={`Gjør ${e.title} igjen`} />
    </View>
  );
}
