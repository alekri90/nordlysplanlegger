import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, ListRow, SectionHeader } from '@/components/ui';
import { useDateClearances } from '@/data/hooks';
import { clearanceSummary } from '@/lib/clearance';
import { firstName } from '@/lib/eventText';
import { spacing } from '@/theme';

/** Home: «Avklares» — requests waiting for the key person, or answered and ready to invite. */
export function ClearanceCards() {
  const q = useDateClearances();
  const open = (q.data ?? []).filter((c) => c.status === 'pending' || c.status === 'answered');
  if (!open.length) return null;
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <SectionHeader title="Avklares" />
      <Card style={{ paddingVertical: spacing.xs }}>
        {open.map((c) => (
          <ListRow
            key={c.id}
            icon={c.status === 'answered' ? 'check-circle' : 'clock'}
            title={c.title}
            subtitle={c.status === 'answered' ? `${firstName(c.keyName)} har svart · ${clearanceSummary(c.days, true)}` : `Venter på ${firstName(c.keyName)}`}
            chevron
            onPress={() => router.push(`/avklaring/${c.id}`)}
          />
        ))}
      </Card>
    </View>
  );
}
