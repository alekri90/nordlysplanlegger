import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { FriendButton } from '@/components/people/FriendButton';
import { PersonRow } from '@/components/people/PersonRow';
import { Button, Card, Divider, Text, useToast } from '@/components/ui';
import { useFriendshipStates, useRespondFriendRequest, useSendFriendRequest } from '@/data/hooks';
import type { Group } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/** Members of the group you aren't friends with yet — one tap each, or everyone at once. */
export function GroupFriendsCard({ group, style }: { group: Pick<Group, 'members'>; style?: StyleProp<ViewStyle> }) {
  const me = useMe();
  const toast = useToast();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const [busy, setBusy] = useState(false);
  const people = group.members.filter((m) => !m.isGuest && m.id !== me?.id);
  const states = useFriendshipStates(people.map((m) => m.id));

  const byId = new Map((states.data ?? []).map((s) => [s.userId, s]));
  const open = people.filter((m) => ['none', 'incoming'].includes(byId.get(m.id)?.state ?? ''));
  if (!open.length) return null;

  const addAll = async () => {
    setBusy(true);
    haptics.light();
    let accepted = 0;
    let sent = 0;
    for (const m of open) {
      const s = byId.get(m.id);
      try {
        if (s?.state === 'incoming' && s.requestId) {
          await respond.mutateAsync({ requestId: s.requestId, accept: true });
          accepted++;
        } else if ((await send.mutateAsync(m.id)) === 'friends') accepted++;
        else sent++;
      } catch {
        // Keep going; the row stays so it can be retried.
      }
    }
    setBusy(false);
    const parts = [
      accepted ? `${accepted} ${accepted === 1 ? 'ny venn' : 'nye venner'}` : null,
      sent ? `${sent} ${sent === 1 ? 'forespørsel' : 'forespørsler'} sendt` : null,
    ].filter(Boolean);
    if (parts.length) toast({ message: parts.join(' · '), tone: 'success', icon: 'user-check' });
  };

  return (
    <Card style={style}>
      <Text variant="headline">Bli venner med gjengen</Text>
      <Text variant="footnote" color="textSecondary" style={{ marginTop: 2, marginBottom: spacing.sm }}>
        Så kan dere invitere hverandre direkte, også utenom gjengen.
      </Text>
      {open.map((m, i) => {
        const s = byId.get(m.id);
        return (
          <View key={m.id}>
            {i ? <Divider /> : null}
            <PersonRow
              person={m}
              size={40}
              detail={s?.state === 'incoming' ? 'Vil bli venn med deg' : null}
              trailing={<FriendButton userId={m.id} state={s?.state ?? 'none'} requestId={s?.requestId} name={firstName(m.name)} />}
            />
          </View>
        );
      })}
      {open.length > 1 ? (
        <Button title={`Legg til alle ${open.length}`} variant="secondary" size="md" icon="users" loading={busy} onPress={addAll} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}
