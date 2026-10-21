import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CoverPicker } from '@/components/create/CoverPicker';
import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Chip, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useEvents, useGroup } from '@/data/hooks';
import type { PlannerEvent } from '@/data/types';
import { defaultCoverFor, suggestCategory } from '@/lib/categories';
import { today } from '@/lib/dates';
import { suggestIdeas } from '@/lib/ideas';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/** Step 1 — what are we doing, and the picture that goes with it. Typing suggests a theme and photos. */
export default function CreateWhat() {
  const draft = useCreateDraft();

  const valid = draft.title.trim().length > 0;

  // What this gjeng usually does (its history, then its name), then the time of year, then evergreens.
  const group = useGroup(draft.groupId ?? undefined);
  const g = group.data;
  const history = g ? [g.nextEvent?.title, ...g.pastEvents.map((p) => p.title), g.defaults.title].filter((t): t is string => !!t) : [];
  const ideas = suggestIdeas({ history, nameTheme: g ? suggestCategory(g.name) : undefined }).filter((idea) => idea !== draft.title);
  // From a gjeng the title starts as what they usually do; keep the alternatives in view until it's changed.
  const showIdeas = !draft.title || (!!g && draft.title === g.defaults.title);

  // «Gjør igjen»: start from something you've done before (same picture, place and people).
  const me = useMe();
  const events = useEvents();
  const earlier = useMemo(() => earlierPlans(events.data ?? [], me?.id), [events.data, me?.id]);
  const showAgain = !draft.title && !g && earlier.length > 0;

  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreOpen || !!draft.placeName || !!draft.details;

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
            returnKeyType="next"
            autoCapitalize="sentences"
            accessibilityLabel="Hva skal dere gjøre?"
          />

          {showAgain ? (
            <Animated.View entering={FadeIn} style={{ marginTop: spacing.md }}>
              <Text variant="footnote" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                Gjør igjen
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
                {earlier.map((e) => (
                  <Chip key={e.id} label={e.title} icon="copy" onPress={() => draft.duplicateEvent(e, me?.id)} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          {showIdeas ? (
            <Animated.View entering={FadeIn} style={{ marginTop: spacing.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
                {ideas.map((idea) => (
                  <Chip key={idea} label={idea} onPress={() => draft.setTitle(idea)} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          {/* Optional and folded away, so starting a plan stays one field. */}
          {showMore ? (
            <Animated.View entering={FadeInDown.duration(250)} style={{ gap: spacing.md, marginTop: spacing.lg }}>
              <Input icon="map-pin" placeholder="Hvor? F.eks. Sørenga sjøbad" value={draft.placeName} onChangeText={(placeName) => draft.set({ placeName })} maxLength={120} accessibilityLabel="Hvor" />
              <Input
                placeholder="Detaljer til alle, f.eks. «Ta med håndkle»"
                value={draft.details}
                onChangeText={(details) => draft.set({ details })}
                multiline
                maxLength={2000}
                style={{ minHeight: 84, paddingTop: spacing.md, textAlignVertical: 'top' }}
                accessibilityLabel="Detaljer"
              />
            </Animated.View>
          ) : (
            <PressableScale onPress={() => setMoreOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm }} accessibilityLabel="Legg til sted og detaljer">
              <Icon name="plus-circle" size={18} color="textSecondary" />
              <Text variant="callout" color="textSecondary">
                Legg til sted og detaljer (valgfritt)
              </Text>
            </PressableScale>
          )}

          <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
            Velg bilde
          </Text>
          <CoverPicker
            title={draft.title}
            category={draft.category}
            onCategory={(c) => draft.set({ category: c, coverImageUrl: defaultCoverFor(draft.title, c), coverTouched: true })}
            value={draft.coverImageUrl}
            onChange={(coverImageUrl) => draft.set({ coverImageUrl, coverTouched: true })}
          />
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Velg dato/tid" disabled={!valid} onPress={() => router.push('/create/when')} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}

/** Plans you've been part of that are over, newest first, one per title. */
function earlierPlans(events: PlannerEvent[], meId?: string, limit = 6): PlannerEvent[] {
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
