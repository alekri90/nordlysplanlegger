import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, radius, shadows, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ToastTone = 'default' | 'success' | 'error';
type ToastInput = { message: string; tone?: ToastTone; icon?: IconName };
type ToastState = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput | string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((input: ToastInput | string) => {
    const t = typeof input === 'string' ? { message: input } : input;
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    AccessibilityInfo.announceForAccessibility(t.message);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const icon: IconName = toast?.icon ?? (toast?.tone === 'error' ? 'alert-circle' : toast?.tone === 'success' ? 'check-circle' : 'info');

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + spacing.sm, left: gutter, right: gutter, alignItems: 'center' }}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.springify().damping(18)}
            exiting={FadeOutUp.duration(180)}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.ink,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.pill,
                maxWidth: 480,
              },
              shadows.lg,
            ]}
          >
            <Icon name={icon} size={18} tint={toast.tone === 'error' ? '#FF9AA2' : toast.tone === 'success' ? '#7EE2B0' : colors.textOnInk} />
            <Text variant="callout" style={{ color: colors.textOnInk, flexShrink: 1 }}>
              {toast.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
