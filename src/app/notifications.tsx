import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar, EmptyState, ErrorState, EventListSkeleton, Header, Icon, PressableScale, Screen, Text, type IconName } from '@/components/ui';
import { useMarkNotificationsRead, useNotifications } from '@/data/hooks';
import type { AppNotification } from '@/data/types';
import { formatRelative } from '@/lib/dates';
import { gutter, radius, spacing, useColors } from '@/theme';

const ICONS: Record<AppNotification['type'], IconName> = {
  invited: 'mail',
  response_received: 'user-check',
  reminder_respond: 'clock',
  all_can: 'star',
  date_locked: 'lock',
  event_updated: 'edit-2',
  event_reminder: 'bell',
  group_nudge: 'refresh-cw',
  event_cancelled: 'x-circle',
  friend_request: 'user-plus',
  friend_accepted: 'user-check',
  group_added: 'users',
  event_message: 'message-square',
};

export default function Notifications() {
  const colors = useColors();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Mark as read when leaving, so the unread dots are visible while reading.
  useEffect(() => () => markRead.mutate(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <Header title="Varsler" />
      {notifications.isError ? (
        <ErrorState onRetry={() => notifications.refetch()} />
      ) : notifications.isLoading ? (
        <View style={{ padding: gutter }}>
          <EventListSkeleton count={3} />
        </View>
      ) : (
        <FlatList
          data={notifications.data}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge, gap: spacing.xs }}
          ListEmptyComponent={<EmptyState icon="bell" title="Ingen varsler" body="Når noen svarer eller en dato blir låst, ser du det her." />}
          renderItem={({ item, index }) => {
            const unread = !item.readAt;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
                <PressableScale
                  onPress={() => item.url && router.push(item.url as never)}
                  scaleTo={0.985}
                  accessibilityLabel={`${unread ? 'Ny: ' : ''}${item.title}. ${item.body ?? ''}`}
                  style={{
                    flexDirection: 'row',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: unread ? colors.surface : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  {item.actor ? (
                    <Avatar name={item.actor.name} uri={item.actor.avatarUrl} size={44} />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={ICONS[item.type]} size={18} color="primary" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant={unread ? 'headline' : 'callout'}>{item.title}</Text>
                    <Text variant="footnote" color="textSecondary">
                      {[item.body, formatRelative(item.createdAt)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }} accessibilityElementsHidden /> : null}
                </PressableScale>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}
