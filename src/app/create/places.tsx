import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ACTIVITY_STEPS, StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Card, Divider, Icon, Input, PageTitle, PressableScale, Screen, ScreenScroll, SectionHeader, Text } from '@/components/ui';
import { roleActivity, maxParticipantsFor } from '@/lib/activities';
import { describeSharedPrice, formatKr, parseKr } from '@/lib/price';
import { useCreateDraft } from '@/state/createDraft';
import { spacing, useColors } from '@/theme';

/**
 * An activity type, step 5 — places for paying participants and the total price per event.
 * The role (sauna master) comes on top: no participant place, no share of the cost, but room in
 * the venue.
 */
export default function CreatePlaces() {
  const colors = useColors();
  const draft = useCreateDraft();
  const type = roleActivity(draft.activityType);
  const [priceText, setPriceText] = useState(draft.price ? formatKr(draft.price.amountOre).replace(' kr', '') : '');
  if (!type) return null;

  const role = type.role;
  const venueCap = draft.venue?.capacity ?? null;
  const upper = maxParticipantsFor(venueCap, 1) ?? 500;
  const places = Math.min(draft.maxParticipants ?? type.defaultPlaces, upper);
  const step = (d: number) => draft.set({ maxParticipants: Math.min(upper, Math.max(1, places + d)) });
  const total = parseKr(priceText);
  const shared = total ? describeSharedPrice(total, { maxParticipants: places, payingPlaces: 0 }) : null;
  const many = draft.activityMode === 'each' && draft.dateMode !== 'fixed' && draft.optionDates.length > 1;

  const next = () => {
    draft.set({ maxParticipants: places, price: total ? { mode: type.priceMode, amountOre: total } : null });
    router.push('/create/who');
  };

  return (
    <Screen>
      <StepHeader step={4} total={ACTIVITY_STEPS} />
      <ScreenScroll bottomInset={160}>
        <PageTitle title="Plasser og pris" subtitle={many ? 'Gjelder hvert arrangement. Du kan endre dem hver for seg etterpå.' : 'Du kan endre dem etterpå.'} />

        <SectionHeader title="Deltagerplasser" />
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
            <PressableScale onPress={() => step(-1)} accessibilityLabel="Færre plasser" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={18} />
            </PressableScale>
            <Text variant="title2" style={{ minWidth: 140, textAlign: 'center' }} accessibilityLabel={`${places} deltagerplasser`}>
              {places} {places === 1 ? 'plass' : 'plasser'}
            </Text>
            <PressableScale
              onPress={() => step(1)}
              disabled={places >= upper}
              accessibilityLabel="Flere plasser"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: places >= upper ? 0.4 : 1 }}
            >
              <Icon name="plus" size={18} />
            </PressableScale>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <Icon name="user-check" size={18} color="textSecondary" />
            <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
              {role.label} kommer i tillegg og bruker ingen av plassene. Du er selv med blant deltagerne.
            </Text>
          </View>
          {venueCap ? (
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <Icon name="home" size={18} color={places >= upper ? 'warning' : 'textSecondary'} />
              <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                {draft.venue?.name} har plass til {venueCap}: {upper} deltagere + {role.lower}.
                {places >= upper ? ' Det er fullt med dette.' : ''}
              </Text>
            </View>
          ) : null}
        </Card>

        <SectionHeader title={many ? 'Totalpris per arrangement' : 'Totalpris'} />
        <Card style={{ gap: spacing.md }}>
          <Input
            icon="tag"
            placeholder="F.eks. 2 500"
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            maxLength={10}
            accessibilityLabel="Totalpris i kroner"
            error={priceText.trim() && !total ? 'Skriv et beløp i kroner' : undefined}
          />
          {shared ? (
            <View style={{ gap: 4 }} accessible accessibilityLabel={`${shared.headline}. ${shared.detail}`}>
              <Text variant="headline">{shared.headline}</Text>
              <Text variant="footnote" color="textSecondary">
                {shared.detail}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {role.label} betaler ingen andel. Prisen per person regnes ut på nytt når deltagerne melder seg på.
              </Text>
            </View>
          ) : (
            <Text variant="footnote" color="textSecondary">
              Deles på deltagerne – ikke {role.lower}. La feltet stå tomt om det er gratis eller ikke avklart. Betaling skjer utenfor appen.
            </Text>
          )}
        </Card>
      </ScreenScroll>
      <BottomBar>
        <Button variant="ink" title={`Fortsett · ${places} plasser${shared ? ` · ${formatKr(total!)}` : ''}`} disabled={!!priceText.trim() && !total} onPress={next} />
      </BottomBar>
    </Screen>
  );
}
