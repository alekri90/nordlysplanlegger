import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Divider, ListRow, SectionHeader } from '@/components/ui';
import { useDateClearances, useMyRoleRequests, useRoleRequests } from '@/data/hooks';
import { clearanceSummary } from '@/lib/clearance';
import { firstName } from '@/lib/eventText';
import { needsOrganizer, requestCounts, requestSummary } from '@/lib/roleRequest';
import { spacing } from '@/theme';

/**
 * Home: «Avklares» — requests waiting for the key person or answered and ready to invite, Aufguss
 * requests to sauna masters with dates still open, and requests sent to me to answer.
 */
export function ClearanceCards() {
  const q = useDateClearances();
  const roles = useRoleRequests();
  const mine = useMyRoleRequests();
  const open = (q.data ?? []).filter((c) => c.status === 'pending' || c.status === 'answered');
  const roleOpen = (roles.data ?? []).filter((r) => {
    const c = requestCounts(r);
    return c.pending + c.choose + c.unavailable > 0;
  });
  const toAnswer = (mine.data ?? []).filter((r) => r.open > 0);
  if (!open.length && !roleOpen.length && !toAnswer.length) return null;

  const rows = [
    ...toAnswer.map((r) => (
      <ListRow
        key={r.token}
        icon="mail"
        title={`${r.organizerName} spør om du kan være ${r.roleLabel}`}
        subtitle={`${r.title} · ${r.open} ${r.open === 1 ? 'dato' : 'datoer'} å svare på`}
        chevron
        onPress={() => router.push({ pathname: '/r/[token]', params: { token: r.token } })}
      />
    )),
    ...roleOpen.map((r) => (
      <ListRow
        key={r.id}
        icon={needsOrganizer(r) ? 'user-check' : 'clock'}
        title={r.title}
        subtitle={`${needsOrganizer(r) ? 'Trenger deg · ' : ''}${requestSummary(r)}`}
        chevron
        onPress={() => router.push({ pathname: '/rolle/[id]', params: { id: r.id } })}
      />
    )),
    ...open.map((c) => (
      <ListRow
        key={c.id}
        icon={c.status === 'answered' ? 'check-circle' : 'clock'}
        title={c.title}
        subtitle={c.status === 'answered' ? `${firstName(c.keyName)} har svart · ${clearanceSummary(c.days, true)}` : `Venter på ${firstName(c.keyName)}`}
        chevron
        onPress={() => router.push(`/avklaring/${c.id}`)}
      />
    )),
  ];

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <SectionHeader title="Avklares" />
      <Card style={{ paddingVertical: spacing.xs }}>
        {rows.map((row, i) => (
          <View key={row.key}>
            {i ? <Divider /> : null}
            {row}
          </View>
        ))}
      </Card>
    </View>
  );
}
