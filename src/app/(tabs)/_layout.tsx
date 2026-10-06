import { Redirect, router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useCreateDraft } from '@/state/createDraft';
import { useSession } from '@/state/session';
import { shadows, spacing, useColors } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Hjem', icon: 'home' },
  groups: { label: 'Gjenger', icon: 'users' },
  profile: { label: 'Profil', icon: 'user' },
};

export default function TabsLayout() {
  const status = useSession((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'fade' }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

/** Hjem · [ + ] · Gjenger · Profil — the create button is always one thumb away. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reset = useCreateDraft((s) => s.reset);

  const item = (index: number) => {
    const route = state.routes[index];
    const meta = TABS[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    return (
      <PressableScale
        key={route.key}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        scaleTo={0.9}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 }}
      >
        <Icon name={meta.icon} size={22} color={focused ? 'primary' : 'textTertiary'} />
        <Text variant="caption" color={focused ? 'primary' : 'textTertiary'} maxFontSizeMultiplier={1.2}>
          {meta.label}
        </Text>
      </PressableScale>
    );
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      {item(0)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <PressableScale
          onPress={() => {
            reset();
            router.push('/create');
          }}
          haptic="medium"
          scaleTo={0.9}
          accessibilityLabel="Lag noe"
          accessibilityHint="Lag et nytt arrangement"
          style={[{ width: 58, height: 58, borderRadius: 29, marginTop: -26 }, shadows.primary]}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.background }}
          >
            <Icon name="plus" size={26} tint="#FFFFFF" />
          </LinearGradient>
        </PressableScale>
      </View>
      {item(1)}
      {item(2)}
    </View>
  );
}
