import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Avatar, Icon, PressableScale, Tag, Text } from '@/components/ui';
import type { Person } from '@/data/types';
import { spacing, useColors } from '@/theme';

type Props = {
  person: Person;
  /** Secondary line under @username, e.g. "3 felles venner" or "Dere var sammen på Kortkveld". */
  detail?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
  /** Multi-select mode: a big checkbox, the whole row toggles. */
  selected?: boolean;
  tag?: string;
  size?: number;
};

/** Big avatar, clear name, @username in secondary text. The building block of every people list. */
export function PersonRow({ person, detail, onPress, trailing, selected, tag, size = 48 }: Props) {
  const colors = useColors();
  const selectable = selected !== undefined;
  const sub = [person.username ? `@${person.username}` : person.isGuest ? 'Uten konto ennå' : null, detail].filter(Boolean).join(' · ');

  const identity = (
    <>
      <Avatar name={person.name} uri={person.avatarUrl} size={size} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {person.name}
          </Text>
          {tag ? <Tag label={tag} /> : null}
        </View>
        {sub ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </>
  );

  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, paddingVertical: spacing.sm, minHeight: 64 };
  const label = `${person.name}${person.username ? `, @${person.username}` : ''}${detail ? `, ${detail}` : ''}`;

  // Tappable identity + separate action (never a button inside a button).
  if (onPress && trailing && !selectable) {
    return (
      <View style={style}>
        <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {identity}
        </PressableScale>
        {trailing}
      </View>
    );
  }

  const body = (
    <>
      {identity}
      {trailing}
      {selectable ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            borderWidth: selected ? 0 : 1.5,
            borderColor: colors.borderStrong,
            backgroundColor: selected ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <Icon name="check" size={16} tint="#fff" /> : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={style} accessible={!trailing} accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      style={style}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: !!selected } : undefined}
      accessibilityLabel={label}
    >
      {body}
    </PressableScale>
  );
}
