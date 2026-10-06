import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import { radius, spacing, useColors } from '@/theme';

export const GROUP_EMOJI = ['🃏', '🧖‍♀️', '🎾', '🏡', '🍷', '🍕', '⛷️', '🥾', '🎉', '⚽️', '🎮', '🍻'];

/** Pick a photo and/or an emoji for a group — two quick rows, no forms. */
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
  return (
    <View style={{ gap: spacing.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
        {photos.map((url, i) => {
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
