import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Input, Sheet, Text } from '@/components/ui';
import { activityType, type ActivityType } from '@/lib/activities';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  activity: string | null | undefined;
  value: string | null;
  subtitle?: string;
  loading?: boolean;
  onSave: (theme: string | null) => void;
};

/**
 * Set or change the theme of an evening («Eukalyptus»): quick picks or your own words.
 * Used by the organizer and by the one with the role (in the app or on the answer page).
 */
export function ThemeSheet({ visible, onClose, activity, value, subtitle, loading, onSave }: Props) {
  const type = activityType(activity);
  if (!type) return null;
  const label = type.theme.label.toLowerCase();
  return (
    <Sheet visible={visible} onClose={onClose} title={value ? `Endre ${label}` : `Legg til ${label}`} subtitle={subtitle}>
      {/* Starts from the saved theme each time it opens. */}
      <ThemeForm key={`${visible}-${value ?? ''}`} type={type} value={value} loading={loading} onSave={onSave} />
    </Sheet>
  );
}

function ThemeForm({ type, value, loading, onSave }: { type: ActivityType; value: string | null; loading?: boolean; onSave: (theme: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  const trimmed = text.trim();
  return (
    <View style={{ gap: spacing.lg }}>
      <Input
        label={type.theme.label}
        placeholder={type.theme.placeholder}
        value={text}
        onChangeText={setText}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onSave(trimmed)}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {type.theme.suggestions.map((s) => (
          <Chip
            key={s}
            label={s}
            selected={trimmed.toLowerCase() === s.toLowerCase()}
            onPress={() => {
              haptics.light();
              setText(s);
            }}
          />
        ))}
      </View>
      <Text variant="footnote" color="textSecondary">
        Vises under tittelen for alle som er med. {type.role.label} og arrangøren kan endre det.
      </Text>
      <Button title="Lagre" variant="ink" disabled={!trimmed || trimmed === (value ?? '')} loading={loading} onPress={() => onSave(trimmed)} />
      {value ? <Button title={`Fjern ${type.theme.label.toLowerCase()}`} variant="secondary" disabled={loading} onPress={() => onSave(null)} /> : null}
    </View>
  );
}
