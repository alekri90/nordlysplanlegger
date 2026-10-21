import { confirmDestructive } from '@/components/people/PersonSheet';

/**
 * «Kan ikke» is easy to tap by mistake, and the organizer is told at once — so ask first.
 * Signed in, the event also leaves Home.
 */
export function confirmDecline(organizer: string, signedIn: boolean, run: () => void) {
  confirmDestructive(
    'Kan du ikke denne gangen?',
    signedIn ? `${organizer} får beskjed, og arrangementet fjernes fra Hjem.` : `${organizer} får beskjed med en gang.`,
    'Kan ikke',
    run,
  );
}
