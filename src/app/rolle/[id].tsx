import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { ShareGrid } from '@/components/event/ShareSheet';
import { confirmDestructive } from '@/components/people/PersonSheet';
import { PersonRow } from '@/components/people/PersonRow';
import { BottomBar, Button, Card, Divider, EmptyState, Header, Icon, Input, ListRow, PageSkeleton, PageTitle, PressableScale, Screen, ScreenScroll, SectionHeader, Sheet, Tag, Text, useToast, type IconName } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useAddRoleCandidates, useAssignRole, useCancelRoleRequest, useEvents, useFriends, useRoleRequest } from '@/data/hooks';
import type { ColorTokens } from '@/theme/tokens';
import type { PlannerEvent, RoleCandidate, RoleDateStatus, RoleRequest, RoleRequestDate } from '@/data/types';
import { activityType } from '@/lib/activities';
import { roleRequestUrl } from '@/lib/config';
import { formatLong } from '@/lib/dates';
import { firstName, timeHintLabel } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { assignedTo, dateStatus, dateStatusLabel, requestSummary, whoCan } from '@/lib/roleRequest';
import { roleRequestMessage } from '@/lib/share';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

const STATUS_LOOK: Record<RoleDateStatus, { icon: IconName; color: keyof ColorTokens }> = {
  confirmed: { icon: 'check-circle', color: 'success' },
  choose: { icon: 'user-check', color: 'primary' },
  unavailable: { icon: 'x-circle', color: 'danger' },
  pending: { icon: 'clock', color: 'textTertiary' },
  cancelled: { icon: 'slash', color: 'textTertiary' },
};

/**
 * The organizer's overview of one request for a role (the sauna master): the status of every date,
 * who can, who got it, and the participants on each event. Choosing, asking someone else and
 * inviting participants are separate actions.
 */
export default function RoleRequestPage() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const q = useRoleRequest(id);
  if (q.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!q.data) {
    return (
      <Screen>
        <Header back="back" />
        <EmptyState icon="help-circle" title="Fant ikke forespørselen" body="Den kan være avbrutt." />
      </Screen>
    );
  }
  return <Overview r={q.data} fresh={fresh === '1'} />;
}

