import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui';
import { useJoinGroup } from '@/data/hooks';
import { useSession } from '@/state/session';

/**
 * The group link someone tapped "Bli med" on before they had an account. Kept on the device
 * until they're signed in and have chosen their name, then they join and land in the group.
 */
const KEY = 'group.pendingJoin';

export async function setPendingGroupJoin(token: string | null) {
  if (token) await AsyncStorage.setItem(KEY, token).catch(() => {});
  else await AsyncStorage.removeItem(KEY).catch(() => {});
}

async function getPendingGroupJoin(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Mounted once at the root: finishes a pending join as soon as the profile is ready. */
export function usePendingGroupJoin() {
  const ready = useSession((s) => s.status === 'signedIn' && !!s.profile?.onboarded);
  const join = useJoinGroup();
  const toast = useToast();
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || busy.current) return;
    busy.current = true;
    (async () => {
      const token = await getPendingGroupJoin();
      if (!token) return;
      await setPendingGroupJoin(null);
      try {
        const groupId = await join.mutateAsync(token);
        toast({ message: 'Du er med i gjengen 🎉', tone: 'success' });
        router.push(`/group/${groupId}`);
      } catch (e) {
        toast({ message: e instanceof Error ? e.message : 'Kunne ikke bli med', tone: 'error' });
      }
    })().finally(() => {
      busy.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}
