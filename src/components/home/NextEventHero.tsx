import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AvatarStack, PressableScale, Tag, Text } from '@/components/ui';
import type { PlannerEvent } from '@/data/types';
import { activityType } from '@/lib/activities';
import { thumb } from '@/lib/categories';
import { formatLong, formatTime } from '@/lib/dates';
import { countdown } from '@/lib/eventText';
import { radius, shadows, spacing } from '@/theme';

/** The next thing you're going to: the photo, when, what, the theme and who's coming. */
export function NextEventHero({ event: e, onPress }: { event: PlannerEvent; onPress: () => void }) {
  const coming = e.members.filter((m) => m.status === 'attending').map((m) => m.person);
  const when = [e.selectedDate ? formatLong(e.selectedDate) : null, e.startTime ? `kl. ${formatTime(e.startTime)}` : null].filter(Boolean).join(' · ');
  const themeLabel = activityType(e.activityType)?.theme?.label ?? 'Tema';
  const soon = countdown(e.selectedDate);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`Neste avtale: ${e.title}. ${when}${coming.length ? `. ${coming.length} kommer` : ''}`}
      style={[{ height: 240, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#201A17' }, shadows.md]}
    >
      <Image source={{ uri: thumb(e.coverImageUrl, 900) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)', 'rgba(12,10,9,0.5)', 'rgba(12,10,9,0.88)']} locations={[0, 0.3, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="headline" style={{ color: '#fff' }}>
          Neste avtale
        </Text>
        {soon ? <Tag label={soon} tone="glass" /> : null}
      </View>
      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg }}>
        {when ? (
          <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.9)' }} numberOfLines={1}>
            {when}
          </Text>
        ) : null}
        <Text variant="title1" style={{ color: '#fff' }} numberOfLines={2}>
          {e.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
          <Text variant="callout" style={{ color: 'rgba(255,255,255,0.9)', flex: 1 }} numberOfLines={1}>
            {e.activityTheme ? `${themeLabel}: ${e.activityTheme}` : ''}
          </Text>
          {coming.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AvatarStack people={coming} size={24} max={4} />
              <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {coming.length} kommer
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
