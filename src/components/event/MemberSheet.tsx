import { confirmDestructive, PersonSheet } from '@/components/people/PersonSheet';
import { ListRow, useToast } from '@/components/ui';
import { useRemoveEventMember } from '@/data/hooks';
import type { EventMember } from '@/data/types';
import { firstName } from '@/lib/eventText';

/** Someone on the guest list: the usual person actions, and for the organizer side «Fjern fra arrangementet». */
export function MemberSheet({ member, canRemove, onClose }: { member: EventMember | null; canRemove: boolean; onClose: () => void }) {
  const toast = useToast();
  const remove = useRemoveEventMember();
  return (
    <PersonSheet
      person={member?.person ?? null}
      onClose={onClose}
      extra={
        canRemove && member && member.role === 'guest' ? (
          <ListRow
            icon="user-minus"
            title="Fjern fra arrangementet"
            subtitle="De får ikke beskjed"
            destructive
            onPress={() =>
              confirmDestructive(`Fjerne ${firstName(member.person.name)}?`, 'Invitasjonen slutter å virke. Du kan invitere dem igjen senere.', 'Fjern', async () => {
                await remove.mutateAsync(member.id);
                toast(`${firstName(member.person.name)} er fjernet`);
                onClose();
              })
            }
          />
        ) : undefined
      }
    />
  );
}
