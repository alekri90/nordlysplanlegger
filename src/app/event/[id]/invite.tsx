import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PersonalLinks } from '@/components/event/PersonalLinks';
import { ShareSheet } from '@/components/event/ShareSheet';
import { GroupPickList } from '@/components/people/GroupPickList';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { SelectedSummary } from '@/components/people/SelectedSummary';
import { BottomBar, Button, Card, Icon, Header, PageSkeleton, PressableScale, Screen, ScreenScroll, Sheet, Text, useToast } from '@/components/ui';
import { inviteToEvents, queryClient, useDateClearance, useEvent, useGroups } from '@/data/hooks';
import type { Group, GuestInvite, PlannerEvent } from '@/data/types';
import { okDates } from '@/lib/clearance';
import { formatLong } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/state/session';
import { spacing, useColors } from '@/theme';

/**
 * Invite more people to an event that already exists: friends and gjenger first (they get a
 * notification and the event shows up in the app), the link last for those without the app.
 * With `clearance`: all the days from «Avklar med noen først» at once, with the people chosen
 * in the create flow already ticked.
 */
export default function InviteToEvent() {
  // events/dates: several events at once (the confirmed dates of an Aufguss request).
  const { id, clearance, events, dates } = useLocalSearchParams<{ id: string; clearance?: string; events?: string; dates?: string }>();
  const many = events ? events.split(',').filter(Boolean) : [];
  const event = useEvent(id);
  const cl = useDateClearance(clearance);
  if (!event.data || (clearance && cl.isLoading)) return <Screen><PageSkeleton /></Screen>;
  const c = cl.data;
  return (
    <InviteForm
      e={event.data}
      eventIds={c?.eventIds.length ? c.eventIds : many.length ? many : [event.data.id]}
      initialUserIds={c ? c.draft.memberIds.filter((u) => u !== c.keyUserId) : []}
      initialGuestNames={c?.draft.guestNames ?? []}
      dates={c ? okDates(c.days) : dates ? dates.split(',').filter(Boolean) : []}
    />
  );
}

function InviteForm({ e, eventIds, initialUserIds, initialGuestNames, dates }: { e: PlannerEvent; eventIds: string[]; initialUserIds: string[]; initialGuestNames: string[]; dates: string[] }) {
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const groups = useGroups();
  const existingIds = useMemo(() => e.members.map((m) => m.userId).filter((x): x is string => !!x), [e.members]);
  const [userIds, setUserIds] = useState<string[]>(() => initialUserIds.filter((u) => !existingIds.includes(u)));
  const [guestNames, setGuestNames] = useState<string[]>(initialGuestNames);
  const [links, setLinks] = useState<{ eventId: string; guests: GuestInvite[] }[]>([]);
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const many = eventIds.length > 1;

  const toggle = (personId: string) => setUserIds((ids) => (ids.includes(personId) ? ids.filter((x) => x !== personId) : [...ids, personId]));
  const newFrom = (g: Group) => g.members.filter((m) => !m.isGuest && m.id !== me?.id && !existingIds.includes(m.id)).map((m) => m.id);
  const groupList = (groups.data ?? []).filter((g) => newFrom(g).length);
  const addGroup = (g: Group) => {
    haptics.light();
    setUserIds((ids) => [...new Set([...ids, ...newFrom(g)])]);
  };
  const count = userIds.length + guestNames.length;

  const send = async () => {
    setSending(true);
    try {
      const { added, links: made } = await inviteToEvents(eventIds, userIds, guestNames);
      queryClient.invalidateQueries();
      haptics.success();
      if (added) toast({ message: many ? `${added === 1 ? 'Én person' : `${added} personer`} er invitert til alle ${eventIds.length} gangene` : `${added === 1 ? 'Invitasjonen' : `${added} invitasjoner`} er sendt`, tone: 'success', icon: 'send' });
      // Those without an account only get it when their link is sent.
      if (made.length) setLinks(made);
      else router.back();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Kunne ikke invitere', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Header back="close" title="Inviter" />
      <ScreenScroll bottomInset={220}>
        <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.lg }}>
          {many ? `${e.title} · ${eventIds.length} ganger. Alle du velger, blir invitert til alle gangene.` : `${e.title} · ${e.members.length} invitert. Venner får beskjed i appen med en gang.`}
        </Text>
        <PeoplePicker
          selectedIds={userIds}
          onToggle={(p) => (p.isGuest ? toast('Skriv navnet under «Uten konto», så får de en personlig lenke') : toggle(p.id))}
          existingIds={existingIds}
          existingLabel="Invitert"
          guestNames={guestNames}
          onGuestNamesChange={setGuestNames}
          header={
            groupList.length ? (
              <GroupPickList
                groups={groupList}
                meId={me?.id}
                selectedIds={userIds}
                onToggle={(p) => toggle(p.id)}
                onSelectAll={addGroup}
                onClearAll={(g) => {
                  const fresh = newFrom(g);
                  setUserIds((ids) => ids.filter((x) => !fresh.includes(x)));
                }}
                existingIds={existingIds}
                accountsOnly
              />
            ) : undefined
          }
        />

        <PressableScale onPress={() => router.push('/friends/find')} accessibilityRole="button" style={{ marginTop: spacing.xl }}>
          <Card muted style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user-plus" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout">Finn flere venner</Text>
              <Text variant="footnote" color="textSecondary">
                Søk, eller se hvem i kontaktene dine som har appen.
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color="textTertiary" />
          </Card>
        </PressableScale>
      </ScreenScroll>
      <BottomBar>
        <SelectedSummary ids={userIds} names={guestNames} />
        <Button variant="ink" title={count ? `Inviter ${count} ${count === 1 ? 'person' : 'personer'}` : 'Velg hvem'} icon="send" disabled={!count} loading={sending} onPress={send} />
        <Button variant="ghost" title="Del lenke til andre" icon="link" onPress={() => setShareOpen(true)} style={{ marginTop: spacing.xs }} />
      </BottomBar>
      <Sheet visible={links.length > 0} onClose={() => router.back()} title="Send lenkene">
        {links.map((l, i) => (
          <View key={l.eventId} style={{ marginTop: i ? spacing.lg : 0 }}>
            {many ? (
              <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm }}>
                {dates[eventIds.indexOf(l.eventId)] ? formatLong(dates[eventIds.indexOf(l.eventId)]) : `Gang ${eventIds.indexOf(l.eventId) + 1}`}
              </Text>
            ) : null}
            <PersonalLinks guests={l.guests} event={e} />
          </View>
        ))}
        <Button title="Ferdig" variant="ink" style={{ marginTop: spacing.lg }} onPress={() => router.back()} />
      </Sheet>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} event={e} />
    </Screen>
  );
}
