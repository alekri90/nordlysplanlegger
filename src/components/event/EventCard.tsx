import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AvatarStack, Icon, PressableScale, Tag, Text } from '@/components/ui';
import type { PlannerEvent } from '@/data/types';
import { thumb } from '@/lib/categories';
import { eventDateLine, eventStatusLine } from '@/lib/eventText';
import { radius, shadows, spacing } from '@/theme';

type Props = {
  event: PlannerEvent;
  meId?: string;
  onPress: () => void;
  /** Emphasize as a pending invitation. */
  invite?: boolean;
};

/** Large visual event card: photo, dark overlay, the one status that matters. */
export function EventCard({ event, meId, onPress, invite }: Props) {
  const status = eventStatusLine(event, meId);
  const attending = event.members.filter((m) => m.status === 'attending' || m.role === 'organizer').map((m) => m.person);
  const dateLine = eventDateLine(event);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}. ${dateLine}. ${status.text}`}
      accessibilityHint={invite ? 'Åpner invitasjonen' : 'Åpner arrangementet'}
      style={[{ height: 136, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#201A17' }, shadows.md]}
    >
      <Image source={{ uri: thumb(event.coverImageUrl, 700) }} style={[StyleSheet.absoluteFill, { right: '38%' }]} contentFit="cover" transition={200} />
      <LinearGradient
        colors={['rgba(24,19,17,0)', 'rgba(24,19,17,0.85)', '#181311']}
        locations={[0, 0.42, 0.62]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', left: '42%', right: spacing.lg, top: 0, bottom: 0, justifyContent: 'center', gap: 5 }}>
        <Text variant="headline" style={{ color: '#fff' }} numberOfLines={2}>
          {event.title}
        </Text>
        <Meta icon="calendar" text={dateLine} />
        {invite ? (
          <Meta icon="user" text={`Fra ${event.organizer.name.split(' ')[0]}`} />
        ) : event.status === 'polling' || event.status === 'draft' ? (
          <Meta icon={status.tone === 'success' ? 'check-circle' : 'clock'} text={status.text} highlight={status.tone !== 'neutral'} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <AvatarStack people={attending} size={22} max={4} />
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {status.text}
            </Text>
          </View>
        )}
      </View>
      {invite ? (
        <View style={{ position: 'absolute', top: spacing.md, left: spacing.md }}>
          <Tag label="Svar nå" tone="primary" icon="bell" />
        </View>
      ) : null}
    </PressableScale>
  );
}

function Meta({ icon, text, highlight }: { icon: 'calendar' | 'clock' | 'user' | 'check-circle'; text: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={13} tint={highlight ? '#FF9AA2' : 'rgba(255,255,255,0.75)'} />
      <Text variant="footnote" style={{ color: highlight ? '#FFC2C7' : 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
