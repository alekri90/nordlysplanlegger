import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { StepHeader } from '@/components/create/StepHeader';
import { Icon, PageTitle, PressableScale, Screen, ScreenScroll, Tag, Text, type IconName } from '@/components/ui';
import type { DateMode } from '@/data/types';
import { useCreateDraft } from '@/state/createDraft';
import { radius, shadows, spacing, useColors } from '@/theme';

const OPTIONS: { mode: DateMode; title: string; body: string; icon: IconName; route: '/create/dates' | '/create/fixed' | '/create/who'; recommended?: boolean }[] = [
  { mode: 'poll', title: 'Finn en dato', body: 'Velg noen mulige dager. Gjengen trykker på dagene de ikke kan.', icon: 'users', route: '/create/dates', recommended: true },
  { mode: 'fixed', title: 'Fast dato', body: 'Du vet allerede når det skjer.', icon: 'calendar', route: '/create/fixed' },
  { mode: 'undecided', title: 'Ikke bestemt ennå', body: 'Inviter nå, finn dato senere.', icon: 'clock', route: '/create/who' },
];

/** Step 2 — when? One tap moves on; no extra "Fortsett". */
export default function CreateWhen() {
  const colors = useColors();
  const set = useCreateDraft((s) => s.set);

  return (
    <Screen>
      <StepHeader step={1} />
      <ScreenScroll>
        <PageTitle title="Når passer det?" />
        <View style={{ gap: spacing.md }}>
          {OPTIONS.map((o, i) => (
            <Animated.View key={o.mode} entering={FadeInDown.delay(i * 70).duration(320)}>
              <PressableScale
                onPress={() => {
                  set({ dateMode: o.mode });
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
                    backgroundColor: o.recommended ? colors.ink : colors.surface,
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
                    <Text variant="title3" style={{ color: o.recommended ? colors.textOnInk : colors.text }}>
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
