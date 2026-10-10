import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Chip, Icon, PressableScale, Text } from '@/components/ui';
import type { CategoryId } from '@/data/types';
import { CATEGORY_LIST, coverOptions, thumb } from '@/lib/categories';
import { gutter, radius, spacing, useColors } from '@/theme';

/** Every theme, the catch-all last. */
const THEMES = [...CATEGORY_LIST.filter((c) => c.id !== 'hangout'), ...CATEGORY_LIST.filter((c) => c.id === 'hangout')];

const sameImage = (a: string, b: string) => thumb(a, 1200) === thumb(b, 1200);

type Props = {
  category: CategoryId;
  /** Picking a theme also picks its first photo. */
  onCategory: (category: CategoryId) => void;
  value: string;
  onChange: (url: string) => void;
};

/**
 * The picture is part of the plan, not a setting: ready-made photos per theme a tap away,
 * and your own from the camera roll. There is always one selected.
 */
export function CoverPicker({ category, onCategory, value, onChange }: Props) {
  const colors = useColors();
  const photos = coverOptions(category);
  const custom = !photos.some((url) => sameImage(url, value)) ? value : null;
  const grid = [...(custom ? [custom] : []), ...photos].slice(0, 5);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  };


  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -gutter, marginBottom: spacing.md }}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: gutter }}
      >
        {THEMES.map((c) => (
          <Chip key={c.id} label={c.label} icon={c.icon} selected={c.id === category} onPress={() => onCategory(c.id)} />
        ))}
      </ScrollView>

      <Animated.View key={category} entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {grid.map((url, i) => {
          const selected = sameImage(value, url);
          return (
            <PressableScale
              key={url}
              onPress={() => onChange(url)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Bilde ${i + 1}`}
              style={{
                width: '48.6%',
                aspectRatio: 1.2,
                borderRadius: radius.md,
                overflow: 'hidden',
                borderWidth: selected ? 3 : 0,
                borderColor: colors.primary,
              }}
            >
              <Image source={{ uri: thumb(url, 500) }} style={{ flex: 1, backgroundColor: colors.surfaceMuted }} contentFit="cover" transition={200} />
              {selected ? (
                <View style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={15} tint="#fff" />
                </View>
              ) : null}
            </PressableScale>
          );
        })}
        <PressableScale
          onPress={pickImage}
          accessibilityLabel="Velg fra bilder"
          style={{
            width: '48.6%',
            aspectRatio: 1.2,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Icon name="image" size={24} color="textSecondary" />
          <Text variant="footnote" color="textSecondary">
            Velg fra bilder
          </Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

