import { ListRow, Toggle } from '@/components/ui';

/** Off: only the organizer and co-hosts can invite, and nobody else sees a button for it. */
export function GuestsCanInviteSetting({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <ListRow
      icon="user-plus"
      title="Gjester kan invitere"
      subtitle={value ? 'Alle som er med, kan invitere flere' : 'Bare du og medarrangørene kan invitere'}
      trailing={<Toggle value={value} onValueChange={onChange} accessibilityLabel="Gjester kan invitere" />}
    />
  );
}
