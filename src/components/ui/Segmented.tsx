import { View } from 'react-native';

import { spacing, useColors } from '@/theme';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** Underlined text tabs (Gjesteliste · Detaljer · Bilder). */
export function Segmented<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }} accessibilityRole="tablist">
      {items.map((i) => {
        const active = i.id === value;
        return (
          <PressableScale
            key={i.id}
            onPress={() => onChange(i.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={i.label}
            scaleTo={0.96}
            style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: active ? colors.text : 'transparent', marginBottom: -1 }}
          >
            <Text variant="callout" color={active ? 'text' : 'textTertiary'}>
              {i.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
