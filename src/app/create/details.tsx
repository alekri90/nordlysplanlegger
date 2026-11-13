import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { KIT_STEPS, StepHeader } from '@/components/create/StepHeader';
import { KitFieldsForm } from '@/components/kit/KitFieldsForm';
import { BottomBar, Button, Card, Chip, Divider, Icon, Input, PageTitle, PressableScale, Screen, ScreenScroll, SectionHeader, Text } from '@/components/ui';
import { kitActivity } from '@/lib/activities';
import { haptics } from '@/lib/haptics';
import { describeSharedPrice, formatKr, parseKr } from '@/lib/price';
import { useCreateDraft } from '@/state/createDraft';
import { spacing, useColors } from '@/theme';

/**
 * A building-block type, step 4 — its own details: the place (meeting point for a run), the
 * fields (the table, the menu, the route), the bring list, places and a price that fits
 * (buy-in, contribution per seat, the court shared).
 */
export default function CreateDetails() {
  const colors = useColors();
  const draft = useCreateDraft();
  const type = kitActivity(draft.activityType);
  const [priceText, setPriceText] = useState(draft.price ? formatKr(draft.price.amountOre).replace(' kr', '') : '');
  const [newItem, setNewItem] = useState('');
  if (!type) return null;

  const { kit } = type;
  const amount = parseKr(priceText);
  const places = type.requiresPlaces ? (draft.maxParticipants ?? type.defaultPlaces) : draft.maxParticipants;
  const step = (d: number) => draft.set({ maxParticipants: Math.min(500, Math.max(2, (places ?? type.defaultPlaces) + d)) });
  const shared = kit.price?.mode === 'split' && amount ? describeSharedPrice(amount, { maxParticipants: places ?? null, payingPlaces: 0 }) : null;

  const toggleItem = (label: string) => {
    haptics.light();
    draft.set({ bringItems: draft.bringItems.includes(label) ? draft.bringItems.filter((x) => x !== label) : [...draft.bringItems, label] });
  };
  const addItem = () => {
    const label = newItem.trim();
    if (!label || draft.bringItems.includes(label)) return;
    draft.set({ bringItems: [...draft.bringItems, label.slice(0, 80)] });
    setNewItem('');
  };

  const next = () => {
    draft.set({
      maxParticipants: places ?? null,
      price: kit.price && amount ? { mode: kit.price.mode, amountOre: amount } : null,
    });
    router.push('/create/who');
  };

  return (
    <Screen>
      <StepHeader step={3} total={KIT_STEPS} />
      <ScreenScroll bottomInset={160}>
        <PageTitle title={kit.detailsTitle} subtitle={kit.detailsSubtitle} />

        <View style={{ gap: spacing.xl }}>
          <Input
            label={kit.placeLabel}
            icon="map-pin"
            placeholder={kit.placePlaceholder}
            value={draft.placeName}
            onChangeText={(placeName) => draft.set({ placeName })}
            maxLength={120}
          />

          <KitFieldsForm type={type} values={draft.activityDetails} onChange={(key, v) => draft.set({ activityDetails: { ...draft.activityDetails, [key]: v } })} />

          {kit.bring ? (
            <View>
              <SectionHeader title="Listen" />
              <Card style={{ gap: spacing.md }}>
                <Text variant="footnote" color="textSecondary">
                  Trykk for å ta med på listen. Gjestene tar på seg det de vil, og kan legge til egne ting.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {[...new Set([...kit.bring.suggestions, ...draft.bringItems])].map((s) => (
                    <Chip key={s} label={s} selected={draft.bringItems.includes(s)} onPress={() => toggleItem(s)} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Input
                    containerStyle={{ flex: 1 }}
                    placeholder="Noe annet, f.eks. Isbiter"
                    value={newItem}
                    onChangeText={(t) => setNewItem(t.slice(0, 80))}
                    returnKeyType="done"
                    onSubmitEditing={addItem}
                    accessibilityLabel="Legg til på listen"
                  />
                  <Button title="Legg til" size="sm" variant="secondary" fullWidth={false} disabled={!newItem.trim()} onPress={addItem} />
                </View>
                <Text variant="footnote" color={draft.bringItems.length ? 'primary' : 'textSecondary'}>
                  {draft.bringItems.length ? `${draft.bringItems.length} ting på listen` : 'Tom liste – gjestene kan fortsatt legge til selv.'}
                </Text>
              </Card>
            </View>
          ) : null}

          {type.requiresPlaces ? (
            <View>
              <SectionHeader title="Plasser" />
              <Card style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
                  <PressableScale onPress={() => step(-1)} accessibilityLabel="Færre plasser" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="minus" size={18} />
                  </PressableScale>
                  <Text variant="title2" style={{ minWidth: 140, textAlign: 'center' }} accessibilityLabel={`${places} plasser`}>
                    {places} plasser
                  </Text>
                  <PressableScale onPress={() => step(1)} accessibilityLabel="Flere plasser" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="plus" size={18} />
                  </PressableScale>
                </View>
                <Divider />
                <Text variant="footnote" color="textSecondary">
                  Du er selv med. Når det er fullt, havner resten på venteliste og rykker opp hvis noen melder avbud.
                </Text>
              </Card>
            </View>
          ) : null}

          {kit.price ? (
            <View>
              <SectionHeader title={kit.price.label} />
              <Card style={{ gap: spacing.md }}>
                <Input
                  icon="tag"
                  placeholder="Kroner"
                  value={priceText}
                  onChangeText={setPriceText}
                  keyboardType="decimal-pad"
                  maxLength={10}
                  accessibilityLabel={`${kit.price.label} i kroner`}
                  error={priceText.trim() && !amount ? 'Skriv et beløp i kroner' : undefined}
                />
                {shared ? <Text variant="headline">{shared.headline}</Text> : null}
                <Text variant="footnote" color="textSecondary">
                  {kit.price.hint} La feltet stå tomt om det er gratis.
                </Text>
              </Card>
            </View>
          ) : null}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          variant="ink"
          title={`Fortsett${places && type.requiresPlaces ? ` · ${places} plasser` : ''}${amount && kit.price ? ` · ${formatKr(amount)}` : ''}`}
          disabled={!!priceText.trim() && !amount}
          onPress={next}
        />
      </BottomBar>
    </Screen>
  );
}
