import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { UsernameField } from '@/components/people/UsernameField';
import { Avatar, BottomBar, Button, Header, Icon, Input, KeyboardAware, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useUpdateProfile } from '@/data/hooks';
import { useMe, useSession } from '@/state/session';
import { spacing, useColors } from '@/theme';

export default function EditProfile() {
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const setProfile = useSession((s) => s.setProfile);
  const update = useUpdateProfile();
  const [name, setName] = useState(me?.name ?? '');
  const [username, setUsername] = useState(me?.username ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [usernameValid, setUsernameValid] = useState(true);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const onValid = useCallback((v: boolean) => setUsernameValid(v), []);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setAvatar(result.assets[0].uri);
  };

  const save = async () => {
    try {
      const profile = await update.mutateAsync({
        name: name.trim(),
        bio: bio.trim() || null,
        ...(username !== me?.username ? { username } : {}),
        ...(avatar !== undefined ? { avatarUri: avatar } : {}),
      });
      setProfile(profile);
      toast({ message: 'Profilen er oppdatert', tone: 'success' });
      router.back();
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke lagre', tone: 'error' });
    }
  };

  const shown = avatar === undefined ? me?.avatarUrl : avatar;

  return (
    <Screen>
      <KeyboardAware>
        <Header title="Rediger profil" />
        <ScreenScroll bottomInset={140}>
          <PressableScale onPress={pick} accessibilityLabel="Endre profilbilde" style={{ alignSelf: 'center', marginVertical: spacing.xl }}>
            <Avatar name={name || me?.name || ''} uri={shown} size={112} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background }}>
              <Icon name="camera" size={15} tint={colors.textOnInk} />
            </View>
          </PressableScale>
          {shown ? (
            <PressableScale onPress={() => setAvatar(null)} style={{ alignSelf: 'center', padding: spacing.sm, marginTop: -spacing.md, marginBottom: spacing.md }} accessibilityLabel="Fjern profilbilde">
              <Text variant="footnote" color="textSecondary">
                Fjern bilde – da viser vi initialene dine
              </Text>
            </PressableScale>
          ) : null}

          <View style={{ gap: spacing.xl }}>
            <View>
              <Input label="Visningsnavn" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} textContentType="name" />
              <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs, marginLeft: 4 }}>
                Navnet vennene dine ser.
              </Text>
            </View>
            <View>
              <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: 4 }}>
                Brukernavn
              </Text>
              <UsernameField value={username} onChange={setUsername} displayName={name} current={me?.username} onValidChange={onValid} />
            </View>
            <View>
              <Input label="Om deg (valgfritt)" value={bio} onChangeText={setBio} maxLength={160} placeholder="Badstu, kortspill og lange middager." multiline style={{ minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' }} />
              <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs, marginLeft: 4 }}>
                {bio.length}/160
              </Text>
            </View>
          </View>
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Lagre" disabled={!name.trim() || !usernameValid} loading={update.isPending} onPress={save} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
