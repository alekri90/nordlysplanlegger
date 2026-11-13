import { router } from 'expo-router';

import { Header, ProgressDots } from '@/components/ui';

export const CREATE_STEPS = 4;
/** An activity type: what, when, days, venue and role, places and price, participants. */
export const ACTIVITY_STEPS = 6;
/** A building-block type (poker, dinner …): what, when, days, its details, participants. */
export const KIT_STEPS = 5;

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
