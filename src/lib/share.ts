import * as Clipboard from 'expo-clipboard';
import { Linking, Platform, Share } from 'react-native';

export type ShareChannel = 'sms' | 'messenger' | 'whatsapp' | 'snapchat' | 'instagram' | 'email' | 'copy' | 'more';

/** Snapchat first — it's where most people actually talk. */
export const SHARE_CHANNELS: { id: ShareChannel; label: string; color: string }[] = [
  { id: 'snapchat', label: 'Snapchat', color: '#FFFC00' },
  { id: 'sms', label: 'Melding', color: '#34C759' },
  { id: 'messenger', label: 'Messenger', color: '#0A7CFF' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'email', label: 'E-post', color: '#6E6661' },
  { id: 'copy', label: 'Kopier lenke', color: '#16120F' },
  { id: 'more', label: 'Mer', color: '#A39B96' },
];

/**
 * Apps that only take a link from other apps (no ready-made text): Snapchat and Instagram
 * through the share sheet, Messenger by Meta's rules. We copy the text so it can be pasted.
 */
export const LINK_ONLY_CHANNELS: ShareChannel[] = ['snapchat', 'instagram', 'messenger'];

export function inviteMessage(title: string, url: string, organizerFirstName?: string, toFirstName?: string) {
  return `Hei${toFirstName ? ` ${toFirstName}` : ''}! ${organizerFirstName ? `${organizerFirstName} vil` : 'Vi vil'} invitere deg til ${title} 🎉 Trykk på lenken og si hvilke dager du kan – du trenger ikke appen: ${url}`;
}

export function groupInviteMessage(groupName: string, url: string, inviterFirstName?: string) {
  return `Hei! ${inviterFirstName ? `${inviterFirstName} vil` : 'Vi vil'} invitere deg til ${groupName} 🎉 Bli med her, så planlegger vi neste gang sammen: ${url}`;
}

async function tryOpen(url: string) {
  try {
    if (Platform.OS !== 'web' && !(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

type ShareInput = {
  url: string;
  message: string;
  title: string;
  /** Called after the text was copied for an app that only takes the link — before that app opens. */
  onTextCopied?: () => void;
};

/**
 * Shares an invitation through a specific app when possible, otherwise the system share sheet.
 * Returns `'copied'` when only the link was copied so the UI can confirm it.
 */
export async function shareTo(channel: ShareChannel, { url, message, title, onTextCopied }: ShareInput): Promise<'opened' | 'copied' | 'shared'> {
  const text = encodeURIComponent(message);
  if (LINK_ONLY_CHANNELS.includes(channel)) {
    await Clipboard.setStringAsync(message);
    onTextCopied?.();
  }
  switch (channel) {
    case 'copy':
      await Clipboard.setStringAsync(url);
      return 'copied';
    case 'sms':
      if (await tryOpen(Platform.OS === 'ios' ? `sms:&body=${text}` : `sms:?body=${text}`)) return 'opened';
      break;
    case 'whatsapp':
      if (await tryOpen(Platform.OS === 'web' ? `https://wa.me/?text=${text}` : `whatsapp://send?text=${text}`)) return 'opened';
      break;
    case 'messenger':
      if (await tryOpen(`fb-messenger://share/?link=${encodeURIComponent(url)}`)) return 'opened';
      break;
    case 'email':
      if (await tryOpen(`mailto:?subject=${encodeURIComponent(title)}&body=${text}`)) return 'opened';
      break;
    default:
      break;
  }
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
    await Clipboard.setStringAsync(LINK_ONLY_CHANNELS.includes(channel) ? message : url);
    return 'copied';
  }
  // Snapchat and Instagram don't take text from other apps on iOS: send the link alone (it shows
  // as a card with picture and title); the text is already on the clipboard.
  if (Platform.OS === 'ios') await Share.share(LINK_ONLY_CHANNELS.includes(channel) ? { url } : { message, url });
  else await Share.share({ message, title });
  return 'shared';
}
