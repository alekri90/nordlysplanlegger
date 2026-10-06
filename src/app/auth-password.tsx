import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BottomBar, Button, Header, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { spacing } from '@/theme';

/** E-mail + password sign-in for people who created a profile with a password. */
export default function AuthPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await repo.signInWithPassword(email, password);
      // Back to wherever sign-in started (e.g. a half-finished invitation), closing the sign-in sheet too.
      if (router.canDismiss()) router.dismiss(2);
      else router.replace('/(tabs)');
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke logge inn', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header />
        <ScreenScroll>
          <PageTitle title="Logg inn" />
          <View style={{ gap: spacing.lg }}>
            <Input label="E-post" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus />
            <Input label="Passord" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
          </View>
          <PressableScale onPress={() => router.replace('/auth-otp')} style={{ alignSelf: 'center', padding: spacing.md, marginTop: spacing.md }} accessibilityLabel="Logg inn med kode i stedet">
            <Text variant="footnote" color="textSecondary">
              Glemt passordet? <Text variant="footnote" color="primary">Få en kode på e-post</Text>
            </Text>
          </PressableScale>
        </ScreenScroll>
        <BottomBar>
          <Button title="Logg inn" variant="ink" disabled={!email.trim() || !password} loading={busy} onPress={submit} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
