import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CoverPicker } from '@/components/create/CoverPicker';
import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Divider, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Sheet, Text } from '@/components/ui';
import { useEvents } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { coverOptionsFor, defaultCoverFor, thumb } from '@/lib/categories';
import { formatLong, today } from '@/lib/dates';
import { eventDateLine } from '@/lib/eventText';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { radius, spacing, useColors } from '@/theme';

/**
 * Step 1 — what are we doing. One big field; inspiration and «Gjenta» are a tap away, and four
 * pictures that fit the name (the rest behind «Se flere bilder»).
 */
export default function CreateWhat() {
  const colors = useColors();
  const draft = useCreateDraft();
  const me = useMe();
  const valid = draft.title.trim().length > 0;

  // «Gjenta et tidligere arrangement»: same picture, place and people as last time.
  const events = useEvents();
  const earlier = useMemo(() => earlierPlans(events.data ?? [], me?.id), [events.data, me?.id]);
  const [againOpen, setAgainOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  // Four pictures that fit; the chosen one is always among them.
  const options = coverOptionsFor(draft.title, draft.category);
  const four = options.slice(0, 4).includes(draft.coverImageUrl) ? options.slice(0, 4) : [draft.coverImageUrl, ...options.slice(0, 3)];

  return (
    <Screen>
      <KeyboardAware>
        <StepHeader step={0} />
        <ScreenScroll>
          <PageTitle title="Hva skal dere gjøre?" />
          <Input
            size="lg"
            value={draft.title}
            onChangeText={draft.setTitle}
            placeholder="F.eks. Badstu med jentene"
            autoFocus={!draft.title}
            clearable
            maxLength={80}
            returnKeyType="done"
            autoCapitalize="sentences"
            accessibilityLabel="Hva skal dere gjøre?"
          />

          <View style={{ marginTop: spacing.sm }}>
            <LinkRow icon={<Ionicons name="bulb-outline" size={18} color={colors.primary} />} label="Trenger du inspirasjon?" onPress={() => router.push('/create/inspiration')} />
            {earlier.length && draft.source === 'new' && !draft.groupId ? (
              <LinkRow icon={<Icon name="copy" size={17} color="textSecondary" />} label="Gjenta et tidligere arrangement" onPress={() => setAgainOpen(true)} />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md }}>
            <Text variant="title3" accessibilityRole="header">
              Velg bilde
            </Text>
            <PressableScale onPress={() => setPhotosOpen(true)} hitSlop={8} accessibilityRole="button">
              <Text variant="callout" color="primary">
                Se flere bilder
              </Text>
            </PressableScale>
          </View>
          <Animated.View key={draft.category} entering={FadeIn.duration(250)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' }}>
            {four.map((url, i) => {
              const selected = draft.coverImageUrl === url;
              return (
                <PressableScale
                  key={url}
                  onPress={() => draft.set({ coverImageUrl: url, coverTouched: true })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Bilde ${i + 1}`}
                  style={{ width: '48.6%', aspectRatio: 1.2, borderRadius: radius.md, overflow: 'hidden', borderWidth: selected ? 3 : 0, borderColor: colors.primary }}
                >
                  <Image source={{ uri: thumb(url, 500) }} style={{ flex: 1, backgroundColor: colors.surfaceMuted }} contentFit="cover" transition={200} />
                  {selected ? (
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={15} tint="#fff" />
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </Animated.View>
        </ScreenScroll>
        <BottomBar>
          {draft.datePreset && draft.fixedDate ? (
            <Button title={`Velg klokkeslett · ${formatLong(draft.fixedDate)}`} disabled={!valid} onPress={() => router.push('/create/fixed')} />
          ) : (
            <Button title="Velg dato og tid" disabled={!valid} onPress={() => router.push('/create/when')} />
          )}
        </BottomBar>
      </KeyboardAware>

      {/* The full picker as before: every theme, its photos, and your own. */}
      <Sheet visible={photosOpen} onClose={() => setPhotosOpen(false)} title="Velg bilde">
        <CoverPicker
          title={draft.title}
          category={draft.category}
          onCategory={(c) => draft.set({ category: c, coverImageUrl: defaultCoverFor(draft.title, c), coverTouched: true })}
          value={draft.coverImageUrl}
          onChange={(coverImageUrl) => draft.set({ coverImageUrl, coverTouched: true })}
        />
        <Button title="Ferdig" variant="ink" onPress={() => setPhotosOpen(false)} style={{ marginTop: spacing.lg }} />
      </Sheet>

      <Sheet visible={againOpen} onClose={() => setAgainOpen(false)} title="Gjenta et arrangement">
        <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.sm }}>
          Samme bilde, sted og folk – du kan endre alt.
        </Text>
        {earlier.map((e, i) => (
          <View key={e.id}>
            {i ? <Divider /> : null}
            <PressableScale
              onPress={() => {
                draft.duplicateEvent(e, me?.id);
                setAgainOpen(false);
              }}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel={`Gjenta ${e.title}, ${eventDateLine(e)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
            >
              <Image source={{ uri: thumb(e.coverImageUrl, 160) }} style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text variant="callout" numberOfLines={1}>
                  {e.title}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {eventDateLine(e)}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="textTertiary" />
            </PressableScale>
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}

/** A quiet link under the name: icon, text, arrow. */
function LinkRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
      {icon}
      <Text variant="callout" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </PressableScale>
  );
}

/** Plans you've been part of that are over, newest first, one per title. */
function earlierPlans(events: PlannerEvent[], meId?: string, limit = 8): PlannerEvent[] {
  const t = today();
  const seen = new Set<string>();
  return events
    .filter((e) => e.status === 'completed' || (e.status !== 'cancelled' && !!e.selectedDate && e.selectedDate < t))
    .filter((e) => e.members.find((m) => m.userId === meId)?.status !== 'declined')
    .sort((a, b) => (b.selectedDate ?? b.createdAt).localeCompare(a.selectedDate ?? a.createdAt))
    .filter((e) => {
      const key = e.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
