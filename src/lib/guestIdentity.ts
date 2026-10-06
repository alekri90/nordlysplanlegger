import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A guest who answers without an account gets a secret from the server.
 * We keep it on the device so they can change their answer later and,
 * if they sign up, link their earlier answers to the new account.
 */
const SECRET_KEY = 'guest.secret';
const NAME_KEY = 'guest.name';

export async function getGuestSecret(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SECRET_KEY);
  } catch {
    return null;
  }
}

export async function setGuestSecret(secret: string) {
  await AsyncStorage.setItem(SECRET_KEY, secret).catch(() => {});
}

export async function clearGuestSecret() {
  await AsyncStorage.removeItem(SECRET_KEY).catch(() => {});
}

export async function getGuestName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export async function setGuestName(name: string) {
  await AsyncStorage.setItem(NAME_KEY, name).catch(() => {});
}

/**
 * The personal invite link a guest signed up from. Kept until the account exists
 * (e-mail confirmation can happen later, in another tab), then used to claim the seat.
 */
const CLAIM_TOKEN_KEY = 'guest.claimToken';

export async function getPendingClaimToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLAIM_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setPendingClaimToken(token: string | null) {
  if (token) await AsyncStorage.setItem(CLAIM_TOKEN_KEY, token).catch(() => {});
  else await AsyncStorage.removeItem(CLAIM_TOKEN_KEY).catch(() => {});
}
