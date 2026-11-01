import { View } from 'react-native';

import { PersonRow } from '@/components/people/PersonRow';
import { Button, Card, Divider, Text } from '@/components/ui';
import type { GuestInvite } from '@/data/types';
import { inviteUrl } from '@/lib/config';
import { inviteMessage, shareTo } from '@/lib/share';
import { spacing } from '@/theme';
import { firstName } from '@/lib/eventText';

/** Those without an account: one link each, with their name filled in when they open it. */
export function PersonalLinks({ guests, title, organizerName }: { guests: GuestInvite[]; title: string; organizerName?: string }) {
  return (
    <View>
      <Text variant="title3">Personlige lenker</Text>
      <Text variant="footnote" color="textSecondary" style={{ marginTop: 2, marginBottom: spacing.md }}>
        Til dem uten konto. Navnet deres er fylt inn når de åpner lenken.
      </Text>
      <Card style={{ paddingVertical: spacing.xs }}>
        {guests.map((g, i) => (
          <View key={g.guestId}>
            {i ? <Divider /> : null}
            <PersonRow
              person={{ id: g.guestId, name: g.name, isGuest: true }}
              size={40}
              trailing={
                <Button
                  title="Send"
                  size="sm"
                  variant="ink"
                  icon="send"
                  accessibilityLabel={`Send personlig lenke til ${g.name}`}
                  onPress={() => {
                    const url = inviteUrl(g.token);
                    shareTo('more', { url, title, message: inviteMessage(title, url, organizerName, firstName(g.name)) });
                  }}
                />
              }
            />
          </View>
        ))}
      </Card>
    </View>
  );
}
