import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { FriendButton } from '@/components/people/FriendButton';
import { UsernameField } from '@/components/people/UsernameField';
import { Avatar, BottomBar, Button, Card, Confetti, Header, Icon, Input, KeyboardAware, PressableScale, Screen, ScreenScroll, Tag, Text, useToast, type IconName } from '@/components/ui';
import { repo } from '@/data';
import { queryClient, useGroups, useInvite, usePublicProfile, useUpdateProfile } from '@/data/hooks';
import { firstName } from '@/lib/eventText';
import { setPendingClaimToken } from '@/lib/guestIdentity';
import { usernameFromName } from '@/lib/username';
import { useMe, useSession } from '@/state/session';
import { spacing, useColors } from '@/theme';

const OTP_MIN = 6;
const OTP_MAX = 8;

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'edit-3', text: 'Du slipper å skrive inn navnet neste gang' },
  { icon: 'user-plus', text: 'Venner kan invitere deg direkte' },
  { icon: 'users', text: 'Du kan bli lagt til i faste gjenger' },
  { icon: 'calendar', text: 'Du får oversikt over arrangementene dine' },
];

/**
 * One screen to save a profile — offered *after* a guest has answered, never before.
 * `?token=` (the invite they came from) links their earlier answers securely; `?name=` pre-fills.
 */
export default function SignUp() {
  const { token, name: prefillName } = useLocalSearchParams<{ token?: string; name?: string }>();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(prefillName ?? '');
  const [username, setUsername] = useState(prefillName ? usernameFromName(prefillName) : '');
  const [usernameValid, setUsernameValid] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'form' | 'code' | 'done'>('form');
  const onValid = useCallback((v: boolean) => setUsernameValid(v), []);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = displayName.trim().length > 0 && usernameValid && emailValid;

  // No password: the e-mailed code both verifies the address and signs in (same as logging in).
  const submit = async () => {
    setBusy(true);
    try {
      // Remember the personal link so the guest seat is linked to the new profile.
      if (token) await setPendingClaimToken(token);
      await repo.signUp({ displayName: displayName.trim(), username: username.trim(), email: email.trim() });
      setCode('');
      setCodeError(null);
      setStep('code');
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke opprette profilen', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await repo.sendOtp({ email: email.trim() });
      toast({ message: 'Ny kode sendt', tone: 'success' });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende koden', tone: 'error' });
    }
  };

  const verify = async (value = code) => {
    if (value.length < OTP_MIN || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      await repo.verifyOtp({ email: email.trim() }, value);
      await repo.claimGuest({ inviteToken: token });
      queryClient.invalidateQueries();
      setStep('done');
    } catch {
      setCodeError('Koden stemmer ikke eller er utløpt. Prøv igjen eller send en ny.');
    } finally {
      setBusy(false);
    }
  };
  if (step === 'done') return <SignedUpView token={token} />;

  if (step === 'code') {
    return (
      <Screen>
        <KeyboardAware>
          <Header back="back" onBack={() => setStep('form')} />
          <ScreenScroll>
            <Animated.View entering={FadeIn.duration(220)}>
              <Text variant="title1" accessibilityRole="header">
                Skriv inn koden
              </Text>
              <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
                Vi sendte en kode til {email.trim()}. Sjekk søppelpost hvis du ikke finner den.
              </Text>
              <Input
                size="lg"
                value={code}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, OTP_MAX);
                  // Pasted or auto-filled → submit right away; typed → submit at full length.
                  const pasted = digits.length - code.length > 1;
                  setCode(digits);
                  if (digits.length === OTP_MAX || (pasted && digits.length >= OTP_MIN)) verify(digits);
                }}
                placeholder="Kode"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={OTP_MAX}
                autoFocus
                style={{ letterSpacing: 8, fontSize: 24 }}
                error={codeError}
                accessibilityLabel="Engangskode"
              />
              <PressableScale onPress={resend} hitSlop={10} style={{ alignSelf: 'center', marginTop: spacing.lg }} accessibilityLabel="Send ny kode">
                <Text variant="footnote" color="textSecondary">
                  Fikk du ingen kode? <Text variant="footnote" color="primary">Send på nytt</Text>
                </Text>
              </PressableScale>
            </Animated.View>
          </ScreenScroll>
          <BottomBar>
            <Button title="Bekreft" variant="ink" disabled={code.length < OTP_MIN} loading={busy} onPress={() => verify()} />
          </BottomBar>
        </KeyboardAware>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" />
        <ScreenScroll bottomInset={150}>
          <Animated.View entering={FadeIn.duration(260)}>
            <Text variant="title1" accessibilityRole="header">
              Gjør det enklere neste gang
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {BENEFITS.map((b) => (
                <View key={b.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Icon name={b.icon} size={16} color="primary" />
                  <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
                    {b.text}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <View style={{ gap: spacing.xl, marginTop: spacing.xxl }}>
            <Field label="Visningsnavn" visibility="public" hint="Dette er navnet vennene dine ser.">
              <Input value={displayName} onChangeText={setDisplayName} placeholder="Alexander Kristensen" autoCapitalize="words" textContentType="name" autoComplete="name" maxLength={60} accessibilityLabel="Visningsnavn" />
            </Field>
            <Field label="Brukernavn" visibility="public" hint="Brukes for å finne og legge deg til.">
              <UsernameField value={username} onChange={setUsername} displayName={displayName} onValidChange={onValid} />
            </Field>
            <Field label="E-post" visibility="private" hint="Vi sender deg en kode her – ingen passord å huske. Vises aldri for andre.">
              <Input value={email} onChangeText={setEmail} placeholder="navn@epost.no" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" accessibilityLabel="E-post" />
            </Field>
          </View>

          <PressableScale onPress={() => router.replace('/auth')} style={{ alignSelf: 'center', padding: spacing.md, marginTop: spacing.xl }} accessibilityLabel="Logg inn">
            <Text variant="footnote" color="textSecondary">
              Har du allerede en profil? <Text variant="footnote" color="primary">Logg inn</Text>
            </Text>
          </PressableScale>
        </ScreenScroll>
        <BottomBar>
          <Button title="Send kode" variant="ink" disabled={!canSubmit} loading={busy} onPress={submit} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}

function Field({ label, visibility, hint, children }: { label: string; visibility: 'public' | 'private'; hint: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginLeft: 4 }}>
        <Text variant="callout">{label}</Text>
        <Tag label={visibility === 'public' ? 'Synlig for andre' : 'Privat'} tone={visibility === 'public' ? 'neutral' : 'dark'} icon={visibility === 'public' ? 'eye' : 'lock'} />
      </View>
      {children}
      <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs, marginLeft: 4 }}>
        {hint}
      </Text>
    </View>
  );
}

