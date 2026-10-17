import { View } from 'react-native';

import { Chip, ListRow } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { useAppearance, type AppearancePreference } from '@/state/appearance';
import { spacing } from '@/theme';

const OPTIONS: { id: AppearancePreference; label: string; icon: IconName }[] = [
  { id: 'auto', label: 'Automatisk', icon: 'smartphone' },
  { id: 'light', label: 'Lys', icon: 'sun' },
  { id: 'dark', label: 'Mørk', icon: 'moon' },
];

/** Profil → Utseende. Applies at once and is remembered on this phone. */
export function AppearanceSetting() {
  const preference = useAppearance((s) => s.preference);
  const setPreference = useAppearance((s) => s.setPreference);
  return (
    <View style={{ paddingBottom: spacing.md }}>
      <ListRow icon="moon" title="Utseende" subtitle={preference === 'auto' ? 'Følger telefonen' : preference === 'dark' ? 'Alltid mørk' : 'Alltid lys'} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => (
          <Chip key={o.id} label={o.label} icon={o.icon} selected={preference === o.id} onPress={() => setPreference(o.id)} />
        ))}
      </View>
    </View>
  );
}
