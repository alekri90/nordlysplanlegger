/**
 * Suggest a group name from an event title.
 * "Quiz hos Alexander" → "Quiz", "Badstu med jentene" → "Jentene", "Spillkveld" → "Spill".
 */
export function suggestGroupName(title: string): string {
  let t = title.trim();
  const med = t.match(/\bmed\s+(.+)$/i);
  if (med) t = med[1];
  else t = t.split(/\s+(?:hos|på|i)\s+/i)[0];
  const stripped = t.replace(/kveld(en)?$/i, '').trim();
  if (stripped.length >= 3) t = stripped;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
