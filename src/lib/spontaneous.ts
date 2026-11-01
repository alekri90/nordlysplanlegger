const pad = (n: number) => String(n).padStart(2, '0');

const ALL_DAY = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);

/** Today: every half hour that's still ahead. Tomorrow: the whole day. */
export function spontaneousTimes(day: 'today' | 'tomorrow', now = new Date()): string[] {
  if (day === 'tomorrow') return ALL_DAY;
  const start = new Date(now.getTime() + 30 * 60_000);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (start.getDate() !== now.getDate()) return [];
  const first = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  return ALL_DAY.filter((t) => t >= first);
}

const PARTS = [
  { label: 'Morgen', from: '06:00', to: '12:00' },
  { label: 'Dag', from: '12:00', to: '18:00' },
  { label: 'Kveld', from: '18:00', to: '24:00' },
  { label: 'Natt', from: '00:00', to: '06:00' },
];

/** Forty-eight times are easier to read by part of the day. Night comes last: it's rarely the one. */
export function timesByPartOfDay(times: string[]) {
  return PARTS.map((p) => ({ label: p.label, times: times.filter((t) => t >= p.from && t < p.to) })).filter((p) => p.times.length);
}
