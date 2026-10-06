import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GroupLookPicker } from '@/components/group/GroupLookPicker';
import { BottomBar, Button, Header, Input, KeyboardAware, PageSkeleton, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useGroup, useUpdateGroup } from '@/data/hooks';
import type { Group } from '@/data/types';
import { coverOptions, suggestCategory } from '@/lib/categories';
import { spacing } from '@/theme';

export default function EditGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  if (!group.data) return <Screen><PageSkeleton /></Screen>;
  return <EditGroupForm group={group.data} />;
}

function EditGroupForm({ group }: { group: Group }) {
  const toast = useToast();
  const update = useUpdateGroup(group.id);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [emoji, setEmoji] = useState<string | null>(group.emoji ?? null);
  const [photo, setPhoto] = useState(group.coverImageUrl);
  const suggestions = coverOptions(group.defaults.category ?? suggestCategory(name), 600);
  const photos = suggestions.includes(photo) ? suggestions : [photo, ...suggestions];

  const save = async () => {
    try {
      await update.mutateAsync({ name: name.trim(), description: description.trim() || null, emoji, coverImageUrl: photo });
      toast({ message: 'Gjengen er oppdatert', tone: 'success' });
      router.back();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke lagre', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" title="Rediger gjengen" />
        <ScreenScroll bottomInset={140}>
          <View style={{ gap: spacing.xl, marginTop: spacing.md }}>
            <Input label="Navn" value={name} onChangeText={setName} maxLength={60} />
            <Input label="Beskrivelse (valgfritt)" value={description} onChangeText={setDescription} maxLength={280} placeholder="Første fredag i måneden …" multiline style={{ minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' }} />
            <View>
              <Text variant="title3" style={{ marginBottom: spacing.md }}>
                Bilde og emoji
              </Text>
              <GroupLookPicker photos={photos} photo={photo} onPhoto={setPhoto} emoji={emoji} onEmoji={setEmoji} />
            </View>
          </View>
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Lagre" disabled={!name.trim()} loading={update.isPending} onPress={save} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
