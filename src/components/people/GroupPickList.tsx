import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PersonRow } from '@/components/people/PersonRow';
import { AvatarStack, Card, Divider, Icon, PressableScale, SectionHeader, Text } from '@/components/ui';
import type { Group, Person } from '@/data/types';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useColors } from '@/theme';

type Props = {
  groups: Group[];
  meId?: string;
  selectedIds: Set<string> | string[];
  onToggle: (p: Person) => void;
  /** «Hele gjengen»: everyone in it. */
  onSelectAll: (g: Group) => void;
  /** Unselect everyone in the group. */
  onClearAll: (g: Group) => void;
  /** Already invited: shown with a tag, can't be picked again. */
  existingIds?: string[];
  existingLabel?: string;
  /** Leave out guests without an account (they get a personal link another way). */
  accountsOnly?: boolean;
  title?: string;
};

/**
 * Your groups, each one folds out: invite the whole group with one tap, or open it and pick
 * single people – when there isn't room for everyone, or you want just a few from it.
 */
export function GroupPickList({ groups, meId, selectedIds, onToggle, onSelectAll, onClearAll, existingIds = [], existingLabel = 'Invitert', accountsOnly, title = 'Gjengene dine' }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const existing = new Set(existingIds);
  if (!groups.length) return null;

  return (
    <View>
      <SectionHeader title={title} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {groups.map((g, i) => {
          const members = g.members.filter((m) => m.id !== meId && !(accountsOnly && m.isGuest));
          const pickable = members.filter((m) => !existing.has(m.id));
          const picked = pickable.filter((m) => selected.has(m.id)).length;
          const all = pickable.length > 0 && picked === pickable.length;
          const isOpen = open === g.id;
          const name = `${g.emoji ? `${g.emoji} ` : ''}${g.name}`;
          return (
            <View key={g.id}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
                <PressableScale
                  onPress={() => {
                    haptics.light();
                    setOpen(isOpen ? null : g.id);
                  }}
                  scaleTo={0.99}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${name}, ${members.length} personer${picked ? `, ${picked} valgt` : ''}`}
                  accessibilityHint={isOpen ? 'Skjuler medlemmene' : 'Viser medlemmene, så du kan velge enkeltpersoner'}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                >
                  <AvatarStack people={members.slice(0, 3)} size={30} max={3} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="callout" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="footnote" color={picked ? 'primary' : 'textSecondary'} numberOfLines={1}>
                      {picked ? `${picked} av ${pickable.length} valgt` : pickable.length < members.length ? `${pickable.length} ikke invitert ennå` : `${members.length} personer`}
                    </Text>
                  </View>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="textTertiary" />
                </PressableScale>
                {pickable.length ? (
                  <PressableScale
                    onPress={() => {
                      haptics.tap();
                      if (all) onClearAll(g);
                      else onSelectAll(g);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={all ? `Fjern hele ${g.name}` : `Velg hele ${g.name}`}
                  >
                    <AllPill all={all} />
                  </PressableScale>
                ) : null}
              </View>
              {isOpen ? (
                <Animated.View entering={FadeIn.duration(180)} style={{ paddingBottom: spacing.sm }}>
                  {members.map((m) =>
                    existing.has(m.id) ? (
                      <PersonRow key={m.id} person={m} size={36} tag={existingLabel} />
                    ) : (
                      <PersonRow key={m.id} person={m} size={36} selected={selected.has(m.id)} onPress={() => onToggle(m)} />
                    ),
                  )}
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
        Trykk på en gjeng for å velge enkeltpersoner – fint når det ikke er plass til alle.
      </Text>
    </View>
  );
}

function AllPill({ all }: { all: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: all ? colors.primary : colors.primarySoft,
      }}
    >
      {all ? <Icon name="check" size={14} tint="#fff" /> : null}
      <Text variant="footnote" style={{ color: all ? '#fff' : colors.primary, fontWeight: '600' }}>
        {all ? 'Hele' : 'Velg alle'}
      </Text>
    </View>
  );
}
