import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { BottomBar, Button, Header, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text, useToast } from '@/components/ui';
import { repo } from '@/data';
import { spacing } from '@/theme';

/** Sign in with a one-time code sent by e-mail. Two tiny steps, no password. Also creates the account if it's new. */
export default function AuthOtp() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);

  const normalized = email.trim().toLowerCase();
  const valid = /^\S+@\S+\.\S+$/.test(normalized);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await repo.sendOtp({ email: normalized });
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke sende kode');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    if (c.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await repo.verifyOtp({ email: normalized }, c);
      toast({ message: 'Du er logget inn', tone: 'success' });
      // Close this screen and the sign-in sheet beneath it.
      if (router.canDismiss()) router.dismiss(2);
      else router.replace('/(tabs)');
    } catch {
      setError('Koden stemmer ikke. Prøv igjen.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header onBack={step === 'code' ? () => setStep('enter') : undefined} />
        <ScreenScroll>
          {step === 'enter' ? (
            <Animated.View key="enter" entering={FadeInRight.duration(220)}>
              <PageTitle title="Hva er e-posten din?" subtitle="Vi sender deg en kode. Ingen passord å huske." />
              <Input
                size="lg"
                autoFocus
                value={email}
                onChangeText={setEmail}
                placeholder="navn@epost.no"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => valid && send()}
                error={error}
                accessibilityLabel="E-post"
              />
            </Animated.View>
          ) : (
            <Animated.View key="code" entering={FadeInRight.duration(220)}>
              <PageTitle title="Skriv inn koden" subtitle={`Vi sendte en 6-sifret kode til ${normalized}.`} />
              <Input
                ref={codeRef}
                size="lg"
                value={code}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6) verify(digits);
                }}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                style={{ letterSpacing: 8, fontSize: 24 }}
                error={error}
                accessibilityLabel="Engangskode"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg }}>
                <PressableScale onPress={send} hitSlop={10} accessibilityLabel="Send ny kode">
                  <Text variant="footnote" color="textSecondary">
                    Fikk du ingen kode? <Text variant="footnote" color="primary">Send på nytt</Text>
                  </Text>
                </PressableScale>
              </View>
            </Animated.View>
          )}
        </ScreenScroll>
        <BottomBar>
          {step === 'enter' ? (
            <Button variant="ink" title="Send kode" onPress={send} disabled={!valid} loading={busy} />
          ) : (
            <Button variant="ink" title="Logg inn" onPress={() => verify()} disabled={code.length < 6} loading={busy} />
          )}
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
