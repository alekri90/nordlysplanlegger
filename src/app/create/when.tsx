import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ACTIVITY_STEPS, StepHeader } from '@/components/create/StepHeader';
import { Icon, PageTitle, PressableScale, Screen, ScreenScroll, Tag, Text, type IconName } from '@/components/ui';
import type { DateMode } from '@/data/types';
import { activityType } from '@/lib/activities';
import { useCreateDraft } from '@/state/createDraft';
import { radius, shadows, spacing, useColors } from '@/theme';

type Option = { id: string; mode: DateMode; title: string; body: string; icon: IconName; route: '/create/dates' | '/create/fixed' | '/create/who' | '/create/spontaneous'; recommended?: boolean; activityMode?: 'each' | 'poll' };

const OPTIONS: Option[] = [
  { id: 'poll', mode: 'poll', title: 'Finn en dato', body: 'Velg noen mulige dager. Gjengen trykker på dagene de ikke kan.', icon: 'users', route: '/create/dates', recommended: true },
  { id: 'fixed', mode: 'fixed', title: 'Fast dato', body: 'Du vet allerede når det skjer.', icon: 'calendar', route: '/create/fixed' },
  { id: 'undecided', mode: 'undecided', title: 'Ikke bestemt ennå', body: 'Inviter nå, finn dato senere.', icon: 'clock', route: '/create/who' },
  { id: 'spontaneous', mode: 'fixed', title: 'Spontant', body: 'I dag eller i morgen – hvem er gira?', icon: 'zap', route: '/create/spontaneous' },
  { id: 'clearance', mode: 'poll', title: 'Avklar med noen først', body: 'Foreslå dager til én person, f.eks. badstumesteren. Gjengen inviteres når hen har svart.', icon: 'user-check', route: '/create/dates' },
];

/**
 * An activity type (Aufguss): the dates are requests until the role (sauna master) has said yes,
 * so the choice is between separate events and alternative dates for one.
 */
const activityOptions = (role: string): Option[] => [
  { id: 'each', mode: 'poll', activityMode: 'each', title: 'Flere datoer – hver blir et eget arrangement', body: `F.eks. alle tirsdager og torsdager. ${role} svarer per dato, og hver dato kan bli noe av for seg.`, icon: 'layers', route: '/create/dates', recommended: true },
  { id: 'poll', mode: 'poll', activityMode: 'poll', title: 'Alternative datoer for ett arrangement', body: `Ett arrangement. ${role} og gjengen svarer på datoene, og du velger én.`, icon: 'users', route: '/create/dates' },
  { id: 'fixed', mode: 'fixed', activityMode: 'each', title: 'Én dato', body: 'Du vet hvilken dag det gjelder.', icon: 'calendar', route: '/create/fixed' },
];

/** Step 2 — when? One tap moves on; no extra "Fortsett". */
export default function CreateWhen() {
  const colors = useColors();
  const set = useCreateDraft((s) => s.set);
  const type = activityType(useCreateDraft((s) => s.activityType));
  const options = type ? activityOptions(type.role.label) : OPTIONS;

  return (
    <Screen>
      <StepHeader step={1} total={type ? ACTIVITY_STEPS : undefined} />
      <ScreenScroll>
        <PageTitle title="Når passer det?" subtitle={type ? `Datoene er forespørsler til ${type.role.lower} har sagt ja.` : undefined} />
        <View style={{ gap: spacing.md }}>
          {options.map((o, i) => (
            <Animated.View key={o.id} entering={FadeInDown.delay(i * 70).duration(320)}>
              <PressableScale
                onPress={() => {
                  set(
                    type
                      ? { dateMode: o.mode, activityMode: o.activityMode ?? 'each', spontaneous: false, clearance: false }
                      : { dateMode: o.mode, spontaneous: o.id === 'spontaneous', clearance: o.id === 'clearance' },
                  );
                  router.push(o.route);
                }}
                scaleTo={0.98}
                accessibilityLabel={`${o.title}. ${o.body}${o.recommended ? ' Anbefalt.' : ''}`}
                style={[
                  {
                    flexDirection: 'row',
                    gap: spacing.lg,
                    alignItems: 'center',
                    padding: spacing.xl,
                    borderRadius: radius.lg,
                    backgroundColor: o.recommended ? colors.feature : colors.surface,
                    borderWidth: o.recommended ? 0 : 1,
                    borderColor: colors.border,
                  },
                  o.recommended ? shadows.lg : shadows.sm,
                ]}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: o.recommended ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={o.icon} size={22} tint={o.recommended ? '#fff' : colors.text} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="title3" style={{ color: o.recommended ? colors.textOnFeature : colors.text }}>
                      {o.title}
                    </Text>
                    {o.recommended ? <Tag label="Anbefalt" tone="glass" /> : null}
                  </View>
                  <Text variant="subhead" style={{ color: o.recommended ? 'rgba(255,255,255,0.75)' : colors.textSecondary }}>
                    {o.body}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} tint={o.recommended ? 'rgba(255,255,255,0.6)' : colors.textTertiary} />
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
