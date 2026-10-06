import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { ShareGrid, SNAP_YELLOW, useShareTo } from '@/components/event/ShareSheet';
import { Button, Card, PressableScale, Sheet, Text } from '@/components/ui';
import { useGroupInviteToken } from '@/data/hooks';
import type { Group } from '@/data/types';
import { groupInviteUrl } from '@/lib/config';
import { firstName } from '@/lib/eventText';
import { groupInviteMessage } from '@/lib/share';
import { useMe } from '@/state/session';
import { radius, spacing } from '@/theme';

/**
 * Invite people into the group with your own link: Snapchat first, then any other app.
 * Whoever opens the link sees the group and joins with an account.
 */
export function GroupInviteCard({ group, style }: { group: Pick<Group, 'id' | 'name'>; style?: StyleProp<ViewStyle> }) {
  const me = useMe();
  const token = useGroupInviteToken(group.id);
  const share = useShareTo();
  const [moreOpen, setMoreOpen] = useState(false);

  const url = token.data ? groupInviteUrl(token.data) : null;
  const content = url ? { url, title: group.name, message: groupInviteMessage(group.name, url, me ? firstName(me.name) : undefined) } : null;

  return (
    <Card style={style}>
      <Text variant="headline">Inviter til {group.name}</Text>
      <Text variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
        Send lenken – de lager en konto på et halvt minutt og er med.
      </Text>

      <PressableScale
        onPress={() => content && share('snapchat', content)}
        disabled={!content}
        accessibilityRole="button"
        accessibilityLabel="Inviter på Snapchat"
        style={{
          marginTop: spacing.lg,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: SNAP_YELLOW,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: content ? 1 : 0.6,
        }}
      >
        {content ? <FontAwesome name="snapchat-ghost" size={20} color="#16120F" /> : <ActivityIndicator color="#16120F" />}
        <Text variant="headline" style={{ color: '#16120F' }}>
          Inviter på Snapchat
        </Text>
      </PressableScale>
      <View style={{ marginTop: spacing.sm }}>
        <Button title="Send på andre måter" variant="secondary" size="md" icon="share" disabled={!content} onPress={() => setMoreOpen(true)} />
      </View>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={`Inviter til ${group.name}`} subtitle="Teksten og lenken er ferdig skrevet.">
        {content ? <ShareGrid {...content} onDone={() => setMoreOpen(false)} /> : null}
      </Sheet>
    </Card>
  );
}
