/**
 * Client-side mirror of the username rules for instant feedback while typing.
 * The database (profiles_username_guard + check_username) is the authority — never trust this alone.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/** "@Alex.K " → "alex.k" */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').trim().toLowerCase();
}

/** Strip what can't be typed into a username, keeping the user's casing. */
export function sanitizeUsernameInput(input: string): string {
  return input
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .replace(/[^A-Za-z0-9_.]/g, '')
    .slice(0, USERNAME_MAX);
}

export type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars' | 'invalid_dots' | 'reserved' | 'blocked' | 'taken';

const RESERVED_EXACT = ['help', 'wen', 'web', 'www', 'api', 'app', 'root', 'staff', 'team', 'security', 'settings', 'login', 'signup', 'privacy', 'terms', 'about', 'me', 'null', 'undefined', 'everyone', 'anonymous', 'gjest', 'guest'];
const RESERVED_PREFIX = ['admin', 'support', 'moderator', 'official', 'system', 'nordlys', 'planlegger'];

/** Format checks only (the blocklist of offensive terms lives server-side). */
export function usernameFormatProblem(normalized: string): UsernameProblem | null {
  if (normalized.length < USERNAME_MIN) return 'too_short';
  if (normalized.length > USERNAME_MAX) return 'too_long';
  if (!/^[a-z0-9_.]+$/.test(normalized)) return 'invalid_chars';
  if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) return 'invalid_dots';
  if (RESERVED_EXACT.includes(normalized) || RESERVED_PREFIX.some((p) => normalized.startsWith(p))) return 'reserved';
  return null;
}

export const USERNAME_MESSAGES: Record<UsernameProblem, string> = {
  too_short: `Minst ${USERNAME_MIN} tegn`,
  too_long: `Maks ${USERNAME_MAX} tegn`,
  invalid_chars: 'Bare bokstaver, tall, _ og .',
  invalid_dots: 'Kan ikke starte eller slutte med punktum, eller ha to på rad',
  reserved: 'Dette navnet er reservert',
  blocked: 'Velg et annet brukernavn',
  taken: 'er opptatt',
};

/** Slug from a display name, used to pre-fill the username field: "Alexander Kristensen" → "alexander". */
export function usernameFromName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return sanitizeUsernameInput(first).toLowerCase();
}

/** Profile link: https://planlegger.nordlyskapital.no/@alexk */
export function profilePath(username: string) {
  return `/@${username}`;
}
