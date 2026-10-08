import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar, Button, Card, Icon, Input, PressableScale, Text, useToast } from '@/components/ui';
import { useEventMessages, useMarkMessagesSeen, usePostEventMessage } from '@/data/hooks';
import type { EventMessage } from '@/data/types';
import { formatRelative } from '@/lib/dates';
import { firstName } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

const SHOWN = 2;

/**
 * Updates from the organizer, newest first ("Vi møtes ved inngangen"). Only the organizer writes,
 * so it stays a short notice board, not another group chat. Everyone with the app gets a push;
 * the organizer sees how many have seen each one.
 */
export function EventMessages({ eventId, isOrganizer, style }: { eventId: string; isOrganizer: boolean; style?: StyleProp<ViewStyle> }) {
  const toast = useToast();
  const list = useEventMessages(eventId);
  const post = usePostEventMessage(eventId);
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const messages = list.data ?? [];
  useMarkMessagesSeen(eventId, messages[0]?.createdAt);

  if (!messages.length && !isOrganizer) return null;

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await post.mutateAsync(body);
      haptics.success();
      setDraft('');
      toast({ message: 'Beskjeden er sendt til alle', tone: 'success', icon: 'send' });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Kunne ikke sende', tone: 'error' });
    }
  };

  const shown = all ? messages : messages.slice(0, SHOWN);

  return (
    <Card style={style}>
      <Text variant="headline">Beskjeder</Text>
      {isOrganizer ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
          <Input
            placeholder={messages.length ? 'Ny beskjed til alle …' : 'F.eks. «Husk håndkle!» – alle får varsel'}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            containerStyle={{ flex: 1 }}
            style={{ maxHeight: 120 }}
            accessibilityLabel="Ny beskjed til alle"
          />
          <Button title="Send" icon="send" size="md" variant="ink" fullWidth={false} accessibilityLabel="Send beskjed" onPress={send} disabled={!draft.trim()} loading={post.isPending} />
        </View>
      ) : null}
      {shown.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {messages.length > SHOWN ? (
        <PressableScale onPress={() => setAll((v) => !v)} style={{ paddingTop: spacing.md }} accessibilityLabel={all ? 'Vis færre beskjeder' : 'Vis alle beskjeder'}>
          <Text variant="footnote" color="textSecondary">
            {all ? 'Vis færre' : `Vis alle ${messages.length}`}
          </Text>
        </PressableScale>
      ) : null}
    </Card>
  );
}

function Message({ message: m }: { message: EventMessage }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
      <Avatar name={m.author.name} uri={m.author.avatarUrl} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="footnote" color="textSecondary">
          {firstName(m.author.name)} · {formatRelative(m.createdAt)}
        </Text>
        <Text variant="body">{m.body}</Text>
        {m.recipientCount ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }} accessible accessibilityLabel={`Sett av ${m.seenCount ?? 0} av ${m.recipientCount}`}>
            <Icon name="eye" size={13} color="textTertiary" />
            <Text variant="caption" color="textTertiary">
              {m.seenCount === m.recipientCount ? 'Alle har sett den' : `Sett av ${m.seenCount ?? 0} av ${m.recipientCount}`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
