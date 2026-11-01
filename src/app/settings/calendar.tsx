import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';

import { Button, Card, Divider, Header, ListRow, Screen, ScreenScroll, Skeleton, Text, Toggle, useToast } from '@/components/ui';
import { calendarAccess, listAllCalendars, listWritableCalendars, removeSyncedEntries, requestCalendarAccess, type CalendarAccess, type CalendarChoice } from '@/lib/calendarSync';
import { useCalendarSyncState } from '@/state/calendarSync';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

function confirm(title: string, message: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ]);
}

/** Profil → Kalendersynk: pick the calendar, and whether to hear about collisions. The first time, the phone asks for access. */
export default function CalendarSettings() {
  const me = useMe();
  const toast = useToast();
  const calendarId = useCalendarSyncState((s) => s.calendarId);
  const choose = useCalendarSyncState((s) => s.choose);
  const conflicts = useCalendarSyncState((s) => s.conflicts);
  const setConflicts = useCalendarSyncState((s) => s.setConflicts);
  const skipped = useCalendarSyncState((s) => s.skippedCalendars);
  const toggleSkipped = useCalendarSyncState((s) => s.toggleSkipped);
  const [access, setAccess] = useState<CalendarAccess | null>(null);
  const [calendars, setCalendars] = useState<CalendarChoice[] | null>(null);
  const [allCalendars, setAllCalendars] = useState<CalendarChoice[]>([]);
  const [busy, setBusy] = useState(false);

  const show = useCallback((next: CalendarAccess) => {
    setAccess(next);
    if (next !== 'granted') return;
    listWritableCalendars().then(setCalendars).catch(() => setCalendars([]));
    listAllCalendars().then(setAllCalendars).catch(() => {});
  }, []);

  useEffect(() => {
    calendarAccess().then(show);
  }, [show]);

  const turnOff = async () => {
    if (!me || !calendarId) return;
    setBusy(true);
    try {
      await removeSyncedEntries(me.id, calendarId);
      choose(null, null);
      toast({ message: 'Kalendersynk er slått av', tone: 'success', icon: 'calendar' });
    } catch {
      toast({ message: 'Fikk ikke fjernet alt fra kalenderen. Prøv igjen.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (c: CalendarChoice) => {
    if (c.id === calendarId || !me) return;
    setBusy(true);
    try {
      // Moving: out of the old calendar first, so nothing ends up in both.
      if (calendarId) await removeSyncedEntries(me.id, calendarId);
      choose(c.id, c.title);
      toast({ message: `Arrangementene legges i ${c.title}`, tone: 'success', icon: 'calendar' });
    } catch {
      toast({ message: 'Fikk ikke byttet kalender. Prøv igjen.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Kalendersynk" />
      <ScreenScroll>
        <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.xl }}>
          Det du skal på, legges automatisk i kalenderen du velger. Endres eller avlyses noe, oppdateres det neste gang du åpner appen.
        </Text>

        {access === null ? (
          <Skeleton height={120} />
        ) : access !== 'granted' ? (
          <Card muted style={{ gap: spacing.md }}>
            <Text variant="callout">{access === 'denied' ? 'Appen har ikke tilgang til kalenderen.' : 'Appen trenger tilgang til kalenderen din.'}</Text>
            <Text variant="footnote" color="textSecondary">
              Alt skjer på telefonen. Ingenting fra kalenderen sendes til oss.
            </Text>
            <Button
              title={access === 'denied' ? 'Åpne innstillinger' : 'Gi tilgang'}
              size="sm"
              variant="ink"
              onPress={async () => {
                if (access === 'denied') return Linking.openSettings();
                show(await requestCalendarAccess());
              }}
            />
          </Card>
        ) : calendars === null ? (
          <Skeleton height={120} />
        ) : calendars.length ? (
          <View>
            <Text variant="title3" style={{ marginBottom: spacing.md }}>
              Velg kalender
            </Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              {calendars.map((c, i) => (
                <View key={c.id}>
                  {i ? <Divider /> : null}
                  <ListRow title={c.title} subtitle={c.source || undefined} radio selected={c.id === calendarId} onPress={busy ? undefined : () => pick(c)} />
                </View>
              ))}
            </Card>
            {calendarId ? (
              <Button
                title="Slå av kalendersynk"
                variant="ghost"
                loading={busy}
                style={{ marginTop: spacing.lg }}
                onPress={() => confirm('Slå av kalendersynk?', 'Kommende arrangementer fjernes fra kalenderen. Det som har vært, blir liggende.', 'Slå av', turnOff)}
              />
            ) : null}
          </View>
        ) : (
          <Card muted>
            <Text variant="callout">Fant ingen kalender appen kan skrive til.</Text>
          </Card>
        )}

        {access === 'granted' && allCalendars.length ? (
          <View style={{ marginTop: spacing.xxl }}>
            <Text variant="title3" style={{ marginBottom: spacing.md }}>
              Kollisjoner
            </Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              <ListRow
                title="Vis kollisjoner"
                subtitle="Viser kalenderne dine i Kalender, og sier fra når noe kolliderer"
                trailing={<Toggle value={conflicts} onValueChange={setConflicts} accessibilityLabel="Vis kollisjoner" />}
              />
              {conflicts
                ? allCalendars.map((c) => (
                    <View key={c.id}>
                      <Divider />
                      <ListRow title={c.title} subtitle={c.source || undefined} radio selected={!skipped.includes(c.id)} onPress={() => toggleSkipped(c.id)} />
                    </View>
                  ))
                : null}
            </Card>
            <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
              Appen leser kalenderne bare her på telefonen, og bare du ser hva som kolliderer.
            </Text>
          </View>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}
