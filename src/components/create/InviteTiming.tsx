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
  onChange,
}: {
  inviteNow: boolean;
  overrides: Record<string, boolean>;
  /** One per event; one or none for a single event. */
  dates: string[];
  roleLabel: string;
  onChange: (patch: { inviteNow?: boolean; inviteOverrides?: Record<string, boolean> }) => void;
}) {
  const [perDate, setPerDate] = useState(Object.keys(overrides).length > 0);
  const many = dates.length > 1;
  const on = (d: string) => overrides[d] ?? inviteNow;
  const nowCount = dates.filter(on).length;

  return (
    <Card style={{ paddingVertical: spacing.xs }}>
      <ListRow
        icon="clock"
        title="Inviter deltagere senere"
        subtitle="Lagres uten invitasjoner. Du åpner arrangementet og inviterer når du vil."
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
        subtitle={`De får invitasjonen nå, merket foreløpig til ${roleLabel} har bekreftet.`}
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
  );
}

/** The dates whose participants are invited now. */
export const datesInvitedNow = (dates: string[], inviteNow: boolean, overrides: Record<string, boolean>) => dates.filter((d) => overrides[d] ?? inviteNow);
