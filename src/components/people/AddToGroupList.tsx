import { ListRow, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useGroups } from '@/data/hooks';
import type { Person } from '@/data/types';
import { firstName } from '@/lib/eventText';

/** «Legg til i gjeng»: your groups this person isn't in yet, one tap each. */
export function AddToGroupList({ person, onDone }: { person: Person; onDone: () => void }) {
  const toast = useToast();
  const groups = useGroups();
  const name = firstName(person.name);
  const open = (groups.data ?? []).filter((g) => !g.members.some((m) => m.id === person.id));

  const add = async (groupId: string, groupName: string) => {
    try {
      const added = await repo.addGroupMembers(groupId, person.isGuest ? { guestIds: [person.id] } : { userIds: [person.id] });
      queryClient.invalidateQueries();
      toast({ message: added ? `${name} er lagt til i ${groupName}` : `${name} er allerede med`, tone: 'success' });
      onDone();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke legge til', tone: 'error' });
    }
  };

  if (!open.length) {
    return (
      <Text variant="subhead" color="textSecondary">
        {name} er allerede med i alle gjengene dine.
      </Text>
    );
  }
  return (
    <>
      {open.map((g) => (
        <ListRow key={g.id} icon="users" title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`} subtitle={`${g.members.length} medlemmer`} onPress={() => add(g.id, g.name)} />
      ))}
    </>
  );
}