function Overview({ r, fresh }: { r: RoleRequest; fresh: boolean }) {
  const toast = useToast();
  const me = useMe();
  const events = useEvents();
  const assign = useAssignRole();
  const cancel = useCancelRoleRequest();
  const type = activityType(r.activityType);
  const roleLabel = type?.role.label ?? r.roleLabel;
  const [open, setOpen] = useState<RoleRequestDate | null>(null);
  const [share, setShare] = useState<RoleCandidate | null>(null);
  const [asking, setAsking] = useState(false);

  const byId = useMemo(() => new Map((events.data ?? []).map((e) => [e.id, e])), [events.data]);
  const statuses = r.dates.map((d) => dateStatus(d, r.status === 'cancelled'));
  const confirmedEvents = [...new Set(r.dates.filter((_, i) => statuses[i] === 'confirmed').map((d) => d.eventId).filter((x): x is string => !!x))];
  const confirmedDates = r.dates.filter((_, i) => statuses[i] === 'confirmed').map((d) => d.date);
  const openDates = r.dates.filter((_, i) => statuses[i] === 'pending' || statuses[i] === 'unavailable');
  const asked = (c: RoleCandidate) => r.dates.filter((d) => d.answers.some((a) => a.candidateId === c.id)).length;

  const give = async (d: RoleRequestDate, c: RoleCandidate | null) => {
    try {
      await assign.mutateAsync({ dateId: d.id, candidateId: c?.id ?? null });
      haptics.success();
      toast({ message: c ? `${firstName(c.name)} er ${r.roleLabel} ${formatLong(d.date)}` : 'Rollen er tatt bort', tone: 'success' });
      setOpen(null);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Noe gikk galt', tone: 'error' });
    }
  };

  const cancelEvent = (d: RoleRequestDate) => {
    if (!d.eventId) return;
    confirmDestructive('Avlyse arrangementet?', `${formatLong(d.date)} avlyses. De som er invitert, får beskjed.`, 'Avlys', async () => {
      await repo.cancelEvent(d.eventId!);
      await queryClient.invalidateQueries();
      setOpen(null);
      toast('Arrangementet er avlyst');
    });
  };

  const stop = () =>
    confirmDestructive('Avbryte forespørselen?', `Lenkene til ${r.roleLabel} slutter å virke. Arrangementene blir liggende til du avlyser dem.`, 'Avbryt forespørselen', async () => {
      await cancel.mutateAsync(r.id);
      toast('Forespørselen er avbrutt');
      router.back();
    });

  return (
    <Screen>
      <Header back="back" />
      <ScreenScroll bottomInset={200}>
        <PageTitle title={r.title} subtitle={[r.placeName, timeHintLabel(r.timeHint, r.startTime), requestSummary(r)].filter(Boolean).join(' · ')} />

        <SectionHeader title={r.candidates.length === 1 ? roleLabel : `${roleLabel}e som er spurt`} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {r.candidates.map((c, i) => (
            <View key={c.id}>
              {i ? <Divider /> : null}
              <ListRow
                icon={c.userId ? 'user' : 'link'}
                title={c.name}
                subtitle={`${c.answeredAt ? 'Har svart' : c.userId ? 'Har fått beskjed i appen' : fresh ? 'Send lenken' : 'Ikke svart ennå'} · ${asked(c)} ${asked(c) === 1 ? 'dato' : 'datoer'}`}
                trailing={<Button size="sm" variant={!c.userId && !c.answeredAt ? 'ink' : 'secondary'} title="Del lenke" icon="share" fullWidth={false} onPress={() => setShare(c)} />}
              />
              {c.reply ? (
                <Text variant="footnote" color="textSecondary" style={{ paddingBottom: spacing.sm }}>
                  «{c.reply}»
                </Text>
              ) : null}
            </View>
          ))}
        </Card>

        <SectionHeader title={r.mode === 'poll' ? 'Alternative datoer' : 'Arrangementene'} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {r.dates.map((d, i) => (
            <View key={d.id}>
              {i ? <Divider /> : null}
              <DateRow d={d} status={statuses[i]} r={r} event={d.eventId ? byId.get(d.eventId) : undefined} onPress={() => setOpen(d)} />
            </View>
          ))}
        </Card>
        <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.md }}>
          {r.mode === 'poll'
            ? `Lås datoen i arrangementet når du vil. Velg en dato der ${r.roleLabel} er bekreftet.`
            : `Datoer uten ${r.roleLabel} er foreløpige. Du kan spørre en annen, endre eller avlyse dem.`}
        </Text>

        {openDates.length && r.status === 'open' ? (
          <Button variant="secondary" icon="user-plus" title={`Spør en annen ${r.roleLabel}`} onPress={() => setAsking(true)} style={{ marginTop: spacing.xl }} />
        ) : null}
        <Button variant="ghost" title="Avbryt forespørselen" onPress={stop} style={{ marginTop: spacing.md }} />
      </ScreenScroll>

      {confirmedEvents.length ? (
        <BottomBar>
          <Button
            variant="ink"
            icon="user-plus"
            title={confirmedEvents.length > 1 ? `Inviter deltagere · ${confirmedEvents.length} bekreftet` : 'Inviter deltagere'}
            onPress={() =>
              router.push({ pathname: '/event/[id]/invite', params: { id: confirmedEvents[0], events: confirmedEvents.join(','), dates: r.mode === 'each' ? confirmedDates.join(',') : '' } })
            }
          />
          <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
            Til arrangementene med bekreftet {r.roleLabel}
          </Text>
        </BottomBar>
      ) : null}

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? formatLong(open.date) : ''}>
        {open ? <DateSheet d={open} r={r} event={open.eventId ? byId.get(open.eventId) : undefined} onGive={give} onCancel={() => cancelEvent(open)} busy={assign.isPending} onClose={() => setOpen(null)} /> : null}
      </Sheet>

      <Sheet visible={!!share} onClose={() => setShare(null)} title={share ? `Lenke til ${firstName(share.name)}` : ''}>
        {share ? (
          <>
            <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.md }}>
              Lenken er personlig. {firstName(share.name)} svarer på hver dato uten å installere appen.
            </Text>
            <ShareGrid
              url={roleRequestUrl(share.token)}
              title={r.title}
              message={roleRequestMessage(r.title, roleRequestUrl(share.token), r.roleLabel, asked(share), me ? firstName(me.name) : undefined, firstName(share.name))}
              onDone={() => setShare(null)}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={asking} onClose={() => setAsking(false)} title={`Spør en annen ${r.roleLabel}`}>
        {asking ? <AskAnother r={r} dates={openDates} onDone={(c) => { setAsking(false); if (c && !c.userId) setShare(c); }} /> : null}
      </Sheet>
    </Screen>
  );
}

