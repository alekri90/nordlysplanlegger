import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { thumb } from '@/lib/categories';
import { useColors } from '@/theme';

type Props = { name: string; imageUrl?: string; onPress: () => void; size?: number; add?: boolean; selected?: boolean };

/** Round group avatar with a label, as on the home screen. */
export function GroupBubble({ name, imageUrl, onPress, size = 64, add, selected }: Props) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={add ? 'Ny gjeng' : `Gjengen ${name}`}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={{ alignItems: 'center', width: size + 16, gap: 6 }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: add ? colors.surface : colors.surfaceMuted,
          borderWidth: add ? 1.5 : selected ? 3 : 0,
          borderStyle: add ? 'dashed' : 'solid',
          borderColor: add ? colors.borderStrong : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {add ? <Icon name="plus" size={22} color="textSecondary" /> : imageUrl ? <Image source={{ uri: thumb(imageUrl, 200) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : null}
      </View>
      <Text variant="caption" numberOfLines={1} align="center" color={add ? 'textSecondary' : 'text'}>
        {name}
      </Text>
    </PressableScale>
  );
}
