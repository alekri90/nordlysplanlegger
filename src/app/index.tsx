import { Redirect } from 'expo-router';

import { useSession } from '@/state/session';

/** Entry gate: signed in → home, otherwise the welcome screen. */
export default function Index() {
  const status = useSession((s) => s.status);
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/(tabs)' : '/welcome'} />;
}
