import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { SyncedEntries } from '@/lib/calendarPlan';

type Saved = { calendarId: string | null; calendarTitle: string | null; synced: SyncedEntries };

type State = Saved & {
  userId: string | null;
  load: (userId: string | null) => Promise<void>;
  choose: (calendarId: string | null, calendarTitle: string | null) => void;
  setSynced: (update: (synced: SyncedEntries) => SyncedEntries) => void;
};

const EMPTY: Saved = { calendarId: null, calendarTitle: null, synced: {} };
const keyFor = (userId: string) => `nordlys.calendarSync.${userId}`;

/** Remembered on this phone, per person: the calendar is the phone's, not the account's. */
export const useCalendarSyncState = create<State>((set, get) => {
  const save = () => {
    const { userId, calendarId, calendarTitle, synced } = get();
    if (userId) AsyncStorage.setItem(keyFor(userId), JSON.stringify({ calendarId, calendarTitle, synced })).catch(() => {});
  };
  return {
    ...EMPTY,
    userId: null,
    load: async (userId) => {
      if (userId === get().userId) return;
      const raw = userId ? await AsyncStorage.getItem(keyFor(userId)).catch(() => null) : null;
      set({ ...EMPTY, ...(raw ? (JSON.parse(raw) as Saved) : null), userId });
    },
    choose: (calendarId, calendarTitle) => {
      set({ calendarId, calendarTitle, synced: {} });
      save();
    },
    setSynced: (update) => {
      set({ synced: update(get().synced) });
      save();
    },
  };
});

/** With sync on, the entry is taken care of: no «Legg i kalender», which would only add it twice. */
export function useIsInCalendar(eventId: string) {
  return useCalendarSyncState((s) => !!s.calendarId && eventId in s.synced);
}
