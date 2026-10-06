import { forwardRef, useState } from 'react';
import { Platform, Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  icon?: IconName;
  error?: string | null;
  clearable?: boolean;
  size?: 'lg' | 'md';
  containerStyle?: StyleProp<ViewStyle>;
};

/** Large, friendly text field. Labels are optional — the screen title usually asks the question. */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, icon, error, clearable, size = 'md', containerStyle, value, onChangeText, onFocus, onBlur, style, ...rest },
  ref,
) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const height = size === 'lg' ? 60 : 52;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: 4 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          minHeight: height,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.text : colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        }}
      >
        {icon ? <Icon name={icon} size={18} color="textTertiary" /> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          accessibilityLabel={label ?? rest.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          maxFontSizeMultiplier={1.4}
          style={[
            {
              flex: 1,
              minHeight: height - 4,
              fontFamily: size === 'lg' ? fonts.semibold : fonts.medium,
              fontSize: size === 'lg' ? 18 : 16,
              color: colors.text,
              paddingVertical: 0,
            },
            // The container already shows focus; drop the browser's second ring on web.
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            style,
          ]}
          {...rest}
        />
        {clearable && value ? (
          <Pressable
            onPress={() => onChangeText?.('')}
            accessibilityRole="button"
            accessibilityLabel="Tøm feltet"
            hitSlop={12}
            style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={13} tint={colors.surface} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="footnote" color="danger" style={{ marginTop: spacing.xs, marginLeft: 4 }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
