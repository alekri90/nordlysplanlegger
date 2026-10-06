import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/brand/AppLogo';
import { Avatar, AvatarStack, Button, EmptyState, IconButton, Skeleton, Text, useToast } from '@/components/ui';
import { useGroupInvite, useJoinGroup } from '@/data/hooks';
import type { GroupInviteView } from '@/data/types';
import { haptics } from '@/lib/haptics';
import { setPendingGroupJoin } from '@/lib/pendingJoin';
import { useSession } from '@/state/session';
import { gutter, spacing } from '@/theme';

const INK = '#16120F';

/**
 * A group invite link (/g/<token>). Shows who invited you and who's in it; joining needs an
 * account (e-mail code, no password). Works in the app and as a mobile web page.
 */
export default function GroupInvitation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const invite = useGroupInvite(token);
  const insets = useSafeAreaInsets();

  if (invite.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: INK }}>
        <Skeleton height={420} rounded={0} style={{ opacity: 0.15 }} />
      </View>
    );
  }
  if (!invite.data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FBF8F6', paddingTop: insets.top + spacing.huge }}>
        <EmptyState icon="link-2" title="Lenken virker ikke lenger" body="Spør den som inviterte deg om en ny lenke." />
      </View>
    );
  }
  return <GroupInvitationView invite={invite.data} />;
}

function GroupInvitationView({ invite }: { invite: GroupInviteView }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const join = useJoinGroup();
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => !!s.profile?.onboarded);
  const g = invite.group;
  const others = invite.memberCount - 1;

  const onJoin = async () => {
    if (invite.isMember) {
      router.replace(`/group/${g.id}`);
      return;
    }
    if (status !== 'signedIn' || !onboarded) {
      // Finished at the root once they're signed in and have a name (lib/pendingJoin).
      await setPendingGroupJoin(invite.token);
      if (status !== 'signedIn') router.push('/auth');
      return;
    }
    try {
      const groupId = await join.mutateAsync(invite.token);
      haptics.success();
      toast({ message: `Du er med i ${g.name} 🎉`, tone: 'success' });
      router.replace(`/group/${groupId}`);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke bli med', tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK }}>
      <StatusBar style="light" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ minHeight: height, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }}>
        <View style={{ height: Math.max(380, height * 0.56) }}>
          <Image source={{ uri: g.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={['rgba(22,18,15,0.45)', 'rgba(22,18,15,0)', 'rgba(22,18,15,0.6)', INK]} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', top: insets.top + spacing.xs, left: gutter - 8, right: gutter - 8, flexDirection: 'row' }}>
            {router.canGoBack() ? <IconButton icon="chevron-left" variant="glass" accessibilityLabel="Tilbake" onPress={() => router.back()} /> : <AppLogo size={36} />}
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={{ position: 'absolute', left: gutter, right: gutter, bottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Avatar name={invite.inviter.name} uri={invite.inviter.avatarUrl} size={28} />
              <Text variant="callout" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {invite.inviter.name} inviterer deg til
              </Text>
            </View>
            <Text variant="display" style={{ color: '#fff' }} accessibilityRole="header">
              {g.emoji ? `${g.emoji} ` : ''}
              {g.name}
            </Text>
            {g.description ? (
              <Text variant="body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }} numberOfLines={3}>
                {g.description}
              </Text>
            ) : null}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(450)} style={{ paddingHorizontal: gutter }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, justifyContent: 'center' }}>
            <AvatarStack people={invite.members} size={30} max={6} />
            <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {others > 0 ? `${invite.inviter.name} og ${others} ${others === 1 ? 'annen' : 'andre'} er med` : `${invite.inviter.name} er med`}
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Button
              title={invite.isMember ? 'Åpne gjengen' : `Bli med i ${g.name}`}
              icon={invite.isMember ? undefined : 'user-plus'}
              loading={join.isPending}
              onPress={onJoin}
            />
            {!invite.isMember ? (
              <Text variant="footnote" align="center" style={{ color: 'rgba(255,255,255,0.65)', marginTop: spacing.xs }}>
                {status === 'signedIn' ? 'Gjengen dukker opp i appen din med en gang.' : 'Logg inn med e-post – du får en kode, ingen passord.'}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
