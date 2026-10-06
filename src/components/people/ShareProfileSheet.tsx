import * as Clipboard from 'expo-clipboard';
import { Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Sheet, Text, useToast } from '@/components/ui';
import { env } from '@/lib/config';
import { profilePath } from '@/lib/username';
import { useMe } from '@/state/session';
import { radius, spacing, useColors } from '@/theme';

export function profileUrl(username: string) {
  return `${env.webUrl}${profilePath(username)}`;
}

/** Your profile link and QR code. Scanning opens /@username — in the app if installed, otherwise on the web. */
export function ShareProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  if (!me) return null;
  const url = profileUrl(me.username);

  return (
    <Sheet visible={visible} onClose={onClose} title="Min profil" subtitle="Venner kan skanne koden eller åpne lenken for å legge deg til.">
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View style={{ padding: spacing.lg, backgroundColor: '#FFFFFF', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }} accessible accessibilityLabel={`QR-kode til ${url}`}>
          <QRCode value={url} size={196} color="#16120F" backgroundColor="#FFFFFF" />
        </View>
        <Text variant="headline">@{me.username}</Text>
        <Text variant="footnote" color="textSecondary" selectable>
          {url.replace(/^https?:\/\//, '')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button
          title="Kopier"
          variant="secondary"
          icon="link"
          style={{ flex: 1 }}
          onPress={async () => {
            await Clipboard.setStringAsync(url);
            toast({ message: 'Profillenken er kopiert', tone: 'success', icon: 'link' });
          }}
        />
        <Button
          title="Del"
          variant="ink"
          icon="share"
          style={{ flex: 1 }}
          onPress={() => Share.share(Platform.OS === 'ios' ? { url, message: `Legg meg til på Nordlys Planlegger: ${url}` } : { message: `Legg meg til på Nordlys Planlegger: ${url}` })}
        />
      </View>
    </Sheet>
  );
}
