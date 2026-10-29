import { Platform } from 'react-native';

import { normalizePhone } from './phone';

export type ContactPhones = { status: 'granted'; phones: string[] } | { status: 'denied' | 'unavailable' };

/** Only in the app — the web has no address book. */
export const contactsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

// Loaded lazily: builds made before expo-contacts was added don't have the native module.
async function load() {
  try {
    return await import('expo-contacts');
  } catch {
    return null;
  }
}

/** Has the user already let us read the contacts? Never asks. */
export async function hasContactsAccess(): Promise<boolean> {
  if (!contactsSupported) return false;
  const Contacts = await load();
  if (!Contacts) return false;
  try {
    return (await Contacts.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * The phone numbers in the address book, normalized. Asks for access the first time.
 * Names and everything else stay on the phone.
 */
export async function readContactPhones(): Promise<ContactPhones> {
  if (!contactsSupported) return { status: 'unavailable' };
  const Contacts = await load();
  if (!Contacts) return { status: 'unavailable' };
  try {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const details = await Contacts.Contact.getAllDetails([Contacts.ContactField.PHONES]);
    const phones = new Set<string>();
    for (const c of details) for (const p of c.phones ?? []) {
      const n = p.number ? normalizePhone(p.number) : null;
      if (n) phones.add(n);
    }
    return { status: 'granted', phones: [...phones] };
  } catch {
    return { status: 'unavailable' };
  }
}
