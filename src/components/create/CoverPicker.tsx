import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button, Chip, Icon, PressableScale, Text } from '@/components/ui';
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
  /** The gjeng's picture, offered first: «Bruk gjengbildet» / «Velg et annet bilde». */
  featured?: { url: string; label: string } | null;
};

/**
 * The picture is part of the plan, not a setting: a big photo, ready-made ones a tap away,
 * and your own from the camera roll. There is always one selected.
 */
export function CoverPicker({ category, onCategory, value, onChange, featured }: Props) {
  const colors = useColors();
  const usingFeatured = !!featured && sameImage(value, featured.url);
  const [browsing, setBrowsing] = useState(!usingFeatured);
  const photos = coverOptions(category);
  const custom = !photos.includes(value) && !usingFeatured ? value : null;
  const grid = [...(featured ? [featured.url] : []), ...(custom ? [custom] : []), ...photos]
    .filter((url, i, all) => all.findIndex((other) => sameImage(other, url)) === i)
    .slice(0, 5);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  };

  if (featured && usingFeatured && !browsing) {
    return (
      <Animated.View entering={FadeIn.duration(250)}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', aspectRatio: 1.5, backgroundColor: colors.surfaceMuted }}>
          <Image source={{ uri: thumb(featured.url, 1000) }} style={{ flex: 1 }} contentFit="cover" transition={200} accessibilityLabel={featured.label} />
          <View style={{ position: 'absolute', left: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
            <Icon name="check" size={14} tint="#fff" />
            <Text variant="footnote" style={{ color: '#fff' }}>
              {featured.label}
            </Text>
          </View>
        </View>
        <Button title="Velg et annet bilde" variant="secondary" icon="image" style={{ marginTop: spacing.md }} onPress={() => setBrowsing(true)} />
      </Animated.View>
    );
  }

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
          const isFeatured = !!featured && url === featured.url;
          return (
            <PressableScale
              key={url}
              onPress={() => onChange(isFeatured ? thumb(url, 1200) : url)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={isFeatured ? featured.label : `Bilde ${i + 1}`}
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
              {isFeatured ? (
                <View style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text variant="caption" style={{ color: '#fff' }}>
                    {featured.label}
                  </Text>
                </View>
              ) : null}
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

