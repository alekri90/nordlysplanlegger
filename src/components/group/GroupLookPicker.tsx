import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import { radius, spacing, useColors } from '@/theme';

export const GROUP_EMOJI = ['🃏', '🧖‍♀️', '🎾', '🏡', '🍷', '🍕', '⛷️', '🥾', '🎉', '⚽️', '🎮', '🍻'];

/** A photo (always one picked: ready-made or your own) and, if you like, an emoji. Two quick rows, no forms. */
export function GroupLookPicker({
  photos,
  photo,
  onPhoto,
  emoji,
  onEmoji,
}: {
  photos: string[];
  photo: string;
  onPhoto: (url: string) => void;
  emoji: string | null;
  onEmoji: (e: string | null) => void;
}) {
  const colors = useColors();
  const all = photos.includes(photo) ? photos : [photo, ...photos];
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) onPhoto(result.assets[0].uri);
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
        {all.map((url, i) => {
          const selected = photo === url;
          return (
            <PressableScale
              key={url}
              onPress={() => onPhoto(url)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Bilde ${i + 1}`}
              style={{ width: 84, height: 84, borderRadius: radius.pill, overflow: 'hidden', borderWidth: selected ? 3 : 0, borderColor: colors.primary }}
            >
              <Image source={{ uri: thumb(url, 240) }} style={{ flex: 1 }} contentFit="cover" />
              {selected ? (
                <View style={{ position: 'absolute', bottom: 4, alignSelf: 'center', width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={12} tint="#fff" />
                </View>
              ) : null}
            </PressableScale>
          );
        })}
        <PressableScale
          onPress={pickImage}
          accessibilityLabel="Velg fra bilder"
          style={{ width: 84, height: 84, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 }}
        >
          <Icon name="image" size={20} color="textSecondary" />
          <Text variant="caption" color="textSecondary">
            Eget
          </Text>
        </PressableScale>
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {GROUP_EMOJI.map((e) => {
          const selected = emoji === e;
          return (
            <PressableScale
              key={e}
              onPress={() => onEmoji(selected ? null : e)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Emoji ${e}`}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.primarySoft : colors.surface,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
