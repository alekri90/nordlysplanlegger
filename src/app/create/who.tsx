import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PlaceDetails } from '@/components/create/PlaceDetails';
import { GuestsCanInviteSetting } from '@/components/event/GuestsCanInviteSetting';
import { PlacesSetting } from '@/components/event/PlacesSetting';
import { PriceSetting } from '@/components/event/PriceSetting';
import { repo } from '@/data';
import { InviteTiming, datesInvitedNow } from '@/components/create/InviteTiming';
import { ACTIVITY_STEPS, StepHeader } from '@/components/create/StepHeader';
import { GroupPickList } from '@/components/people/GroupPickList';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { PersonRow } from '@/components/people/PersonRow';
import { SelectedSummary } from '@/components/people/SelectedSummary';
import { AvatarStack, BottomBar, Button, Card, Divider, Icon, Input, ListRow, PageTitle, PressableScale, Screen, ScreenScroll, Text, Toggle, useToast } from '@/components/ui';
import { useCreateActivityPlan, useCreateEvent, useCreateEventSeries, useGroups, useInviteSuggestions, useSaveVenue } from '@/data/hooks';
import { activityType } from '@/lib/activities';
import type { Group, Person } from '@/data/types';
import { periodLabelFor } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { useCreateDraft } from '@/state/createDraft';
import { useIsSignedIn, useMe } from '@/state/session';
import { radius, spacing, useColors } from '@/theme';

/**
 * Step 4 — who's coming? A group pre-selects everyone (deselect individuals); otherwise
 * smart suggestions from your own history, friends, recent people, search, or a name without an account.
 * Guests never need an account. The organizer signs in only here, at "Send".
 */
