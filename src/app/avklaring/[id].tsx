import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ShareGrid } from '@/components/event/ShareSheet';
import { confirmDestructive } from '@/components/people/PersonSheet';
import { BottomBar, Button, Card, EmptyState, Header, Icon, ListRow, PageSkeleton, PageTitle, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useCancelDateClearance, useDateClearance, useInviteFromClearance } from '@/data/hooks';
import type { ClearanceDay, DateClearance } from '@/data/types';
import { clearanceSummary, okDates, type ClearanceInviteMode } from '@/lib/clearance';
import { clearanceUrl } from '@/lib/config';
import { formatLong } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { clearanceMessage } from '@/lib/share';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/** The organizer's view of «Avklar med noen først»: waiting → the answer → invite the group. */
export default function ClearancePage() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const q = useDateClearance(id);
  if (q.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!q.data) {
    return (
      <Screen>
        <Header back="back" />
        <EmptyState icon="help-circle" title="Fant ikke forespørselen" body="Den kan være avbrutt." />
      </Screen>
    );
  }
  return <ClearanceView c={q.data} fresh={fresh === '1'} />;
}

function DayRow({ day, answered }: { day: ClearanceDay; answered: boolean }) {
  const icon = !answered || day.ok === null ? 'clock' : day.ok ? 'check-circle' : 'x-circle';
  const label = !answered || day.ok === null ? 'Venter' : day.ok ? 'Passer' : 'Passer ikke';
  return (
    <View accessible accessibilityLabel={`${formatLong(day.date)}: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <Icon name={icon} size={18} color={!answered || day.ok === null ? 'textTertiary' : day.ok ? 'success' : 'danger'} />
      <Text variant="body" style={{ flex: 1, opacity: answered && day.ok === false ? 0.55 : 1 }}>
        {formatLong(day.date)}
      </Text>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

function ClearanceView({ c, fresh }: { c: DateClearance; fresh: boolean }) {
  const toast = useToast();
  const me = useMe();
  const invite = useInviteFromClearance();
  const cancel = useCancelDateClearance();
  const [mode, setMode] = useState<ClearanceInviteMode>('each');
  const answered = c.status === 'answered' || c.status === 'done';
  const ok = okDates(c.days);
  const key = firstName(c.keyName);
  const invitees = c.draft.memberIds.length + (c.draft.guestIds?.length ?? 0) + (c.draft.guestNames?.length ?? 0);
  const url = clearanceUrl(c.token);

  const go = async () => {
    try {
      const { first, count } = await invite.mutateAsync({ clearance: c, mode: ok.length > 1 ? mode : 'each' });
      haptics.success();
      if (count > 1) toast({ message: `${count} arrangementer er laget`, tone: 'success' });
      router.replace({ pathname: '/create/sent', params: { id: first.eventId, token: first.inviteToken, guests: JSON.stringify(first.guests) } });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Noe gikk galt. Prøv igjen.', tone: 'error' });
    }
  };

  const stop = () =>
    confirmDestructive('Avbryte forespørselen?', `Lenken til ${key} slutter å virke, og ingen blir invitert.`, 'Avbryt forespørselen', async () => {
      await cancel.mutateAsync(c.id);
      toast(`Forespørselen er avbrutt`);
      router.back();
    });

  return (
    <Screen>
      <Header back="back" />
      <ScreenScroll bottomInset={answered && c.status !== 'done' && ok.length ? 220 : 60}>
        <PageTitle title={c.title} subtitle={`Avklares med ${c.keyName} · ${clearanceSummary(c.days, answered)}`} />

        {c.status === 'pending' ? (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Icon name="clock" size={20} color="textSecondary" />
              <Text variant="body" style={{ flex: 1 }}>
                {c.keyUserId
                  ? `${key} har fått beskjed. Du får varsel når hen har svart.`
                  : fresh
                    ? `Send lenken til ${key}, så kan hen krysse av dagene. Hen trenger ikke appen.`
                    : `Venter på svar fra ${key}. Har hen ikke fått lenken? Send den her.`}
              </Text>
            </View>
            {!c.keyUserId ? <ShareGrid url={url} title={c.title} message={clearanceMessage(c.title, url, me ? firstName(me.name) : undefined, key)} /> : null}
          </Card>
        ) : null}

        {c.reply ? (
          <Card muted style={{ marginTop: spacing.lg }}>
            <Text variant="footnote" color="textSecondary">
              {key} skrev
            </Text>
            <Text variant="body" style={{ marginTop: 4 }}>
              «{c.reply}»
            </Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.sm }}>
          {c.days.map((d) => (
            <DayRow key={d.date} day={d} answered={answered} />
          ))}
        </Card>

        {c.status === 'answered' && ok.length > 1 ? (
          <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.xs }}>
            <ListRow title="Ett arrangement for hver dag" subtitle={`${ok.length} arrangementer med de samme folkene`} radio selected={mode === 'each'} onPress={() => setMode('each')} />
            <ListRow title="Gjengen velger én av dagene" subtitle="Som «Finn en dato», med dagene som passer" radio selected={mode === 'poll'} onPress={() => setMode('poll')} />
          </Card>
        ) : null}

        {c.status === 'answered' && !ok.length ? (
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.lg }}>
            Ingen av dagene passet. Avbryt denne og lag en ny forespørsel med andre dager.
          </Text>
        ) : null}

        {c.status === 'done' ? (
          <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.xs }}>
            <Text variant="footnote" color="textSecondary" style={{ paddingTop: spacing.sm }}>
              Invitert
            </Text>
            {c.eventIds.map((eid, i) => (
              <ListRow key={eid} icon="calendar" title={c.eventIds.length > 1 ? `${c.title} · ${formatLong(ok[i] ?? ok[0])}` : c.title} chevron onPress={() => router.push(`/event/${eid}`)} />
            ))}
          </Card>
        ) : null}

        {c.status !== 'done' ? (
          <Button variant="ghost" title="Avbryt forespørselen" onPress={stop} style={{ marginTop: spacing.xl }} />
        ) : null}
      </ScreenScroll>

      {c.status === 'answered' && ok.length ? (
        <BottomBar>
          <Button
            variant="ink"
            icon="send"
            title={
              invitees
                ? mode === 'each' && ok.length > 1
                  ? `Inviter til ${ok.length} dager · ${invitees + 1} personer`
                  : `Inviter · ${invitees + 1} personer`
                : 'Lag arrangementet'
            }
            loading={invite.isPending}
            onPress={go}
          />
        </BottomBar>
      ) : null}
    </Screen>
  );
}
