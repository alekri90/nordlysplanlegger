import type { PlannerEvent } from '@/data/types';
import { addToCalendar } from './calendar';
import { inviteUrl } from './config';

/** Add a dated event to the phone's calendar. Returns a short message for a toast, or null. */
export async function addEventToCalendar(e: PlannerEvent): Promise<string | null> {
  if (!e.selectedDate) return null;
  const location = e.location ? [e.location.name, e.location.address].filter(Boolean).join(', ') : null;
  const result = await addToCalendar({
    title: e.title,
    date: e.selectedDate,
    startTime: e.startTime ?? (e.timeHint === 'evening' ? '18:00' : null),
    location,
    notes: e.description,
    url: e.inviteToken ? inviteUrl(e.inviteToken) : null,
  });
  if (result === 'saved') return 'Lagt i kalenderen';
  if (result === 'downloaded') return 'Kalenderfilen er lastet ned';
  return null;
}
