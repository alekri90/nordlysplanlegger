import { router } from 'expo-router';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Icon, PressableScale, Tag, Text, type IconName } from '@/components/ui';
import type { EventActivityRole } from '@/data/types';
import { roleActivity } from '@/lib/activities';
import type { ColorTokens } from '@/theme/tokens';
import { radius, spacing } from '@/theme';

/** Whether an event with a role (Aufguss) is still provisional: nobody has confirmed the role yet. */
export const isProvisional = (role: EventActivityRole | null | undefined) => !!role && role.status !== 'confirmed' && role.status !== 'cancelled';

export type RolePill = { icon: IconName; label: string; tone: 'ok' | 'wait' | 'act' | 'stop' };

/** The role in a few words, for the photo on the event page: who has it, or what it waits for. */
export function rolePill(activity: string | null | undefined, role: EventActivityRole | null | undefined, isOrganizer: boolean): RolePill | null {
  const type = roleActivity(activity);
  if (!type || !role) return null;
  const { label, lower, definite } = type.role;
  if (role.mine) return { icon: 'award', label: `Du er ${lower}`, tone: 'ok' };
  switch (role.status) {
    case 'confirmed':
      return { icon: 'award', label: `${label}: ${role.name ?? ''}`.trim(), tone: 'ok' };
    case 'choose':
      return isOrganizer ? { icon: 'user-check', label: `Velg ${lower}`, tone: 'act' } : { icon: 'clock', label: `Foreløpig – ${lower} ikke valgt`, tone: 'wait' };
    case 'unavailable':
      return isOrganizer ? { icon: 'alert-circle', label: `Ingen ${lower} kan`, tone: 'stop' } : { icon: 'clock', label: `Foreløpig – mangler ${lower}`, tone: 'wait' };
    case 'partly': {
      const n = role.dates.filter((d) => d.status === 'confirmed').length;
      return { icon: 'calendar', label: `${label} for ${n} av ${role.dates.length} datoer`, tone: 'wait' };
    }
    case 'cancelled':
      return null;
    default:
      return { icon: 'clock', label: `Foreløpig – venter på ${definite}`, tone: 'wait' };
  }
}

/** The icon on the photo: mint when it's settled, amber while waiting, coral to act, red when stuck. */
const PILL_TINT: Record<RolePill['tone'], string> = { ok: '#8EE3B0', wait: '#FFC870', act: '#FF9A8B', stop: '#FF8A80' };

/** The role as a glass pill on the photo, high up: «Badstumester: Kari». The organizer taps it for the request. */
export function RoleBadge({ pill, onPress, style }: { pill: RolePill; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={pill.label}
      accessibilityHint={onPress ? 'Åpner forespørselen' : undefined}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingVertical: 7, paddingLeft: spacing.md, paddingRight: onPress ? spacing.sm : spacing.md, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
        style,
      ]}
    >
      <Icon name={pill.icon} size={16} tint={PILL_TINT[pill.tone]} />
      <Text variant="subhead" style={{ color: '#fff', flexShrink: 1 }} numberOfLines={1}>
        {pill.label}
      </Text>
      {onPress ? <Icon name="chevron-right" size={14} tint="rgba(255,255,255,0.6)" /> : null}
    </PressableScale>
  );
}

/**
 * The role on an event (the sauna master), shown apart from the participants: who has it, or that
 * the event is provisional until someone confirms. The organizer opens the request from here.
 */
export function ActivityRoleCard({ activity, role, isOrganizer, style }: { activity: string | null | undefined; role: EventActivityRole | null | undefined; isOrganizer: boolean; style?: object }) {
  const type = roleActivity(activity);
  if (!type || !role) return null;
  const label = type.role.label;
  const lower = type.role.lower;
  const confirmedDates = role.dates.filter((d) => d.status === 'confirmed').length;

  let icon: IconName = 'clock';
  let color: keyof ColorTokens = 'textSecondary';
  let title = `Foreløpig – venter på ${type.role.definite}`;
  let body = isOrganizer ? `Deltagerne ser at arrangementet ikke er bekreftet ennå.` : `${label} har ikke bekreftet ennå. Du får beskjed når det er klart.`;
  if (isOrganizer && role.hold) title = `Venter på ${type.role.definite}`;
  if (isOrganizer && role.hold) body =`Inviter senere: ingen er invitert. Når ${type.role.definite} sier ja, får du beskjed og kan invitere.`;
  if (role.mine) {
    return (
      <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>
        <Icon name="award" size={20} color="success" />
        <Text variant="headline" style={{ flex: 1 }}>
          Du er {lower}
        </Text>
      </Card>
    );
  }
  const held = isOrganizer && role.hold;
  switch (role.status) {
    case 'confirmed':
      icon = 'award';
      color = 'success';
      title = `${label}: ${role.name ?? ''}`.trim();
      // Just the whole name: «Badstumester: Lorna Hansen».
      body = '';
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
          {held && role.status !== 'confirmed' ? <Tag label="Ikke invitert" /> : isProvisional(role) ? <Tag label="Foreløpig" /> : null}
        </View>
        {body ? (
          <Text variant="footnote" color="textSecondary">
            {body}
          </Text>
        ) : null}
      </View>
      {isOrganizer && role.requestId ? <Icon name="chevron-right" size={18} color="textTertiary" /> : null}
    </Card>
  );
  if (!isOrganizer || !role.requestId) return content;
  return (
    <PressableScale onPress={() => router.push({ pathname: '/rolle/[id]', params: { id: role.requestId! } })} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={body ? `${title}. ${body}` : title}>
      {content}
    </PressableScale>
  );
}
