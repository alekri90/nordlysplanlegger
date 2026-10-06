import type { ReactNode } from 'react';
import { Switch as RNSwitch, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  selected?: boolean;
  /** Renders a radio indicator; selection is announced to screen readers. */
  radio?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/** Generic tappable row: settings, people, groups, options. */
export function ListRow({ title, subtitle, icon, leading, trailing, onPress, chevron, destructive, selected, radio, style, accessibilityHint }: Props) {
  const colors = useColors();
  const content = (
    <>
      {leading ??
        (icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: destructive ? colors.dangerSoft : colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={18} color={destructive ? 'danger' : 'text'} />
          </View>
        ) : null)}
      <View style={{ flex: 1 }}>
        <Text variant="callout" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {radio ? <Radio selected={!!selected} /> : null}
      {chevron ? <Icon name="chevron-right" size={18} color="textTertiary" /> : null}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }, style];

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      style={rowStyle}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: !!selected } : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </PressableScale>
  );
}

export function Radio({ selected }: { selected: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: selected ? 0 : 1.5,
        borderColor: colors.borderStrong,
        backgroundColor: selected ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon name="check" size={14} tint="#fff" /> : null}
    </View>
  );
}

export function Toggle({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string }) {
  const colors = useColors();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.borderStrong, true: colors.primary }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.borderStrong}
    />
  );
}
