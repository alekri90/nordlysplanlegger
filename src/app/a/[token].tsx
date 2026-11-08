import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, BottomBar, Button, Card, EmptyState, Icon, Input, PageSkeleton, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useAnswerDateClearance, useClearanceByToken } from '@/data/hooks';
import type { ClearanceView } from '@/data/types';
import { groupByWeek } from '@/lib/clearance';
import { formatLong } from '@/lib/dates';
import { timeHintLabel } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useColors } from '@/theme';

/**
 * The key person's page («Avklar med noen først»), no account needed: tick the days that work,
 * add a word if you like, send. The organizer is told and invites the group afterwards.
 */
export default function ClearanceAnswerPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const q = useClearanceByToken(token);
  if (q.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!q.data) {
    return (
      <Screen>
        <EmptyState icon="link-2" title="Lenken virker ikke" body="Forespørselen kan være avbrutt. Spør den som sendte den." />
      </Screen>
    );
  }
  return <Answer c={q.data} />;
}

function Answer({ c }: { c: ClearanceView }) {
  const colors = useColors();
  const toast = useToast();
  const answer = useAnswerDateClearance(c.token);
  const answered = c.status === 'answered';
  const locked = c.status === 'done';
  const [ok, setOk] = useState<Set<string>>(() => new Set(c.days.filter((d) => d.ok).map((d) => d.date)));
  const [reply, setReply] = useState(c.reply ?? '');
  const [sent, setSent] = useState(false);
  const all = c.days.map((d) => d.date);
  const org = c.organizer.name;

  const toggle = (date: string) => {
    if (locked) return;
    haptics.tap();
    const next = new Set(ok);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setOk(next);
  };

  const send = async () => {
    try {
      await answer.mutateAsync({ okDates: [...ok], reply: reply.trim() || null });
      haptics.success();
      setSent(true);
    } catch {
      toast({ message: 'Kunne ikke sende. Prøv igjen.', tone: 'error' });
    }
  };

  if (sent) {
    return (
      <Screen>
        <EmptyState
          icon="check-circle"
          title="Takk!"
          body={`${org} har fått beskjed om at ${ok.size === all.length ? 'alle dagene passer' : ok.size ? `${ok.size} av ${all.length} dager passer` : 'ingen av dagene passer'}. Du kan endre svaret med den samme lenken.`}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScroll bottomInset={locked ? 60 : 200} contentContainerStyle={{ paddingTop: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={org} uri={c.organizer.avatarUrl} size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="title2" accessibilityRole="header">
              {org} lurer på hvilke dager som passer
            </Text>
          </View>
        </View>

        <Card muted style={{ marginTop: spacing.xl, gap: 4 }}>
          <Text variant="headline">{c.title}</Text>
          <Text variant="footnote" color="textSecondary">
            {timeHintLabel(c.timeHint, c.startTime)}
            {c.placeName ? ` · ${c.placeName}` : ''}
          </Text>
          {c.note ? (
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              «{c.note}»
            </Text>
          ) : null}
        </Card>

        {locked ? (
          <Card style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name="check-circle" size={20} color="success" />
            <Text variant="body" style={{ flex: 1 }}>
              {org} har sett svaret ditt og invitert. Takk!
            </Text>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl }}>
            <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
              {answered ? 'Du har svart. Du kan endre det til det er invitert.' : 'Trykk på dagene som passer.'}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              title={ok.size === all.length ? 'Fjern alle' : 'Passer alle'}
              onPress={() => setOk(ok.size === all.length ? new Set() : new Set(all))}
            />
          </View>
        )}

        {groupByWeek(all).map((w) => (
          <View key={w.label + w.dates[0]} style={{ marginTop: spacing.lg }}>
            <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm }}>
              {w.label}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {w.dates.map((date) => {
                const on = ok.has(date);
                return (
                  <PressableScale
                    key={date}
                    onPress={() => toggle(date)}
                    disabled={locked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: locked }}
                    accessibilityLabel={`${formatLong(date)}, ${on ? 'passer' : 'passer ikke'}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: on ? colors.success : colors.border,
                      backgroundColor: on ? colors.successSoft : colors.surface,
                    }}
                  >
                    <Icon name={on ? 'check-circle' : 'circle'} size={22} color={on ? 'success' : 'textTertiary'} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {formatLong(date)}
                    </Text>
                    <Text variant="footnote" color={on ? 'success' : 'textSecondary'}>
                      {on ? 'Passer' : 'Passer ikke'}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))}

        {!locked ? (
          <View style={{ marginTop: spacing.xl }}>
            <Input
              label={`Melding til ${org} (valgfritt)`}
              placeholder="F.eks. «Torsdager er jeg bortreist»"
              value={reply}
              onChangeText={setReply}
              multiline
              maxLength={500}
              style={{ minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' }}
            />
          </View>
        ) : null}
      </ScreenScroll>
      {!locked ? (
        <BottomBar>
          <Button
            variant="ink"
            icon="send"
            title={ok.size === 0 ? 'Ingen passer – send svar' : `Send svar · ${ok.size} av ${all.length} passer`}
            loading={answer.isPending}
            onPress={send}
          />
        </BottomBar>
      ) : null}
    </Screen>
  );
}
