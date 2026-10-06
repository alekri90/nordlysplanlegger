import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PeoplePicker } from '@/components/people/PeoplePicker';
import { BottomBar, Button, Header, KeyboardAware, PageSkeleton, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useAddGroupMembers, useGroup } from '@/data/hooks';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

/** Friends first, recent people, search by @username, or someone without an account. Multi-select. */
export default function AddMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const group = useGroup(id);
  const add = useAddGroupMembers(id);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [guestNames, setGuestNames] = useState<string[]>([]);

  if (!group.data) return <Screen><PageSkeleton /></Screen>;
  const count = userIds.length + guestNames.length;

  const save = async () => {
    try {
      const added = await add.mutateAsync({ userIds, guestNames });
      haptics.success();
      toast({ message: `${added} ${added === 1 ? 'person' : 'personer'} lagt til i ${group.data!.name}`, tone: 'success' });
      router.back();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke legge til', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" title="Legg til medlemmer" />
        <ScreenScroll bottomInset={140}>
          <Text variant="subhead" color="textSecondary" style={{ marginBottom: spacing.lg }}>
            {group.data.name} · {group.data.members.length} medlemmer
          </Text>
          <PeoplePicker
            selectedIds={userIds}
            onToggle={(p) => setUserIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
            existingIds={group.data.members.map((m) => m.id)}
            guestNames={guestNames}
            onGuestNamesChange={setGuestNames}
          />
        </ScreenScroll>
        <BottomBar>
          <Button
            variant="ink"
            title={count ? `Legg til ${count} ${count === 1 ? 'person' : 'personer'}` : 'Velg personer'}
            disabled={!count}
            loading={add.isPending}
            onPress={save}
          />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
