import * as Clipboard from 'expo-clipboard';
import { Linking, Platform, Share } from 'react-native';

export type ShareChannel = 'sms' | 'messenger' | 'whatsapp' | 'snapchat' | 'instagram' | 'email' | 'copy' | 'more';

export const SHARE_CHANNELS: { id: ShareChannel; label: string; color: string }[] = [
  { id: 'sms', label: 'SMS', color: '#34C759' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { id: 'messenger', label: 'Messenger', color: '#0A7CFF' },
  { id: 'snapchat', label: 'Snapchat', color: '#FFFC00' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'email', label: 'E-post', color: '#6E6661' },
  { id: 'copy', label: 'Kopier lenke', color: '#16120F' },
  { id: 'more', label: 'Mer', color: '#A39B96' },
];

export function inviteMessage(title: string, url: string, organizerFirstName?: string) {
  return `${organizerFirstName ? `${organizerFirstName} vil` : 'Vi vil'} finne en dato for ${title}. Trykk på lenken og marker dagene du ikke kan – du trenger ikke appen: ${url}`;
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

/**
 * Shares an invitation through a specific app when possible, otherwise the system share sheet.
 * Returns `'copied'` when the link was copied so the UI can confirm it.
 */
export async function shareTo(channel: ShareChannel, { url, message, title }: { url: string; message: string; title: string }): Promise<'opened' | 'copied' | 'shared'> {
  const text = encodeURIComponent(message);
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
    // Snapchat and Instagram only accept links through the system share sheet.
    default:
      break;
  }
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
  await Share.share(Platform.OS === 'ios' ? { message, url } : { message, title });
  return 'shared';
}
