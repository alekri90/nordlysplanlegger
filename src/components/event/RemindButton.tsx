import { Button, useToast } from '@/components/ui';
import { useRemindPending } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';

const pendingOf = (event: PlannerEvent) => event.members.filter((m) => m.role === 'guest' && (m.status === 'invited' || m.status === 'opened'));
const canRemind = (event: PlannerEvent) => pendingOf(event).length > 0 && ['draft', 'polling', 'confirmed', 'date_selected'].includes(event.status);

/**
 * «Minn på»: one tap notifies everyone with an account who hasn't answered. People without an
 * account can't be notified — `onShareLinks` opens their links instead.
 */
export function RemindButton({ event, onShareLinks }: { event: PlannerEvent; onShareLinks?: () => void }) {
  const toast = useToast();
  const remind = useRemindPending(event.id);
  if (!canRemind(event)) return null;

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

  return <Button title="Minn på" size="sm" variant="secondary" icon="bell" loading={remind.isPending} onPress={sendReminder} />;
}
