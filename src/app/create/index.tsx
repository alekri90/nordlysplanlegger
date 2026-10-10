import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CoverPicker } from '@/components/create/CoverPicker';
import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Chip, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useGroup } from '@/data/hooks';
import { defaultCover } from '@/lib/categories';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

const IDEAS = ['Badstu med jentene', 'Middag', 'Spillkveld', 'Filmkveld', 'Quiz', 'Padel', 'Hyttetur', 'Vors', 'Julebord'];

/** Step 1 — what are we doing, and the picture that goes with it. Typing suggests a theme and photos. */
export default function CreateWhat() {
  const draft = useCreateDraft();

  const valid = draft.title.trim().length > 0;

  // From a group: what this group usually does first, then the generic ideas.
  const group = useGroup(draft.groupId ?? undefined);
  const g = group.data;
  const groupIdeas = g ? [g.defaults.title, g.nextEvent?.title, ...g.pastEvents.map((p) => p.title)].filter((t): t is string => !!t) : [];
  const ideas = [...new Set([...groupIdeas, ...IDEAS])].slice(0, 10);

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

          {!draft.title ? (
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
            category={draft.category}
            onCategory={(c) => draft.set({ category: c, coverImageUrl: defaultCover(c), coverTouched: true })}
            value={draft.coverImageUrl}
            onChange={(coverImageUrl) => draft.set({ coverImageUrl, coverTouched: true })}
            featured={g ? { url: g.coverImageUrl, label: `Gjengbildet · ${g.name}` } : null}
          />
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Fortsett" disabled={!valid} onPress={() => router.push('/create/when')} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
