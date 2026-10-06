import type { DateOption, EventMember } from '@/data/types';

export interface DateScore {
  option: DateOption;
  /** People who can (respondents who did not mark the date). */
  available: number;
  /** People who marked the date as "kan ikke". */
  unavailable: number;
  /** Respondents, including the organizer. */
  responded: number;
  /** Everyone invited, including the organizer. */
  invited: number;
  unavailableMemberIds: string[];
  isBest: boolean;
  /** Everyone invited has answered and all can. */
  everyoneCan: boolean;
}

const RESPONDED: EventMember['status'][] = ['responded', 'attending', 'declined'];

export function hasResponded(m: Pick<EventMember, 'status' | 'role'>): boolean {
  return m.role === 'organizer' || RESPONDED.includes(m.status);
}

/**
 * Rank candidate dates.
 * Most people who can → fewest who can't → earliest date.
 * The organizer counts as available on all candidate dates unless they marked otherwise.
 * Mirrors the SQL view `event_date_scores`.
 */
export function rankDateOptions(options: DateOption[], members: Pick<EventMember, 'id' | 'role' | 'status' | 'unavailableOptionIds'>[]): DateScore[] {
  const respondents = members.filter(hasResponded);
  const invited = members.length;

  const scores = options.map<DateScore>((option) => {
    const unavailableMemberIds = respondents.filter((m) => m.unavailableOptionIds.includes(option.id)).map((m) => m.id);
    const unavailable = unavailableMemberIds.length;
    return {
      option,
      available: respondents.length - unavailable,
      unavailable,
      responded: respondents.length,
      invited,
      unavailableMemberIds,
      isBest: false,
      everyoneCan: false,
    };
  });

  scores.sort((a, b) => b.available - a.available || a.unavailable - b.unavailable || (a.option.date < b.option.date ? -1 : a.option.date > b.option.date ? 1 : 0));

  if (scores.length && scores[0].available > 0) {
    scores[0].isBest = true;
  }
  for (const s of scores) {
    s.everyoneCan = s.responded === s.invited && s.unavailable === 0 && s.invited > 1;
  }
  return scores;
}

export function responseProgress(members: Pick<EventMember, 'role' | 'status'>[]) {
  const responded = members.filter(hasResponded).length;
  return { responded, invited: members.length, pending: members.length - responded };
}
