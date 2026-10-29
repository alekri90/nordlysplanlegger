/**
 * Phone numbers as E.164 (+4791234567), so a number typed on a profile matches the same number in
 * someone's contacts however it was written. Norwegian numbers without a country code get +47.
 */
export function normalizePhone(raw: string, defaultCountry = '47'): string | null {
  let s = raw.trim().replace(/[\s\-(). ]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (s.startsWith('+')) {
    const digits = s.slice(1);
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (!/^\d+$/.test(s)) return null;
  // Local Norwegian number: 8 digits.
  if (defaultCountry === '47' && s.length === 8) return `+47${s}`;
  // Already with the country code but no plus, e.g. 4791234567.
  if (s.startsWith(defaultCountry) && s.length === defaultCountry.length + 8) return `+${s}`;
  return null;
}

/** +4791234567 → 912 34 567 (Norwegian), others as they are. */
export function formatPhone(e164: string): string {
  const m = /^\+47(\d{3})(\d{2})(\d{3})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}
