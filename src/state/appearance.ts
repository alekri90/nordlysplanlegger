import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';

/** «Automatisk» follows the phone; «Lys»/«Mørk» always. Automatic for everyone new. */
export type AppearancePreference = 'auto' | 'light' | 'dark';

const KEY = 'nordlys.appearance';

type State = {
  preference: AppearancePreference;
  /** False until the saved choice is read, so the app doesn't flash the wrong theme. */
  ready: boolean;
  setPreference: (preference: AppearancePreference) => void;
};

/** Native alerts, pickers and the keyboard follow the app's choice too. */
function applyToSystem(preference: AppearancePreference) {
  if (Platform.OS === 'web') return;
  try {
    // RN 0.86: 'unspecified' removes the override and follows the phone again.
    Appearance.setColorScheme(preference === 'auto' ? 'unspecified' : preference);
  } catch {
    // Older native runtimes: the app's own colours still follow the choice.
  }
}

export const useAppearance = create<State>((set) => ({
  preference: 'auto',
  ready: false,
  setPreference: (preference) => {
    applyToSystem(preference);
    set({ preference });
    AsyncStorage.setItem(KEY, preference).catch(() => {});
  },
}));

AsyncStorage.getItem(KEY)
  .then((saved) => {
    const preference: AppearancePreference = saved === 'light' || saved === 'dark' ? saved : 'auto';
    applyToSystem(preference);
    useAppearance.setState({ preference, ready: true });
  })
  .catch(() => useAppearance.setState({ ready: true }));
