import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View } from 'react-native';

import { Icon, PressableScale, Sheet, Text, useToast } from '@/components/ui';
import { inviteUrl } from '@/lib/config';
import { inviteMessage, SHARE_CHANNELS, shareTo, type ShareChannel } from '@/lib/share';
import { spacing, useColors } from '@/theme';

const BRAND_ICON: Partial<Record<ShareChannel, React.ComponentProps<typeof FontAwesome>['name']>> = {
  whatsapp: 'whatsapp',
  messenger: 'facebook',
  snapchat: 'snapchat-ghost',
  instagram: 'instagram',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  token: string;
  organizerName?: string;
};

/** Share an invitation to the apps people actually use. */
export function ShareSheet({ visible, onClose, title, token, organizerName }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Del invitasjonen" subtitle="Gjestene svarer rett i nettleseren – ingen app eller konto.">
      <ShareGrid title={title} token={token} organizerName={organizerName} onDone={onClose} />
    </Sheet>
  );
}

export function ShareGrid({ title, token, organizerName, onDone }: { title: string; token: string; organizerName?: string; onDone?: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const url = inviteUrl(token);

  const handle = async (channel: ShareChannel) => {
    try {
      const result = await shareTo(channel, { url, title, message: inviteMessage(title, url, organizerName) });
      if (result === 'copied') toast({ message: 'Lenken er kopiert', tone: 'success', icon: 'link' });
      onDone?.();
    } catch {
      toast({ message: 'Kunne ikke dele akkurat nå', tone: 'error' });
    }
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
      {SHARE_CHANNELS.map((c) => {
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
