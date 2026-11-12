import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card, Divider, Icon, ListRow, PressableScale, Text, Toggle } from '@/components/ui';
import { formatLong } from '@/lib/dates';
import { spacing } from '@/theme';

/**
 * «Inviter deltagere nå» or «senere» — for all the events at once, and per event if needed.
 * Sending the request to the role (sauna master) is a separate thing and always happens.
 */
export function InviteTiming({
  inviteNow,
  overrides,
  dates,
  roleLabel,
  roleDefinite,
  onChange,
}: {
  inviteNow: boolean;
  overrides: Record<string, boolean>;
  /** One per event; one or none for a single event. */
  dates: string[];
  roleLabel: string;
  /** «badstumesteren» */
  roleDefinite: string;
  onChange: (patch: { inviteNow?: boolean; inviteOverrides?: Record<string, boolean> }) => void;
}) {
  const [perDate, setPerDate] = useState(Object.keys(overrides).length > 0);
  const many = dates.length > 1;
  const on = (d: string) => overrides[d] ?? inviteNow;
  const nowCount = dates.filter(on).length;

  const laterCount = dates.length - nowCount;
  const steps = [
    `${roleLabel[0].toUpperCase()}${roleLabel.slice(1)} får forespørselen og svarer per dato.`,
    nowCount ? `${nowCount === dates.length ? (dates.length > 1 ? 'Alle datoene' : 'Datoen') : `${nowCount} ${nowCount === 1 ? 'dato' : 'datoer'}`}: deltagerne inviteres nå og ser at det er foreløpig.` : null,
    laterCount ? `${laterCount === dates.length ? (dates.length > 1 ? 'Alle datoene' : 'Datoen') : `${laterCount} ${laterCount === 1 ? 'dato' : 'datoer'}`}: venter. Når ${roleDefinite} sier ja, dukker arrangementet opp og du kan invitere.` : null,
  ].filter((s): s is string => !!s);

  return (
    <View style={{ gap: spacing.md }}>
    <Card style={{ paddingVertical: spacing.xs }}>
      <ListRow
        icon="clock"
        title="Inviter deltagere senere"
        subtitle={`Ingen blir invitert ennå. Hver dato blir et arrangement i kalenderen din når ${roleDefinite} sier ja – da får du beskjed og inviterer.`}
        radio
        selected={!inviteNow}
        onPress={() => {
          setPerDate(false);
          onChange({ inviteNow: false, inviteOverrides: {} });
        }}
      />
      <Divider />
      <ListRow
        icon="send"
        title="Inviter deltagere nå"
        subtitle={`Deltagerne får invitasjonen med en gang, merket «Foreløpig» til ${roleDefinite} har sagt ja.`}
        radio
        selected={inviteNow}
        onPress={() => {
          setPerDate(false);
          onChange({ inviteNow: true, inviteOverrides: {} });
        }}
      />
      {many ? (
        <>
          <Divider />
          <PressableScale
            onPress={() => setPerDate(!perDate)}
            accessibilityRole="button"
            accessibilityState={{ expanded: perDate }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
          >
            <Icon name="list" size={18} color="textSecondary" />
            <Text variant="callout" style={{ flex: 1 }}>
              {nowCount && nowCount < dates.length ? `Nå for ${nowCount} av ${dates.length} datoer` : 'Velg for hver dato'}
            </Text>
            <Icon name={perDate ? 'chevron-up' : 'chevron-down'} size={18} color="textSecondary" />
          </PressableScale>
          {perDate ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ paddingBottom: spacing.sm }}>
              {dates.map((d) => (
                <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
                  <Text variant="body" style={{ flex: 1 }}>
                    {formatLong(d)}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {on(d) ? 'Nå' : 'Senere'}
                  </Text>
                  <Toggle
                    value={on(d)}
                    onValueChange={(v) => onChange({ inviteOverrides: { ...overrides, [d]: v } })}
                    accessibilityLabel={`Inviter deltagere nå til ${formatLong(d)}`}
                  />
                </View>
              ))}
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </Card>
    <Card muted style={{ gap: spacing.sm }}>
      <Text variant="subhead">Slik går det videre</Text>
      {steps.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Text variant="footnote" color="textSecondary" style={{ width: 16 }}>
            {i + 1}.
          </Text>
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            {s}
          </Text>
        </View>
      ))}
    </Card>
    </View>
  );
}

/** The dates whose participants are invited now. */
export const datesInvitedNow = (dates: string[], inviteNow: boolean, overrides: Record<string, boolean>) => dates.filter((d) => overrides[d] ?? inviteNow);
