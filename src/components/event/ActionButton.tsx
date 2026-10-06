import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { radius, spacing, useColors } from '@/theme';

/** Round action with a label (Kalender · Del · Rediger · Mer). */
export function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} />
      </View>
      <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xxs }}>
        {label}
      </Text>
    </PressableScale>
  );
}
