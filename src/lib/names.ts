/**
 * Short names for lists of people: the first name, plus the first letter of the last name only
 * when two people in the same list share a first name ("Alexander K." and "Alexander B.").
 */
export function shortNames(people: { id: string; name: string }[]): Map<string, string> {
  const parts = (name: string) => name.trim().split(/\s+/).filter(Boolean);
  const first = (name: string) => parts(name)[0] ?? name;
  const key = (name: string) => first(name).toLocaleLowerCase('nb');

  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const p of people) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    counts.set(key(p.name), (counts.get(key(p.name)) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const p of people) {
    const words = parts(p.name);
    const shared = (counts.get(key(p.name)) ?? 0) > 1;
    out.set(p.id, shared && words.length > 1 ? `${words[0]} ${words[words.length - 1].charAt(0).toLocaleUpperCase('nb')}.` : first(p.name));
  }
  return out;
}