/** "Profil opprettet" — then the two things that make the next invite direct: a friend and the crew. */
function SignedUpView({ token }: { token?: string }) {
  const colors = useColors();
  const me = useMe();
  const setProfile = useSession((s) => s.setProfile);
  const invite = useInvite(token);
  const groups = useGroups();
  const organizerId = invite.data?.organizer.id;
  const organizer = usePublicProfile(organizerId && organizerId !== me?.id ? { userId: organizerId } : null);
  const update = useUpdateProfile();
  const group = invite.data?.groupId ? groups.data?.find((g) => g.id === invite.data?.groupId) : undefined;

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setProfile(await update.mutateAsync({ avatarUri: result.assets[0].uri }));
  };

  return (
    <Screen>
      <Confetti count={28} />
      <ScreenScroll contentContainerStyle={{ paddingTop: spacing.huge }} bottomInset={130}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignSelf: 'center' }}>
          <PressableScale onPress={pickPhoto} accessibilityLabel="Legg til profilbilde">
            <Avatar name={me?.name ?? ''} uri={me?.avatarUrl} size={96} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background }}>
              <Icon name="camera" size={14} tint={colors.textOnInk} />
            </View>
          </PressableScale>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(360)}>
          <Text variant="title1" align="center" style={{ marginTop: spacing.lg }} accessibilityRole="header">
            Profil opprettet
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
            {me?.name} · @{me?.username}
          </Text>
          {token ? (
            <Text variant="footnote" color="textTertiary" align="center" style={{ marginTop: spacing.sm }}>
              Svarene dine er lagret på profilen.
            </Text>
          ) : null}
        </Animated.View>

        <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
          {organizer.data && organizer.data.friendship !== 'friends' ? (
            <Animated.View entering={FadeInDown.delay(250).duration(360)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar name={organizer.data.person.name} uri={organizer.data.person.avatarUrl} size={48} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">Legg til {firstName(organizer.data.person.name)} som venn</Text>
                  <Text variant="footnote" color="textSecondary">
                    Så kan {firstName(organizer.data.person.name)} invitere deg direkte.
                  </Text>
                </View>
                <FriendButton userId={organizer.data.person.id} state={organizer.data.friendship} requestId={organizer.data.requestId} name={firstName(organizer.data.person.name)} />
              </Card>
            </Animated.View>
          ) : null}
          {group ? (
            <Animated.View entering={FadeInDown.delay(320).duration(360)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Icon name="users" size={22} color="primary" />
                <Text variant="callout" style={{ flex: 1 }}>
                  Du er med i {group.name}. Neste gang blir du invitert direkte.
                </Text>
              </Card>
            </Animated.View>
          ) : null}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button title="Ferdig" variant="ink" onPress={() => router.replace('/(tabs)')} />
      </BottomBar>
    </Screen>
  );
}
