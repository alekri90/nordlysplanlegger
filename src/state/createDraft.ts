import { create } from 'zustand';

import type { CategoryId, DateMode, Group, PlannerEvent, TimeHint } from '@/data/types';
import { defaultCover, suggestCategory } from '@/lib/categories';
import { weekday } from '@/lib/dates';
import { DEFAULT_REPEAT, type RepeatConfig } from '@/lib/recurrence';
import { suggestDatesForWeekdays, suggestedMonth, type Period } from '@/lib/period';

/**
 * The event being created. Lives outside the screens so the user can sign in
 * halfway through without losing anything, and so groups can prefill it in one tap.
 */
export type CreateDraft = {
  title: string;
  /** Optional at creation: where, and a few words for everyone. */
  placeName: string;
  details: string;
  category: CategoryId;
  /** True once the user picked a category/photo themselves — stop auto-suggesting. */
  coverTouched: boolean;
  coverImageUrl: string;
  dateMode: DateMode;
  period: Period;
  optionDates: string[];
  fixedDate: string | null;
  timeHint: TimeHint;
  startTime: string | null;
  groupId: string | null;
  /** People with accounts. */
  memberIds: string[];
  /** Guests without an account (from a group or a past event) — they get personal links. */
  guestIds: string[];
  /** New people without an account, by name. */
  guestNames: string[];
  saveAsGroup: boolean;
  groupName: string;
  /** Set when finding a date for an existing, undecided event. */
  existingEventId: string | null;
  /** "Gjenta arrangementet": off unless the user turns it on. */
  repeat: RepeatConfig & { enabled: boolean };
  /** Where the flow started — used to keep it as short as possible. */
  source: 'new' | 'group' | 'event';
};

type Actions = {
  reset: () => void;
  set: (patch: Partial<CreateDraft>) => void;
  setTitle: (title: string) => void;
  toggleDate: (date: string) => void;
  prefillFromGroup: (group: Group, me?: string) => void;
  prefillFromEvent: (event: PlannerEvent, me?: string) => void;
};

const initial = (): CreateDraft => ({
  title: '',
  placeName: '',
  details: '',
  category: 'hangout',
  coverTouched: false,
  coverImageUrl: defaultCover('hangout'),
  dateMode: 'poll',
  period: { kind: 'month', month: suggestedMonth() },
  optionDates: [],
  fixedDate: null,
  timeHint: 'evening',
  startTime: null,
  groupId: null,
  memberIds: [],
  guestIds: [],
  guestNames: [],
  saveAsGroup: false,
  groupName: '',
  existingEventId: null,
  repeat: { ...DEFAULT_REPEAT, enabled: false },
  source: 'new',
});

export const useCreateDraft = create<CreateDraft & Actions>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  set: (patch) => set(patch),
  setTitle: (title) => {
    const { coverTouched, category: previous, coverImageUrl } = get();
    // Keep a theme or photo the user chose; otherwise follow the title.
    const category = coverTouched ? previous : suggestCategory(title);
    set({ title, category, coverImageUrl: coverTouched || category === previous ? coverImageUrl : defaultCover(category) });
  },
  toggleDate: (date) => {
    const { optionDates } = get();
    set({ optionDates: optionDates.includes(date) ? optionDates.filter((d) => d !== date) : [...optionDates, date].sort() });
  },
  prefillFromGroup: (group, me) => {
    const category = group.defaults.category ?? suggestCategory(group.defaults.title ?? group.name);
    set({
      ...initial(),
      title: group.defaults.title ?? '',
      category,
      coverImageUrl: defaultCover(category),
      timeHint: group.defaults.timeHint ?? 'evening',
      startTime: group.defaults.startTime ?? null,
      period: { kind: 'next30' },
      optionDates: suggestDatesForWeekdays(group.defaults.preferredWeekdays ?? []),
      groupId: group.id,
      memberIds: group.members.filter((m) => !m.isGuest && m.id !== me).map((m) => m.id),
      guestIds: group.members.filter((m) => m.isGuest).map((m) => m.id),
      source: 'group',
    });
  },
  prefillFromEvent: (event, me) => {
    set({
      ...initial(),
      title: event.title,
      category: event.category,
      coverTouched: true,
      coverImageUrl: event.coverImageUrl,
      timeHint: event.timeHint,
      startTime: event.startTime ?? null,
      groupId: event.groupId ?? null,
      memberIds: event.members.map((m) => m.userId).filter((id): id is string => !!id && id !== me),
      guestIds: event.members.filter((m) => !m.userId).map((m) => m.person.id),
      period: { kind: 'next30' },
      // Same rhythm as last time: suggest the same weekday over the coming weeks.
      optionDates: event.selectedDate ? suggestDatesForWeekdays([weekday(event.selectedDate)]) : [],
      existingEventId: event.status === 'draft' ? event.id : null,
      source: 'event',
    });
  },
}));
