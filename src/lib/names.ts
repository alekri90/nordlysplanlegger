/**
 * Short names for lists of people: the first name, plus the first letter of the next name (middle
 * or last name) only when two people in the same list share a first name — "Alexander S." and
 * "Alexander K." instead of two "Alexander". If that still isn't enough, the whole next name.
 */
export function shortNames(people: { id: string; name: string }[]): Map<string, string> {
  const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);
  const lower = (s: string) => s.toLocaleLowerCase('nb');

  const unique = new Map<string, string[]>();
  for (const p of people) if (!unique.has(p.id)) unique.set(p.id, words(p.name));

  const count = (label: (w: string[]) => string) => {
    const counts = new Map<string, number>();
    for (const w of unique.values()) counts.set(lower(label(w)), (counts.get(lower(label(w))) ?? 0) + 1);
    return counts;
  };
  const first = (w: string[]) => w[0] ?? '';
  const initial = (w: string[]) => (w.length > 1 ? `${w[0]} ${w[1].charAt(0).toLocaleUpperCase('nb')}.` : first(w));
  const second = (w: string[]) => (w.length > 1 ? `${w[0]} ${w[1]}` : first(w));
  const byFirst = count(first);
  const byInitial = count(initial);

  const out = new Map<string, string>();
  for (const p of people) {
    const w = unique.get(p.id)!;
    if (!w.length) out.set(p.id, p.name);
    else if ((byFirst.get(lower(first(w))) ?? 0) < 2) out.set(p.id, first(w));
    else if ((byInitial.get(lower(initial(w))) ?? 0) < 2) out.set(p.id, initial(w));
    else out.set(p.id, second(w));
  }
  return out;
}
