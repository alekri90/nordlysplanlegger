import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { UsernameField } from '@/components/people/UsernameField';
import { Avatar, BottomBar, Button, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { useUpdateProfile } from '@/data/hooks';
import { useMe, useSession } from '@/state/session';
import { spacing, useColors } from '@/theme';

/** One-time step for accounts created with an e-mail code: confirm name, pick @username, optional photo. */
export default function ProfileSetup() {
  const colors = useColors();
  const toast = useToast();
  const me = useMe();
  const setProfile = useSession((s) => s.setProfile);
  const update = useUpdateProfile();
  const [name, setName] = useState(me?.name ?? '');
  const [username, setUsername] = useState(me?.username ?? '');
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [valid, setValid] = useState(true);
  const onValid = useCallback((v: boolean) => setValid(v), []);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setAvatar(result.assets[0].uri);
  };

  const save = async () => {
    try {
      const profile = await update.mutateAsync({
        name: name.trim(),
        ...(username !== me?.username ? { username } : {}),
        ...(avatar !== undefined ? { avatarUri: avatar } : {}),
        onboarded: true,
      });
      setProfile(profile);
      router.replace('/(tabs)');
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke lagre', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <ScreenScroll contentContainerStyle={{ paddingTop: spacing.xxl }} bottomInset={140}>
          <PageTitle title="Velkommen!" subtitle="Slik ser vennene dine deg. Du kan endre det senere." />
          <PressableScale onPress={pick} accessibilityLabel="Legg til profilbilde (valgfritt)" style={{ alignSelf: 'center', marginBottom: spacing.xl }}>
            <Avatar name={name || '?'} uri={avatar === undefined ? me?.avatarUrl : avatar} size={104} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background }}>
              <Icon name="camera" size={15} tint={colors.textOnInk} />
            </View>
          </PressableScale>
          <View style={{ gap: spacing.xl }}>
            <Input label="Visningsnavn" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} />
            <View>
              <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: 4 }}>
                Brukernavn – brukes for å finne og legge deg til
              </Text>
              <UsernameField value={username} onChange={setUsername} displayName={name} current={me?.username} onValidChange={onValid} />
            </View>
          </View>
        </ScreenScroll>
        <BottomBar>
          <Button title="Fortsett" variant="ink" disabled={!name.trim() || !valid} loading={update.isPending} onPress={save} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
