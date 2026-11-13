import { View } from 'react-native';

import { Card, Chip, Input, SectionHeader, Text } from '@/components/ui';
import type { KitActivityType, KitField } from '@/lib/activities';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

type Props = {
  type: KitActivityType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

/**
 * A type's own fields: choices as chips (tap again to clear), numbers with their unit, text.
 * Fields with a group («Meny») are shown together under it. Everything is optional.
 */
export function KitFieldsForm({ type, values, onChange }: Props) {
  const sections: { group: string | undefined; fields: KitField[] }[] = [];
  for (const f of type.kit.fields) {
    const last = sections[sections.length - 1];
    if (last && last.group === f.group) last.fields.push(f);
    else sections.push({ group: f.group, fields: [f] });
  }
  if (!sections.length) return null;

  return (
    <View style={{ gap: spacing.xl }}>
      {sections.map((s, i) => (
        <View key={`${s.group ?? 'fields'}-${i}`}>
          {s.group ? <SectionHeader title={s.group} /> : null}
          <Card style={{ gap: spacing.lg }}>
            {s.fields.map((f) => (
              <Field key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

function Field({ field, value, onChange }: { field: KitField; value: string; onChange: (v: string) => void }) {
  if (field.kind === 'choice') {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" color="textSecondary" style={{ marginLeft: 4 }}>
          {field.label}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {field.options.map((o) => (
            <Chip
              key={o}
              label={o}
              selected={value === o}
              onPress={() => {
                haptics.light();
                onChange(value === o ? '' : o);
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  if (field.kind === 'number') {
    return (
      <Input
        label={`${field.label} (${field.unit})`}
        placeholder={field.placeholder}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9,.]/g, '').slice(0, 7))}
        keyboardType="decimal-pad"
        accessibilityLabel={`${field.label} i ${field.unit}`}
      />
    );
  }
  return (
    <Input
      label={field.label}
      placeholder={field.placeholder}
      value={value}
      onChangeText={(t) => onChange(t.slice(0, field.multiline ? 400 : 120))}
      multiline={field.multiline}
      style={field.multiline ? { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md } : undefined}
    />
  );
}
