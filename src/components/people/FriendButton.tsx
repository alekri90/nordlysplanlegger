import { useState } from 'react';

import { Button, useToast } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { useRespondFriendRequest, useSendFriendRequest } from '@/data/hooks';
import type { FriendshipState } from '@/data/types';
import { haptics } from '@/lib/haptics';

type Props = {
  userId: string;
  state: FriendshipState;
  /** Needed to accept an incoming request in one tap. */
  requestId?: string | null;
  size?: 'sm' | 'md';
  name?: string;
};

export type FriendAction = {
  state: FriendshipState;
  title: string;
  icon: IconName;
  accessibilityLabel: string;
  /** Null when there's nothing to do (already friends, or a request is out). */
  onPress: (() => void) | null;
};

/** "Legg til" → "Sendt" → "Venner", optimistic so it feels instant. Shared by the button and the profile's tiles. */
export function useFriendAction({ userId, state, requestId, name }: Omit<Props, 'size'>): FriendAction {
  const toast = useToast();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const [local, setLocal] = useState<FriendshipState | null>(null);
  const current = local ?? state;

  if (current === 'friends') return { state: current, title: 'Venner', icon: 'check', accessibilityLabel: name ? `Du og ${name} er venner` : 'Venner', onPress: null };
  if (current === 'outgoing') return { state: current, title: 'Sendt', icon: 'clock', accessibilityLabel: 'Venneforespørsel sendt', onPress: null };

  const onPress = async () => {
    haptics.light();
    try {
      if (current === 'incoming' && requestId) {
        setLocal('friends');
        await respond.mutateAsync({ requestId, accept: true });
        toast({ message: name ? `Du og ${name} er nå venner` : 'Dere er nå venner', tone: 'success', icon: 'user-check' });
      } else {
        setLocal('outgoing');
        const result = await send.mutateAsync(userId);
        setLocal(result);
        if (result === 'friends') toast({ message: name ? `Du og ${name} er nå venner` : 'Dere er nå venner', tone: 'success', icon: 'user-check' });
      }
    } catch (e) {
      setLocal(null);
      toast({ message: e instanceof Error ? e.message : 'Noe gikk galt', tone: 'error' });
    }
  };
  const incoming = current === 'incoming';
  return {
    state: current,
    title: incoming ? 'Godta' : 'Legg til',
    icon: incoming ? 'check' : 'user-plus',
    accessibilityLabel: incoming ? `Godta ${name ?? ''}` : `Legg til ${name ?? ''} som venn`,
    onPress: () => void onPress(),
  };
}

export function FriendButton({ size = 'sm', ...props }: Props) {
  const action = useFriendAction(props);
  if (action.state === 'self' || action.state === 'anonymous') return null;
  const done = !action.onPress;
  return (
    <Button
      title={action.title}
      icon={action.icon}
      size={size}
      variant={done ? 'secondary' : action.state === 'incoming' ? 'primary' : 'ink'}
      fullWidth={size === 'md'}
      disabled={done}
      onPress={action.onPress ?? undefined}
      accessibilityLabel={action.accessibilityLabel}
    />
  );
}
