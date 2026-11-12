/**
 * A request for a role (the sauna master) about several dates: the status of each date, and
 * what the organizer sees. Mirrors role_date_status() in the database.
 * Self-contained so it runs in the Node test runner.
 */
import type { RoleCandidate, RoleDateStatus, RoleRequest, RoleRequestDate } from '../data/types';

export function dateStatus(d: RoleRequestDate, requestCancelled = false): RoleDateStatus {
  if (d.eventCancelled || requestCancelled) return 'cancelled';
  if (d.assignedCandidateId) return 'confirmed';
  if (d.answers.some((a) => a.answer === true)) return 'choose';
  if (d.answers.length && d.answers.every((a) => a.answer === false)) return 'unavailable';
  return 'pending';
}

/** Those who said «Kan» for the date. */
export const whoCan = (d: RoleRequestDate, candidates: RoleCandidate[]) =>
  candidates.filter((c) => d.answers.some((a) => a.candidateId === c.id && a.answer === true));

export const assignedTo = (d: RoleRequestDate, candidates: RoleCandidate[]) => candidates.find((c) => c.id === d.assignedCandidateId) ?? null;

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** «Badstumester: Ola» · «2 kan – velg» · «Ingen kan» · «Venter på svar» · «Avlyst». */
export function dateStatusLabel(status: RoleDateStatus, opts: { roleLabel: string; name?: string | null; canCount?: number }): string {
  switch (status) {
    case 'confirmed':
      return `${opts.roleLabel}: ${first(opts.name ?? '')}`.trim();
    case 'choose':
      return opts.canCount && opts.canCount > 1 ? `${opts.canCount} kan – velg` : `${opts.name ? first(opts.name) : 'Noen'} kan – bekreft`;
    case 'unavailable':
      return 'Ingen kan';
    case 'cancelled':
      return 'Avlyst';
    default:
      return 'Venter på svar';
  }
}

export interface RequestCounts {
  confirmed: number;
  choose: number;
  unavailable: number;
  pending: number;
  cancelled: number;
  total: number;
}

export function requestCounts(r: Pick<RoleRequest, 'dates' | 'status'>): RequestCounts {
  const c: RequestCounts = { confirmed: 0, choose: 0, unavailable: 0, pending: 0, cancelled: 0, total: r.dates.length };
  for (const d of r.dates) c[dateStatus(d, r.status === 'cancelled')]++;
  return c;
}

/** «3 av 8 bekreftet · 2 venter» — one line for lists. */
export function requestSummary(r: Pick<RoleRequest, 'dates' | 'status'>): string {
  const c = requestCounts(r);
  const live = c.total - c.cancelled;
  if (!live) return 'Alle er avlyst';
  const parts = [`${c.confirmed} av ${live} bekreftet`];
  if (c.choose) parts.push(`${c.choose} å velge`);
  if (c.pending) parts.push(`${c.pending} venter`);
  if (c.unavailable) parts.push(`${c.unavailable} der ingen kan`);
  return parts.join(' · ');
}

/** Does this request need something from the organizer (choose, or nobody can)? */
export const needsOrganizer = (r: Pick<RoleRequest, 'dates' | 'status'>) => {
  const c = requestCounts(r);
  return c.choose + c.unavailable > 0;
};

/** The one asked: the answers to send when everything open is set to «Kan» or «Kan ikke». */
export function setAll<D extends { id: string; taken: boolean; cancelled: boolean }>(dates: D[], answer: boolean | null, only?: string[]): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const d of dates) if (!d.taken && !d.cancelled && (!only || only.includes(d.id))) out[d.id] = answer;
  return out;
}
