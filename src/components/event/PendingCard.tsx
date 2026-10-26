import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { confirmDestructive } from '@/components/people/PersonSheet';
import { Button, Card, PressableScale, Text, useToast } from '@/components/ui';
import { useRemindPending, useRemoveEventMember } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { shortNames } from '@/lib/names';
import { spacing } from '@/theme';

/**
 * For the organizer side: who hasn't answered, «Minn på» (one tap, everyone with an account), and a
 * quiet way to take those who never answer off the list. People without an account can't be
 * notified — `onShareLinks` opens their links instead.
 */
export function PendingCard({ event, onShareLinks, style }: { event: PlannerEvent; onShareLinks?: () => void; style?: object }) {
  const toast = useToast();
  const remind = useRemindPending(event.id);
  const remove = useRemoveEventMember();
  const pending = event.members.filter((m) => m.role === 'guest' && (m.status === 'invited' || m.status === 'opened'));
  if (!pending.length || !['draft', 'polling', 'confirmed', 'date_selected'].includes(event.status)) return null;
  const names = shortNames(event.members.map((m) => ({ id: m.id, name: m.person.name })));
  const nameOf = (id: string) => names.get(id) ?? '';

  const sendReminder = async () => {
    try {
      const r = await remind.mutateAsync();
      if (r.sent) toast({ message: r.sent === 1 ? 'Påminnelse sendt' : `Påminnelse sendt til ${r.sent}`, tone: 'success', icon: 'bell' });
      else if (!r.withoutAccount) toast('De har fått en påminnelse nylig – prøv igjen senere');
      if (r.withoutAccount) {
        toast({ message: `${r.withoutAccount} uten konto får ikke varsel – send lenken på nytt`, icon: 'link' });
        onShareLinks?.();
      }
    } catch {
      toast({ message: 'Kunne ikke sende påminnelsen', tone: 'error' });
    }
  };

  const removeAll = () =>
    confirmDestructive(
      `Fjerne ${pending.length === 1 ? nameOf(pending[0].id) : `de ${pending.length} som ikke har svart`}?`,
      'De får ikke beskjed, og invitasjonen deres slutter å virke. Du kan invitere dem igjen senere.',
      'Fjern',
      async () => {
        for (const m of pending) await remove.mutateAsync(m.id);
        toast(pending.length === 1 ? `${nameOf(pending[0].id)} er fjernet` : `${pending.length} er fjernet`);
      },
    );

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={style}>
      <Card muted style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            Venter på {pending.slice(0, 3).map((m) => nameOf(m.id)).join(', ')}
            {pending.length > 3 ? ` og ${pending.length - 3} til` : ''}
          </Text>
          <Button title="Minn på" size="sm" variant="secondary" icon="bell" loading={remind.isPending} onPress={sendReminder} />
        </View>
        <PressableScale onPress={removeAll} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text variant="footnote" color="textTertiary" style={{ textDecorationLine: 'underline' }}>
            {pending.length === 1 ? `Fjern ${nameOf(pending[0].id)} fra listen` : 'Fjern dem som ikke har svart'}
          </Text>
        </PressableScale>
      </Card>
    </Animated.View>
  );
}
