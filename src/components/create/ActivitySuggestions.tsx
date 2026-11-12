import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button, Icon, PressableScale, Tag, Text } from '@/components/ui';
import { activityType, matchActivities, type ActivityTypeId } from '@/lib/activities';
import { CATEGORIES } from '@/lib/categories';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useColors } from '@/theme';

/**
 * Under «Hva skal dere gjøre?»: activity types that fit what is typed («auf», «badstue» → Aufguss).
 * Choosing one keeps the text and opens its own steps; ignoring it keeps the general flow.
 */
export function ActivitySuggestions({ text, chosen, onChoose }: { text: string; chosen: ActivityTypeId | null; onChoose: (id: ActivityTypeId | null) => void }) {
  const colors = useColors();
  const selected = activityType(chosen);

  if (selected) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.md }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft }}
          accessible
          accessibilityLabel={`${selected.name} er valgt. ${selected.description}`}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={CATEGORIES[selected.category].icon} size={18} tint="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="headline">{selected.name}</Text>
              <Tag label="Valgt" tone="primary" icon="check" />
            </View>
            <Text variant="footnote" color="textSecondary">
              {selected.venue.label}, {selected.role.lower}, plasser og pris kommer i de neste stegene.
            </Text>
          </View>
          <Button
            size="sm"
            variant="secondary"
            title="Fjern"
            fullWidth={false}
            onPress={() => {
              haptics.tap();
              onChoose(null);
            }}
            accessibilityLabel={`Fjern ${selected.name}, lag en vanlig aktivitet`}
          />
        </View>
      </Animated.View>
    );
  }

  const matches = matchActivities(text);
  if (!matches.length) return null;
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {matches.map((t) => (
        <Animated.View key={t.id} entering={FadeInDown.duration(220)}>
          <PressableScale
            onPress={() => {
              haptics.light();
              onChoose(t.id);
            }}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`Planlegg som ${t.name}. ${t.description}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={CATEGORIES[t.category].icon} size={18} color="primary" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{t.name}</Text>
              <Text variant="footnote" color="textSecondary">
                {t.description}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color="textTertiary" />
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}
