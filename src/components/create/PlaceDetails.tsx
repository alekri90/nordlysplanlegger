import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon, Input, PressableScale, Text } from '@/components/ui';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

/** «Hvor» and a few words for everyone — optional, folded away until asked for. Same draft fields as before. */
export function PlaceDetails({ style }: { style?: object }) {
  const draft = useCreateDraft();
  const [open, setOpen] = useState(false);
  const show = open || !!draft.placeName || !!draft.details;

  if (!show) {
    return (
      <PressableScale
        onPress={() => setOpen(true)}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }, style]}
        accessibilityRole="button"
        accessibilityLabel="Legg til sted og detaljer"
      >
        <Icon name="plus-circle" size={18} color="textSecondary" />
        <Text variant="callout" color="textSecondary">
          Legg til sted og detaljer (valgfritt)
        </Text>
      </PressableScale>
    );
  }
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={[{ gap: spacing.md }, style]}>
      <Text variant="title3">Sted og detaljer</Text>
      <View style={{ gap: spacing.md }}>
        <Input icon="map-pin" placeholder="Hvor? F.eks. Sørenga sjøbad" value={draft.placeName} onChangeText={(placeName) => draft.set({ placeName })} maxLength={120} accessibilityLabel="Hvor" />
        <Input
          placeholder="Detaljer til alle, f.eks. «Ta med håndkle»"
          value={draft.details}
          onChangeText={(details) => draft.set({ details })}
          multiline
          maxLength={2000}
          style={{ minHeight: 84, paddingTop: spacing.md, textAlignVertical: 'top' }}
          accessibilityLabel="Detaljer"
        />
      </View>
    </Animated.View>
  );
}
