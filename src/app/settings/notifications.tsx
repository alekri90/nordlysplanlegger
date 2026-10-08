import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button, Card, Divider, Header, ListRow, Screen, ScreenScroll, Skeleton, Text, Toggle } from '@/components/ui';
import { useNotificationPreferences, useSetNotificationPreferences } from '@/data/hooks';
import type { NotificationPreferences } from '@/data/types';
import { pushPermissionStatus, registerForPush } from '@/lib/push';
import { radius, spacing } from '@/theme';

const ROWS: { key: keyof NotificationPreferences; title: string; subtitle: string }[] = [
  { key: 'invites', title: 'Invitasjoner', subtitle: 'Når noen inviterer deg' },
  { key: 'responses', title: 'Svar', subtitle: 'Når gjengen svarer, når alle kan samme dag, og når noen melder seg av' },
  { key: 'dateLocked', title: 'Datoer og beskjeder', subtitle: 'Når en dato er bestemt eller endret, og nye beskjeder fra arrangøren' },
  { key: 'reminders', title: 'Påminnelser', subtitle: 'Mandag: denne uken · dagen før · 2 timer før · hvis du ikke har svart' },
  { key: 'groupNudges', title: 'Forslag', subtitle: '«Skal vi finne neste dato?»' },
];

export default function NotificationSettings() {
  const prefs = useNotificationPreferences();
  const setPrefs = useSetNotificationPreferences();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');

  useEffect(() => {
    pushPermissionStatus().then(setPermission);
  }, []);

  return (
    <Screen>
      <Header title="Varsler" />
      <ScreenScroll>
        {permission !== 'granted' && Platform.OS !== 'web' ? (
          <Card muted style={{ marginBottom: spacing.lg, gap: spacing.md }}>
            <Text variant="callout">Varsler er slått av for appen.</Text>
            <Button
              title={permission === 'denied' ? 'Åpne innstillinger' : 'Slå på varsler'}
              size="sm"
              variant="ink"
              onPress={async () => {
                if (permission === 'denied') return Linking.openSettings();
                await registerForPush();
                setPermission(await pushPermissionStatus());
              }}
            />
          </Card>
        ) : null}
        {prefs.data ? (
          <Card style={{ paddingVertical: spacing.xs }}>
            {ROWS.map((r, i) => (
              <View key={r.key}>
                {i ? <Divider /> : null}
                <ListRow
                  title={r.title}
                  subtitle={r.subtitle}
                  trailing={<Toggle value={prefs.data[r.key]} onValueChange={(v) => setPrefs.mutate({ ...prefs.data!, [r.key]: v })} accessibilityLabel={r.title} />}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Skeleton height={320} rounded={radius.lg} />
        )}
      </ScreenScroll>
    </Screen>
  );
}
