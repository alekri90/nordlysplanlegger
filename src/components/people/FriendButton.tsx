import { useState } from 'react';

import { Button, useToast } from '@/components/ui';
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

/** "Legg til" → "Sendt" → "Venner". Optimistic so it feels instant. */
export function FriendButton({ userId, state, requestId, size = 'sm', name }: Props) {
  const toast = useToast();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const [local, setLocal] = useState<FriendshipState | null>(null);
  const current = local ?? state;

  if (current === 'self' || current === 'anonymous') return null;

  if (current === 'friends') {
    return <Button title="Venner" icon="check" size={size} variant="secondary" fullWidth={size === 'md'} disabled accessibilityLabel={name ? `Du og ${name} er venner` : 'Venner'} />;
  }
  if (current === 'outgoing') {
    return <Button title="Sendt" icon="clock" size={size} variant="secondary" fullWidth={size === 'md'} disabled accessibilityLabel="Venneforespørsel sendt" />;
  }

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

  return (
    <Button
      title={current === 'incoming' ? 'Godta' : 'Legg til'}
      icon={current === 'incoming' ? 'check' : 'user-plus'}
      size={size}
      variant={current === 'incoming' ? 'primary' : 'ink'}
      fullWidth={size === 'md'}
      onPress={onPress}
      accessibilityLabel={current === 'incoming' ? `Godta ${name ?? ''}` : `Legg til ${name ?? ''} som venn`}
    />
  );
}