export default function CreateWho() {
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const signedIn = useIsSignedIn();
  const draft = useCreateDraft();
  const groups = useGroups();
  const suggestion = useInviteSuggestions(draft.category, draft.title);
  const createEvent = useCreateEvent();
  const createSeries = useCreateEventSeries();
  const plan = useCreateActivityPlan();
  const saveVenue = useSaveVenue();
  const awaitingAuth = useRef(false);
  const type = activityType(draft.activityType);
  // An activity type: every date its own event (or alternatives for one); participants now or later.
  const activityDates = type ? (draft.dateMode === 'fixed' ? (draft.fixedDate ? [draft.fixedDate] : []) : [...draft.optionDates].sort()) : [];
  const activityMode: 'each' | 'poll' = draft.dateMode === 'fixed' ? 'each' : draft.activityMode;
  const eventDates = activityMode === 'each' ? activityDates : [];
  const nowDates = type ? (activityMode === 'each' ? datesInvitedNow(eventDates, draft.inviteNow, draft.inviteOverrides) : draft.inviteNow ? activityDates : []) : [];
  const showPeople = !type || nowDates.length > 0;
  const [moreOpen, setMoreOpen] = useState(!!draft.maxParticipants || draft.guestsCanInvite || draft.saveAsGroup);

  const groupList = groups.data ?? [];
  const selectedGroup = groupList.find((g) => g.id === draft.groupId) ?? null;
  const suggestedGroup = !selectedGroup ? groupList.find((g) => g.id === suggestion.data?.groupId) : undefined;
  const usual = (suggestion.data?.people ?? []).filter((p) => !draft.memberIds.includes(p.id));

  const selected = useMemo(() => new Set([...draft.memberIds, ...draft.guestIds]), [draft.memberIds, draft.guestIds]);

  const chooseGroup = (g: Group) => {
    haptics.tap();
    draft.set({
      groupId: g.id,
      memberIds: g.members.filter((m) => !m.isGuest && m.id !== me?.id).map((m) => m.id),
      guestIds: g.members.filter((m) => m.isGuest).map((m) => m.id),
      saveAsGroup: false,
    });
  };

  const clearGroup = () => draft.set({ groupId: null, memberIds: [], guestIds: [] });

  // «Velg alle» on a group: with nobody picked yet, the event belongs to that group (as before);
  // otherwise its people are added to those already picked.
  const selectWholeGroup = (g: Group) => {
    if (!draft.groupId && !draft.memberIds.length && !draft.guestIds.length) return chooseGroup(g);
    const others = g.members.filter((m) => m.id !== me?.id);
    draft.set({
      memberIds: [...new Set([...draft.memberIds, ...others.filter((m) => !m.isGuest).map((m) => m.id)])],
      guestIds: [...new Set([...draft.guestIds, ...others.filter((m) => m.isGuest).map((m) => m.id)])],
    });
  };
  const clearWholeGroup = (g: Group) => {
    const ids = new Set(g.members.map((m) => m.id));
    draft.set({
      memberIds: draft.memberIds.filter((x) => !ids.has(x)),
      guestIds: draft.guestIds.filter((x) => !ids.has(x)),
      ...(draft.groupId === g.id ? { groupId: null } : {}),
    });
  };

  const toggle = (p: Person) => {
    if (p.isGuest) {
      draft.set({ guestIds: draft.guestIds.includes(p.id) ? draft.guestIds.filter((x) => x !== p.id) : [...draft.guestIds, p.id] });
    } else {
      draft.set({ memberIds: draft.memberIds.includes(p.id) ? draft.memberIds.filter((x) => x !== p.id) : [...draft.memberIds, p.id] });
    }
  };

  const selectAllUsual = () => {
    haptics.light();
    draft.set({ memberIds: [...new Set([...draft.memberIds, ...usual.map((p) => p.id)])] });
  };

  const sendActivity = async () => {
    if (!type) return;
    let venue = draft.venue;
    if (venue && !venue.id) {
      try {
        const v = await saveVenue.mutateAsync({ activityType: type.id, name: venue.name, capacity: venue.capacity });
        venue = { id: v.id, name: v.name, capacity: v.capacity };
      } catch {
        // Saving it for next time is a bonus; the plan goes out anyway.
      }
    }
    try {
      const r = await plan.mutateAsync({
        activityType: type.id,
        mode: activityMode,
        dates: activityDates,
        event: {
          title: draft.title.trim(),
          category: draft.category,
          coverImageUrl: draft.coverImageUrl,
          timeHint: draft.timeHint,
          startTime: draft.startTime,
          groupId: draft.groupId,
          memberIds: draft.memberIds,
          guestIds: draft.guestIds,
          guestNames: draft.guestNames,
          saveAsGroupName: !draft.groupId && draft.saveAsGroup && draft.groupName.trim() ? draft.groupName.trim() : null,
          location: venue ? { name: venue.name } : null,
          description: draft.details.trim() || null,
        },
        inviteDates: nowDates,
        maxParticipants: draft.maxParticipants,
        price: draft.price,
        guestsCanInvite: draft.guestsCanInvite,
        venueCapacity: venue?.capacity ?? null,
        candidates: draft.roleCandidates,
        note: draft.roleNote.trim() || null,
      });
      haptics.success();
      draft.reset();
      router.dismissAll();
      router.push({ pathname: '/rolle/[id]', params: { id: r.requestId, fresh: '1' } });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende. Prøv igjen.', tone: 'error' });
    }
  };

  const send = async () => {
    if (!signedIn) {
      awaitingAuth.current = true;
      router.push({ pathname: '/auth', params: { reason: 'send' } });
      return;
    }
    if (type) return sendActivity();
    try {
      const result = await createEvent.mutateAsync({
        title: draft.title.trim(),
        category: draft.category,
        coverImageUrl: draft.coverImageUrl,
        dateMode: draft.dateMode,
        optionDates: draft.dateMode === 'poll' ? draft.optionDates : [],
        fixedDate: draft.dateMode === 'fixed' ? draft.fixedDate : null,
        timeHint: draft.timeHint,
        startTime: draft.startTime,
        periodLabel: draft.dateMode === 'poll' ? periodLabelFor(draft.optionDates) : null,
        groupId: draft.groupId,
        memberIds: draft.memberIds,
        guestIds: draft.guestIds,
        guestNames: draft.guestNames,
        saveAsGroupName: !draft.groupId && draft.saveAsGroup && draft.groupName.trim() ? draft.groupName.trim() : null,
        location: draft.placeName.trim() ? { name: draft.placeName.trim() } : null,
        description: draft.details.trim() || null,
        spontaneous: draft.spontaneous,
      });
      // These are set right after, before a series copies them.
      if (draft.maxParticipants || draft.guestsCanInvite || draft.price) {
        await repo.updateEvent(result.eventId, {
          ...(draft.maxParticipants && { maxParticipants: draft.maxParticipants }),
          ...(draft.guestsCanInvite && { guestsCanInvite: true }),
          ...(draft.price && { price: draft.price }),
        });
      }
      if (draft.repeat.enabled && draft.dateMode !== 'undecided') {
        const { enabled: _on, ...config } = draft.repeat;
        try {
          await createSeries.mutateAsync({ eventId: result.eventId, config });
        } catch {
          toast({ message: 'Arrangementet er sendt, men gjentakelsen kunne ikke lagres. Prøv fra «Mer».', tone: 'error' });
        }
      }
      haptics.success();
      router.replace({
        pathname: '/create/sent',
        params: { id: result.eventId, token: result.inviteToken, guests: JSON.stringify(result.guests) },
      });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende. Prøv igjen.', tone: 'error' });
    }
  };

  // Continue automatically once the organizer has signed in.
  useEffect(() => {
    if (signedIn && awaitingAuth.current) {
      awaitingAuth.current = false;
      send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const count = draft.memberIds.length + draft.guestIds.length + draft.guestNames.length;
  const canSaveGroup = !draft.groupId && draft.memberIds.length + draft.guestNames.length >= 2;
  const hasMore = !draft.existingEventId || canSaveGroup;
  const groupMembers = selectedGroup?.members.filter((m) => m.id !== me?.id) ?? [];
  const otherGroups = groupList.filter((g) => g.id !== selectedGroup?.id);
  const selectedInGroup = groupMembers.filter((m) => selected.has(m.id)).length;

  return (
    <Screen>
      <StepHeader step={type ? 5 : draft.source === 'event' ? 1 : 3} total={type ? ACTIVITY_STEPS : draft.source === 'event' ? 2 : draft.clearance ? 5 : 4} />
      <ScreenScroll bottomInset={220}>
        <PageTitle
          title={type ? 'Deltagere' : 'Hvem skal være med?'}
          subtitle={type ? `Forespørselen til ${type.role.definite} sendes uansett. Velg om deltagerne skal inviteres nå eller senere.` : draft.clearance ? 'Velg nå eller senere. Ingen blir invitert før dagene er avklart.' : undefined}
        />

        {type ? (
          <View style={{ marginBottom: spacing.xl }}>
            <InviteTiming inviteNow={draft.inviteNow} overrides={draft.inviteOverrides} dates={eventDates} roleLabel={type.role.lower} roleDefinite={type.role.definite} onChange={(patch) => draft.set(patch)} />
          </View>
        ) : null}

        {showPeople ? (
        <>

        {selectedGroup ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  {selectedGroup.emoji ? <Text style={{ fontSize: 24 }}>{selectedGroup.emoji}</Text> : <Icon name="users" size={22} color="primary" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{selectedGroup.name}</Text>
                  <Text variant="footnote" color="textSecondary">
                    {selectedInGroup} av {groupMembers.length} valgt
                  </Text>
                </View>
                <Button title="Bytt" size="sm" variant="secondary" onPress={clearGroup} />
              </View>
              <View style={{ marginTop: spacing.sm }}>
                {groupMembers.map((m) => (
                  <PersonRow key={m.id} person={m} size={40} selected={selected.has(m.id)} onPress={() => toggle(m)} />
                ))}
              </View>
              {draft.repeat.enabled ? (
                <>
                  <Divider />
                  <ListRow
                    icon="repeat"
                    title="Samme gjeng neste gang"
                    subtitle="Nye i gjengen blir med automatisk"
                    trailing={<Toggle value={draft.repeat.autoInviteGroup} onValueChange={(autoInviteGroup) => draft.set({ repeat: { ...draft.repeat, autoInviteGroup } })} accessibilityLabel="Samme gjeng neste gang" />}
                  />
                </>
              ) : null}
            </Card>
          </Animated.View>
        ) : (
          <>
            {suggestedGroup ? (
              <Animated.View entering={FadeInDown.duration(260)}>
                <PressableScale onPress={() => chooseGroup(suggestedGroup)} accessibilityLabel={`Velg ${suggestedGroup.name}, ${suggestedGroup.members.length} personer`}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.feature, borderWidth: 0 }}>
                    <Icon name="zap" size={18} tint="#FF9AA2" />
                    <View style={{ flex: 1 }}>
                      <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Forslag
                      </Text>
                      <Text variant="headline" style={{ color: colors.textOnFeature }}>
                        {suggestedGroup.emoji ? `${suggestedGroup.emoji} ` : ''}
                        {suggestedGroup.name} · {suggestedGroup.members.length} personer
                      </Text>
                    </View>
                    <AvatarStack people={suggestedGroup.members} size={26} max={3} />
                  </Card>
                </PressableScale>
              </Animated.View>
            ) : usual.length >= 2 ? (
              <Animated.View entering={FadeInDown.duration(260)}>
                <Card style={{ gap: spacing.md }}>
                  <Text variant="footnote" color="textSecondary">
                    Du inviterer vanligvis
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <AvatarStack people={usual} size={32} max={4} />
                    <Text variant="callout" style={{ flex: 1 }} numberOfLines={2}>
                      {usual.slice(0, 4).map((p) => firstName(p.name)).join(', ')}
                    </Text>
                  </View>
                  <Button title="Velg alle" size="sm" variant="ink" icon="check" onPress={selectAllUsual} />
                </Card>
              </Animated.View>
            ) : null}

          </>
        )}

        {otherGroups.length ? (
          <View style={{ marginTop: spacing.xl }}>
            <GroupPickList
              groups={otherGroups}
              meId={me?.id}
              selectedIds={selected}
              onToggle={toggle}
              onSelectAll={selectWholeGroup}
              onClearAll={clearWholeGroup}
              title={selectedGroup ? 'Flere fra andre gjenger' : 'Gjengene dine'}
            />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <PeoplePicker
            selectedIds={[...selected]}
            onToggle={toggle}
            // Group members are toggled in the group card above; here they just show as "Med".
            existingIds={groupMembers.map((m) => m.id)}
            existingLabel="I gjengen"
            guestNames={draft.guestNames}
            onGuestNamesChange={(names) => draft.set({ guestNames: names })}
          />
        </View>

        </>
        ) : null}

        {hasMore ? (
          <View style={{ marginTop: spacing.xl }}>
            <PressableScale
              onPress={() => setMoreOpen(!moreOpen)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOpen }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
            >
              <Text variant="callout" style={{ flex: 1 }}>
                Flere valg
              </Text>
              <Icon name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} color="textSecondary" />
            </PressableScale>
            {moreOpen ? (
              <Animated.View entering={FadeIn.duration(200)} style={{ gap: spacing.md, marginTop: spacing.sm }}>
                {type ? (
                  <Card style={{ paddingVertical: spacing.xs }}>
                    <GuestsCanInviteSetting value={draft.guestsCanInvite} onChange={(guestsCanInvite) => draft.set({ guestsCanInvite })} />
                  </Card>
                ) : !draft.existingEventId ? (
                  <Card style={{ paddingVertical: spacing.xs }}>
                    <PlacesSetting value={draft.maxParticipants} onChange={(maxParticipants) => draft.set({ maxParticipants })} />
                    <Divider />
                    <PriceSetting value={draft.price} onChange={(price) => draft.set({ price })} maxParticipants={draft.maxParticipants} />
                    <Divider />
                    <GuestsCanInviteSetting value={draft.guestsCanInvite} onChange={(guestsCanInvite) => draft.set({ guestsCanInvite })} />
                  </Card>
                ) : null}
                {canSaveGroup ? (
                  <Card>
                    <ListRow
                      icon="users"
                      title="Lagre som gjeng"
                      subtitle="Neste gang er det ett trykk"
                      trailing={<Toggle value={draft.saveAsGroup} onValueChange={(v) => draft.set({ saveAsGroup: v })} accessibilityLabel="Lagre som gjeng" />}
                    />
                    {draft.saveAsGroup ? (
                      <Animated.View entering={FadeIn}>
                        <Input placeholder="Navn på gjengen, f.eks. Jentene" value={draft.groupName} onChangeText={(t) => draft.set({ groupName: t })} containerStyle={{ marginTop: spacing.sm }} />
                      </Animated.View>
                    ) : null}
                  </Card>
                ) : null}
                {/* No date step for «Ikke bestemt ennå», so the optional place lives here. */}
                {draft.dateMode === 'undecided' && !draft.existingEventId ? <PlaceDetails /> : null}
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        {showPeople ? <SelectedSummary ids={[...draft.memberIds, ...draft.guestIds]} names={draft.guestNames} /> : null}
        <Button
          variant="ink"
          title={type
            ? `Send forespørsel til ${draft.roleCandidates.map((c) => firstName(c.name)).slice(0, 2).join(' og ')}${nowDates.length ? (count ? ` · inviter ${count}` : ' · lag invitasjon') : ''}`
            : draft.clearance ? (count ? `Fortsett · ${count} valgt` : 'Velg senere') : draft.spontaneous ? (count ? `Spør hvem som er gira · ${count}` : 'Lag lenke – hvem er gira?') : count ? `Send invitasjon · ${count + 1} personer` : 'Lag invitasjonslenke'}
          icon={draft.clearance ? 'arrow-right' : 'send'}
          loading={createEvent.isPending || plan.isPending}
          onPress={draft.clearance ? () => router.push('/create/clear') : send}
        />
      </BottomBar>
    </Screen>
  );
}
