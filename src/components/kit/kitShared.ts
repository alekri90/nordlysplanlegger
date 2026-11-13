/** Friendly text for the errors the kit functions raise. */
export function kitError(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m.includes('taken')) return 'Noen andre har tatt den allerede';
  if (m.includes('full')) return 'Bilen er full';
  if (m.includes('not_member')) return 'Svar på invitasjonen først';
  if (m.includes('is_driver') || m.includes('own_ride')) return 'Du kjører selv – avlys turen din først';
  if (m.includes('seats_taken')) return 'Flere sitter allerede på enn det';
  if (m.includes('bad_seats')) return 'Velg mellom 1 og 8 seter';
  if (m.includes('not_allowed')) return 'Det kan bare arrangøren gjøre';
  return 'Noe gikk galt. Prøv igjen.';
}
