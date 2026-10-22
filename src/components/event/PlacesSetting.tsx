import { View } from 'react-native';

import { Icon, ListRow, PressableScale, Text, Toggle } from '@/components/ui';
import { spacing, useColors } from '@/theme';

const DEFAULT_PLACES = 10;

/**
 * «Begrens antall plasser» — off means no limit. When it's full, «Kommer» puts people on the
 * waiting list, and the first in line moves up when someone can't come.
 */
export function PlacesSetting({ value, onChange }: { value: number | null; onChange: (max: number | null) => void }) {
  const colors = useColors();
  const on = value != null;
  const step = (d: number) => onChange(Math.min(500, Math.max(2, (value ?? DEFAULT_PLACES) + d)));
  return (
    <View>
      <ListRow
        icon="users"
        title="Begrens antall plasser"
        subtitle={on ? 'Blir det fullt, havner resten på venteliste' : 'Ubegrenset'}
        trailing={<Toggle value={on} onValueChange={(v) => onChange(v ? DEFAULT_PLACES : null)} accessibilityLabel="Begrens antall plasser" />}
      />
      {on ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm }}>
          <PressableScale onPress={() => step(-1)} accessibilityLabel="Færre plasser" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="minus" size={18} />
          </PressableScale>
          <Text variant="title2" style={{ minWidth: 96, textAlign: 'center' }} accessibilityLabel={`${value} plasser`}>
            {value} plasser
          </Text>
          <PressableScale onPress={() => step(1)} accessibilityLabel="Flere plasser" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} />
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}
