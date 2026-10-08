import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, ListRow, Sheet, Text, useToast } from '@/components/ui';
import { useReport } from '@/data/hooks';
import type { ReportInput, ReportReason } from '@/data/types';
import { spacing } from '@/theme';

const REASONS: { id: ReportReason; title: string }[] = [
  { id: 'harassment', title: 'Trakassering eller mobbing' },
  { id: 'inappropriate', title: 'Støtende innhold eller bilder' },
  { id: 'spam', title: 'Søppelpost eller svindel' },
  { id: 'other', title: 'Noe annet' },
];

type Target = Omit<ReportInput, 'reason' | 'details'>;

/** Tell us about a person, event or group (incl. its pictures). Read by a human within 24 hours. */
export function ReportForm({ target, onDone }: { target: Target; onDone: () => void }) {
  const toast = useToast();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const send = async () => {
    if (!reason) return;
    try {
      await report.mutateAsync({ ...target, reason, details: details.trim() || undefined });
      toast({ message: 'Takk! Vi ser på det innen 24 timer.', tone: 'success', icon: 'flag' });
      setReason(null);
      setDetails('');
      onDone();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende rapporten', tone: 'error' });
    }
  };

  return (
    <View>
      <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.sm }}>
        Hva er galt? Den du rapporterer får ikke vite hvem som sendte rapporten.
      </Text>
      {REASONS.map((r) => (
        <ListRow key={r.id} title={r.title} radio selected={reason === r.id} onPress={() => setReason(r.id)} />
      ))}
      <Input
        placeholder="Fortell gjerne litt mer (valgfritt)"
        value={details}
        onChangeText={setDetails}
        maxLength={500}
        multiline
        containerStyle={{ marginTop: spacing.md }}
        accessibilityLabel="Mer om hva som skjedde"
      />
      <Button title="Send rapport" variant="danger" icon="flag" disabled={!reason} loading={report.isPending} onPress={send} style={{ marginTop: spacing.lg }} />
      <Text variant="caption" color="textTertiary" align="center" style={{ marginTop: spacing.sm }}>
        Er noen i fare? Ring politiet på 112.
      </Text>
    </View>
  );
}

export function ReportSheet({ visible, onClose, title, target }: { visible: boolean; onClose: () => void; title: string; target: Target }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ReportForm target={target} onDone={onClose} />
    </Sheet>
  );
}
