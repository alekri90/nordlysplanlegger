import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CoverPicker } from '@/components/create/CoverPicker';
import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Chip, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useGroup } from '@/data/hooks';
import { defaultCover, suggestCategory } from '@/lib/categories';
import { suggestIdeas } from '@/lib/ideas';
import { useCreateDraft } from '@/state/createDraft';
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
            category={draft.category}
            onCategory={(c) => draft.set({ category: c, coverImageUrl: defaultCover(c), coverTouched: true })}
            value={draft.coverImageUrl}
            onChange={(coverImageUrl) => draft.set({ coverImageUrl, coverTouched: true })}
          />
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Fortsett" disabled={!valid} onPress={() => router.push('/create/when')} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
