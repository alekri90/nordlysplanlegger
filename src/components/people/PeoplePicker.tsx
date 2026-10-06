import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Icon, Input, PressableScale, SectionHeader, Text } from '@/components/ui';
import { useFriends, useRecentPeople, useSearchPeople } from '@/data/hooks';
import type { Person } from '@/data/types';
import { spacing, useColors } from '@/theme';
import { PersonRow } from './PersonRow';

type Props = {
  selectedIds: string[];
  onToggle: (person: Person) => void;
  /** Already in the group / event — shown as members, not selectable. */
  existingIds?: string[];
  /** Names of people without an account to add as guests. */
  guestNames?: string[];
  onGuestNamesChange?: (names: string[]) => void;
  /** Extra section rendered first (e.g. group guests, "Du inviterer vanligvis"). */
  header?: React.ReactNode;
  recentLimit?: number;
  /** Tag shown on people in `existingIds`. */
  existingLabel?: string;
};

/**
 * Find and select people: search by name or @username, then recent, then friends.
 * Big tappable rows, multi-select. People without an account can be added by name.
 */
export function PeoplePicker({ selectedIds, onToggle, existingIds = [], guestNames, onGuestNamesChange, header, recentLimit = 5, existingLabel = 'Med' }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [guestDraft, setGuestDraft] = useState('');
  const friends = useFriends();
  const recent = useRecentPeople();
  const search = useSearchPeople(query);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const searching = query.trim().replace(/^@/, '').length >= 2;

  const friendIds = useMemo(() => new Set((friends.data ?? []).map((f) => f.id)), [friends.data]);
  const recentList = (recent.data ?? []).slice(0, recentLimit);
  // Friends not already shown under "Nylig".
  const recentIds = new Set(recentList.map((p) => p.id));
  const friendList = (friends.data ?? []).filter((f) => !recentIds.has(f.id));

  const row = (p: Person, detail?: string | null) =>
    existing.has(p.id) ? (
      <PersonRow key={p.id} person={p} detail={detail} tag={existingLabel} />
    ) : (
      <PersonRow key={p.id} person={p} detail={detail} selected={selected.has(p.id)} onPress={() => onToggle(p)} />
    );

  const addGuest = () => {
    const name = guestDraft.trim();
    if (!name || !onGuestNamesChange) return;
    onGuestNamesChange([...(guestNames ?? []), name]);
    setGuestDraft('');
  };

  return (
    <View>
      <Input icon="search" placeholder="Søk etter navn eller @brukernavn" value={query} onChangeText={setQuery} clearable autoCapitalize="none" autoCorrect={false} />

      {header && !searching ? <View style={{ marginTop: spacing.lg }}>{header}</View> : null}

      {searching ? (
        <View style={{ marginTop: spacing.lg }}>
          {(search.data ?? []).map((p) =>
            row(p, friendIds.has(p.id) ? 'Venn' : p.mutualFriends ? `${p.mutualFriends} felles venner` : null),
          )}
          {search.data && !search.data.length ? (
            <Text variant="subhead" color="textSecondary" style={{ paddingVertical: spacing.lg }}>
              Fant ingen med det navnet. Du kan legge til personen uten konto nedenfor.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          {recentList.length ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Nylig" />
              {recentList.map((p) => row(p))}
            </View>
          ) : null}
          {friendList.length ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Venner" />
              {friendList.map((p) => row(p))}
            </View>
          ) : null}
        </>
      )}

      {onGuestNamesChange ? (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Uten konto" />
          {(guestNames ?? []).map((name, i) => (
            <View key={`${name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60 }}>
              <Avatar name={name} size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{name}</Text>
                <Text variant="footnote" color="textSecondary">
                  Får en personlig lenke
                </Text>
              </View>
              <PressableScale
                onPress={() => onGuestNamesChange((guestNames ?? []).filter((_, j) => j !== i))}
                accessibilityLabel={`Fjern ${name}`}
                hitSlop={10}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={16} />
              </PressableScale>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm }}>
            <Input
              placeholder="Navn, f.eks. Marius"
              value={guestDraft}
              onChangeText={setGuestDraft}
              onSubmitEditing={addGuest}
              returnKeyType="done"
              autoCapitalize="words"
              containerStyle={{ flex: 1 }}
              accessibilityLabel="Legg til person uten konto"
            />
            <Button title="Legg til" size="sm" variant="secondary" icon="plus" disabled={!guestDraft.trim()} onPress={addGuest} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
