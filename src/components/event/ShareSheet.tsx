import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View } from 'react-native';

import { Icon, PressableScale, Sheet, Text, useToast } from '@/components/ui';
import { inviteUrl } from '@/lib/config';
import { inviteMessage, LINK_ONLY_CHANNELS, SHARE_CHANNELS, shareTo, type ShareChannel } from '@/lib/share';
import { spacing, useColors } from '@/theme';

const BRAND_ICON: Partial<Record<ShareChannel, React.ComponentProps<typeof FontAwesome>['name']>> = {
  whatsapp: 'whatsapp',
  messenger: 'facebook',
  snapchat: 'snapchat-ghost',
  instagram: 'instagram',
};

export const SNAP_YELLOW = '#FFFC00';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  token: string;
  organizerName?: string;
};

/** Share an invitation to the apps people actually use. */
export function ShareSheet({ visible, onClose, title, token, organizerName }: Props) {
  const url = inviteUrl(token);
  return (
    <Sheet visible={visible} onClose={onClose} title="Del invitasjonen" subtitle="Gjestene svarer rett i nettleseren – ingen app eller konto.">
      <ShareGrid url={url} title={title} message={inviteMessage(title, url, organizerName)} onDone={onClose} />
    </Sheet>
  );
}

export type ShareContent = { url: string; title: string; message: string };

/** Shares through one app, with the right confirmation toast. Returns false if it failed. */
export function useShareTo() {
  const toast = useToast();
  return async (channel: ShareChannel, content: ShareContent) => {
    try {
      const result = await shareTo(channel, {
        ...content,
        onTextCopied: () => toast({ message: 'Teksten er kopiert – lim den inn i chatten', tone: 'success', icon: 'clipboard' }),
      });
      if (result === 'copied' && !LINK_ONLY_CHANNELS.includes(channel)) toast({ message: 'Lenken er kopiert', tone: 'success', icon: 'link' });
      return true;
    } catch {
      toast({ message: 'Kunne ikke dele akkurat nå', tone: 'error' });
      return false;
    }
  };
}

export function ShareGrid({ url, title, message, onDone, exclude = [] }: ShareContent & { onDone?: () => void; exclude?: ShareChannel[] }) {
  const colors = useColors();
  const share = useShareTo();

  const handle = async (channel: ShareChannel) => {
    if (await share(channel, { url, title, message })) onDone?.();
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
      {SHARE_CHANNELS.filter((c) => !exclude.includes(c.id)).map((c) => {
        const brand = BRAND_ICON[c.id];
        const fg = c.id === 'snapchat' ? '#16120F' : '#FFFFFF';
        return (
          <PressableScale key={c.id} onPress={() => handle(c.id)} accessibilityLabel={`Del via ${c.label}`} style={{ width: '25%', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: c.id === 'copy' || c.id === 'more' || c.id === 'email' ? colors.surfaceMuted : c.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {brand ? (
                <FontAwesome name={brand} size={26} color={fg} />
              ) : (
                <Icon
                  name={c.id === 'sms' ? 'message-circle' : c.id === 'email' ? 'mail' : c.id === 'copy' ? 'link' : 'share'}
                  size={22}
                  tint={c.id === 'sms' ? '#FFFFFF' : colors.text}
                />
              )}
            </View>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {c.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
