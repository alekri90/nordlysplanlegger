import type { InviteView, PlannerEvent, TimeHint } from '@/data/types';
import { countWeekends, formatDayMonth, formatLong, formatShort, formatTime, weekday } from './dates';
import { responseProgress } from './ranking';

/** Human copy for an event's time preference. */
export function timeHintLabel(hint: TimeHint, startTime?: string | null): string {
  if (hint === 'exact' && startTime) return `Kl. ${formatTime(startTime)}`;
  if (hint === 'evening') return 'Etter kl. 18';
  if (hint === 'daytime') return 'På dagtid';
  return 'Når som helst';
}

/** "3 mulige helger" / "6 mulige dager" */
export function optionsSummary(dates: string[]): string {
  const weekends = countWeekends(dates);
  const allWeekend = weekends > 0 && dates.every((d) => weekday(d) >= 4);
  if (allWeekend && weekends > 1) return `${weekends} mulige helger`;
  return dates.length === 1 ? '1 mulig dag' : `${dates.length} mulige dager`;
}

/** The single most useful status line for an event card. */
export function eventStatusLine(e: PlannerEvent, meId?: string): { text: string; tone: 'neutral' | 'primary' | 'success' } {
  const me = e.members.find((m) => m.userId === meId);
  if (e.status === 'polling') {
    if (me && me.role === 'guest' && (me.status === 'invited' || me.status === 'opened')) return { text: 'Venter på svaret ditt', tone: 'primary' };
    const p = responseProgress(e.members);
    return { text: `${p.responded} av ${p.invited} har svart`, tone: p.pending === 0 ? 'success' : 'neutral' };
  }
  if (e.status === 'draft') return { text: 'Finn dato', tone: 'primary' };
  const coming = e.members.filter((m) => m.status === 'attending').length;
  return { text: `${coming} ${coming === 1 ? 'person' : 'personer'}`, tone: 'neutral' };
}

/** "12. oktober" / "Dato bestemmes" / "November" */
export function eventDateLine(e: Pick<PlannerEvent, 'status' | 'selectedDate' | 'periodLabel'>): string {
  if (e.selectedDate) return formatDayMonth(e.selectedDate);
  if (e.status === 'polling') return 'Dato bestemmes';
  return e.periodLabel ?? 'Dato ikke bestemt';
}

export function eventWhenLong(e: Pick<PlannerEvent, 'selectedDate' | 'startTime' | 'timeHint'>): string | null {
  if (!e.selectedDate) return null;
  const time = e.startTime ? ` · ${formatTime(e.startTime)}` : e.timeHint === 'evening' ? ' · Etter kl. 18' : '';
  return `${formatLong(e.selectedDate)}${time}`;
}

export function inviteSubtitle(invite: InviteView): string {
  if (invite.event.selectedDate) return formatLong(invite.event.selectedDate);
  return invite.event.periodLabel ?? (invite.event.options[0] ? formatShort(invite.event.options[0].date) : '');
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