function DateRow({ d, status, r, event, onPress }: { d: RoleRequestDate; status: RoleDateStatus; r: RoleRequest; event?: PlannerEvent; onPress: () => void }) {
  const look = STATUS_LOOK[status];
  const can = whoCan(d, r.candidates);
  const label = dateStatusLabel(status, { roleLabel: activityType(r.activityType)?.role.label ?? r.roleLabel, name: assignedTo(d, r.candidates)?.name ?? can[0]?.name, canCount: can.length });
  const guests = event ? event.members.filter((m) => m.role !== 'organizer') : [];
  const coming = guests.filter((m) => m.status === 'attending').length;
  const people = r.mode === 'poll' ? null : !event ? null : guests.length ? `${guests.length} invitert${coming ? ` · ${coming} kommer` : ''}` : 'Deltagere ikke invitert';
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${formatLong(d.date)}: ${label}${people ? `. ${people}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Icon name={look.icon} size={20} color={look.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" style={{ opacity: status === 'cancelled' ? 0.55 : 1 }}>
          {formatLong(d.date)}
        </Text>
        <Text variant="footnote" color={status === 'choose' ? 'primary' : status === 'unavailable' ? 'danger' : 'textSecondary'}>
          {label}
          {people && status !== 'cancelled' ? ` · ${people}` : ''}
        </Text>
      </View>
      {status === 'choose' ? <Tag label="Velg" tone="primary" /> : null}
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </PressableScale>
  );
}

function DateSheet({ d, r, event, onGive, onCancel, busy, onClose }: { d: RoleRequestDate; r: RoleRequest; event?: PlannerEvent; onGive: (d: RoleRequestDate, c: RoleCandidate | null) => void; onCancel: () => void; busy: boolean; onClose: () => void }) {
  const status = dateStatus(d, r.status === 'cancelled');
  const can = whoCan(d, r.candidates);
  const holder = assignedTo(d, r.candidates);
  const answerOf = (c: RoleCandidate) => d.answers.find((a) => a.candidateId === c.id)?.answer;
  const askedHere = r.candidates.filter((c) => d.answers.some((a) => a.candidateId === c.id));
  const invited = event ? event.members.filter((m) => m.role !== 'organizer').length : 0;
  return (
    <View style={{ gap: spacing.md }}>
      <Card muted style={{ paddingVertical: spacing.xs }}>
        {askedHere.map((c, i) => {
          const a = answerOf(c);
          const has = holder?.id === c.id;
          return (
            <View key={c.id}>
              {i ? <Divider /> : null}
              <ListRow
                icon={has ? 'award' : a === true ? 'check' : a === false ? 'x' : 'clock'}
                title={c.name}
                subtitle={has ? `Er ${r.roleLabel}` : a === true ? 'Kan' : a === false ? 'Kan ikke' : 'Ikke svart'}
                trailing={
                  status !== 'cancelled' && a === true && !has ? (
                    <Button size="sm" variant="ink" title={holder ? 'Bytt til' : 'Gi rollen'} fullWidth={false} loading={busy} onPress={() => onGive(d, c)} />
                  ) : has ? (
                    <Button size="sm" variant="secondary" title="Fjern" fullWidth={false} onPress={() => onGive(d, null)} />
                  ) : undefined
                }
              />
            </View>
          );
        })}
      </Card>
      {status === 'choose' && can.length > 1 ? (
        <Text variant="footnote" color="textSecondary">
          Flere kan. Velg hvem som får rollen – det blir aldri mer enn én.
        </Text>
      ) : null}
      {d.eventId && status !== 'cancelled' ? (
        <>
          <Button variant="secondary" icon="calendar" title="Åpne arrangementet" onPress={() => { onClose(); router.push(`/event/${d.eventId}`); }} />
          {r.mode === 'each' ? (
            <Button
              variant="secondary"
              icon="user-plus"
              title={invited ? `Inviter flere deltagere · ${invited} invitert` : 'Inviter deltagere'}
              onPress={() => { onClose(); router.push(`/event/${d.eventId}/invite`); }}
            />
          ) : null}
          {r.mode === 'each' ? <Button variant="ghost" title="Avlys denne datoen" onPress={onCancel} /> : null}
        </>
      ) : null}
      {Platform.OS === 'web' ? null : <View style={{ height: spacing.sm }} />}
    </View>
  );
}

function AskAnother({ r, dates, onDone }: { r: RoleRequest; dates: RoleRequestDate[]; onDone: (c: RoleCandidate | null) => void }) {
  const toast = useToast();
  const friends = useFriends();
  const add = useAddRoleCandidates();
  const [picked, setPicked] = useState<string[]>(dates.map((d) => d.id));
  const [friendId, setFriendId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const already = new Set(r.candidates.map((c) => c.userId).filter(Boolean));
  const list = (friends.data ?? []).filter((f) => !already.has(f.id));
  const friend = list.find((f) => f.id === friendId);
  const ready = picked.length > 0 && (!!friend || !!name.trim());

  const send = async () => {
    try {
      const res = await add.mutateAsync({ requestId: r.id, candidates: [friend ? { userId: friend.id, name: friend.name } : { name: name.trim() }], dateIds: picked });
      haptics.success();
      const c = res.candidates[0];
      toast({ message: c.userId ? `${firstName(c.name)} har fått beskjed` : `Send lenken til ${firstName(c.name)}`, tone: 'success' });
      onDone({ id: c.id, userId: c.userId, name: c.name, token: c.token, reply: null, answeredAt: null });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende', tone: 'error' });
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="footnote" color="textSecondary">
        Hen får bare spørsmål om datoene du krysser av.
      </Text>
      <Card muted style={{ paddingVertical: spacing.xs }}>
        {dates.map((d, i) => (
          <View key={d.id}>
            {i ? <Divider /> : null}
            <ListRow
              title={formatLong(d.date)}
              subtitle={dateStatus(d) === 'unavailable' ? 'Ingen kan' : 'Venter på svar'}
              radio
              selected={picked.includes(d.id)}
              onPress={() => setPicked(picked.includes(d.id) ? picked.filter((x) => x !== d.id) : [...picked, d.id])}
            />
          </View>
        ))}
      </Card>
      {list.map((f) => (
        <PersonRow key={f.id} person={f} size={40} selected={friendId === f.id} onPress={() => { setFriendId(friendId === f.id ? null : f.id); setName(''); }} />
      ))}
      <Input placeholder="Eller et navn – hen får en lenke" value={name} onChangeText={(t) => { setName(t); setFriendId(null); }} maxLength={60} accessibilityLabel="Navn" />
      <Button variant="ink" icon="send" title={ready ? `Spør ${friend ? firstName(friend.name) : firstName(name.trim())} · ${picked.length} ${picked.length === 1 ? 'dato' : 'datoer'}` : 'Velg dato og person'} disabled={!ready} loading={add.isPending} onPress={send} />
    </View>
  );
}
