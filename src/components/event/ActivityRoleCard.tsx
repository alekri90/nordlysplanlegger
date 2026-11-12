import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Icon, PressableScale, Tag, Text, type IconName } from '@/components/ui';
import type { EventActivityRole } from '@/data/types';
import { activityType } from '@/lib/activities';
import type { ColorTokens } from '@/theme/tokens';
import { spacing } from '@/theme';

/** Whether an event with a role (Aufguss) is still provisional: nobody has confirmed the role yet. */
export const isProvisional = (role: EventActivityRole | null | undefined) => !!role && role.status !== 'confirmed' && role.status !== 'cancelled';

/**
 * The role on an event (the sauna master), shown apart from the participants: who has it, or that
 * the event is provisional until someone confirms. The organizer opens the request from here.
 */
export function ActivityRoleCard({ activity, role, isOrganizer, style }: { activity: string | null | undefined; role: EventActivityRole | null | undefined; isOrganizer: boolean; style?: object }) {
  const type = activityType(activity);
  if (!type || !role) return null;
  const label = type.role.label;
  const lower = type.role.lower;
  const confirmedDates = role.dates.filter((d) => d.status === 'confirmed').length;

  let icon: IconName = 'clock';
  let color: keyof ColorTokens = 'textSecondary';
  let title = `Foreløpig – venter på ${type.role.definite}`;
  let body = isOrganizer ? `Deltagerne ser at arrangementet ikke er bekreftet ennå.` : `${label} har ikke bekreftet ennå. Du får beskjed når det er klart.`;
  switch (role.status) {
    case 'confirmed':
      icon = 'award';
      color = 'success';
      title = `${label}: ${role.name ?? ''}`.trim();
      body = `Bekreftet · bruker ingen deltagerplass og deler ikke kostnaden`;
      break;
    case 'choose':
      icon = 'user-check';
      color = 'primary';
      title = isOrganizer ? `Velg ${lower}` : `Foreløpig – ${lower} er ikke valgt ennå`;
      body = isOrganizer ? 'Noen har sagt at de kan. Velg hvem som får rollen.' : 'Du får beskjed når det er bekreftet.';
      break;
    case 'unavailable':
      icon = 'alert-circle';
      color = 'danger';
      title = isOrganizer ? `Ingen ${lower} kan` : `Foreløpig – mangler ${lower}`;
      body = isOrganizer ? 'Spør en annen, flytt eller avlys datoen.' : 'Arrangøren finner en løsning eller avlyser.';
      break;
    case 'partly':
      icon = 'calendar';
      color = 'textSecondary';
      title = `${label} bekreftet for ${confirmedDates} av ${role.dates.length} datoer`;
      body = isOrganizer ? `Velg en av de bekreftede datoene når du låser datoen.` : 'Arrangøren velger datoen.';
      break;
    case 'cancelled':
      return null;
  }

  const content = (
    <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>
      <Icon name={icon} size={20} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text variant="headline">{title}</Text>
          {isProvisional(role) ? <Tag label="Foreløpig" /> : null}
        </View>
        <Text variant="footnote" color="textSecondary">
          {body}
        </Text>
      </View>
      {isOrganizer && role.requestId ? <Icon name="chevron-right" size={18} color="textTertiary" /> : null}
    </Card>
  );
  if (!isOrganizer || !role.requestId) return content;
  return (
    <PressableScale onPress={() => router.push({ pathname: '/rolle/[id]', params: { id: role.requestId! } })} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`}>
      {content}
    </PressableScale>
  );
}
