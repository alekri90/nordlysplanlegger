import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { StepHeader } from '@/components/create/StepHeader';
import { PeoplePicker } from '@/components/people/PeoplePicker';
import { PersonRow } from '@/components/people/PersonRow';
import { AvatarStack, BottomBar, Button, Card, Divider, Icon, Input, KeyboardAware, ListRow, PageTitle, PressableScale, Screen, ScreenScroll, SectionHeader, Text, Toggle, useToast } from '@/components/ui';
import { useCreateEvent, useGroups, useInviteSuggestions } from '@/data/hooks';
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
  const awaitingAuth = useRef(false);

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

  const send = async () => {
    if (!signedIn) {
      awaitingAuth.current = true;
      router.push({ pathname: '/auth', params: { reason: 'send' } });
      return;
    }
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
      });
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
  const groupMembers = selectedGroup?.members.filter((m) => m.id !== me?.id) ?? [];
  const selectedInGroup = groupMembers.filter((m) => selected.has(m.id)).length;

  return (
    <Screen>
      <KeyboardAware>
        <StepHeader step={draft.source === 'event' ? 1 : 3} total={draft.source === 'event' ? 2 : 4} />
        <ScreenScroll bottomInset={170}>
          <PageTitle title="Hvem skal være med?" />

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
              </Card>
            </Animated.View>
          ) : (
            <>
              {suggestedGroup ? (
                <Animated.View entering={FadeInDown.duration(260)}>
                  <PressableScale onPress={() => chooseGroup(suggestedGroup)} accessibilityLabel={`Velg ${suggestedGroup.name}, ${suggestedGroup.members.length} personer`}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.ink, borderWidth: 0 }}>
                      <Icon name="zap" size={18} tint="#FF9AA2" />
                      <View style={{ flex: 1 }}>
                        <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          Forslag
                        </Text>
                        <Text variant="headline" style={{ color: colors.textOnInk }}>
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

              {groupList.length ? (
                <View style={{ marginTop: spacing.xl }}>
                  <SectionHeader title="Gjengene dine" />
                  <Card style={{ paddingVertical: spacing.xs }}>
                    {groupList.map((g, i) => (
                      <View key={g.id}>
                        {i > 0 ? <Divider /> : null}
                        <ListRow
                          title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`}
                          subtitle={`Hele gjengen · ${g.members.length} personer`}
                          leading={<AvatarStack people={g.members.slice(0, 3)} size={30} max={3} />}
                          radio
                          selected={false}
                          onPress={() => chooseGroup(g)}
                        />
                      </View>
                    ))}
                  </Card>
                </View>
              ) : null}
            </>
          )}

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

          {canSaveGroup ? (
            <Animated.View entering={FadeInDown.duration(250)} style={{ marginTop: spacing.xl }}>
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
            </Animated.View>
          ) : null}

          <Card muted style={{ marginTop: spacing.xl, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="link" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout">Del invitasjonslenke</Text>
              <Text variant="footnote" color="textSecondary">
                Send på SMS, WhatsApp eller Messenger rett etterpå. Gjestene kan svare uten konto.
              </Text>
            </View>
          </Card>
        </ScreenScroll>
        <BottomBar>
          <Button
            variant="ink"
            title={count ? `Send invitasjon · ${count + 1} personer` : 'Lag invitasjonslenke'}
            icon="send"
            loading={createEvent.isPending}
            onPress={send}
          />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
