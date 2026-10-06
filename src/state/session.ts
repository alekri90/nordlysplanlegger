import { useEffect } from 'react';
import { create } from 'zustand';

import { repo } from '@/data';
import type { Profile } from '@/data/types';

type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  profile: null,
  setProfile: (profile) => set({ profile, status: profile ? 'signedIn' : 'signedOut' }),
}));

/** Mount once at the root: loads the session and keeps it in sync with auth changes. */
export function useSessionBootstrap() {
  const setProfile = useSession((s) => s.setProfile);
  useEffect(() => {
    let alive = true;
    repo
      .getMe()
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    const unsubscribe = repo.onAuthChange((p) => setProfile(p));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [setProfile]);
}

export const useMe = () => useSession((s) => s.profile);
export const useIsSignedIn = () => useSession((s) => s.status === 'signedIn');
/** Premium is prepared but never gates planning features. */
export const usePlan = () => {
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  return { tier, isPlus: tier === 'plus' };
};
