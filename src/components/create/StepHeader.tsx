import { router } from 'expo-router';

import { Header, ProgressDots } from '@/components/ui';

export const CREATE_STEPS = 4;

/** Back on every step, close on the first; progress dots in the middle. */
export function StepHeader({ step, total = CREATE_STEPS }: { step: number; total?: number }) {
  const first = step === 0 || !router.canGoBack();
  return (
    <Header
      back={first ? 'close' : 'back'}
      onBack={() => (router.canGoBack() ? router.back() : router.dismissAll())}
      center={<ProgressDots count={total} index={step} />}
    />
  );
}
