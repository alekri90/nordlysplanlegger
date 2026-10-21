import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ImageCard } from '@/components/create/ImageCard';
import { Header, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useGroup } from '@/data/hooks';
import { suggestCategory } from '@/lib/categories';
import { suggestIdeas } from '@/lib/ideas';
import { activitiesFor, groupPhoto, INSPIRATION_GROUPS, searchActivities, type Activity, type InspirationGroup } from '@/lib/inspiration';
import { useCreateDraft } from '@/state/createDraft';
import { spacing } from '@/theme';

/**
 * «Trenger du inspirasjon?» — who with, then what. Picking an activity fills in the name and its
 * picture on step 1 and comes back; nothing is saved until the plan is sent as usual.
 */
export default function Inspiration() {
  const draft = useCreateDraft();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<InspirationGroup | null>(null);

  // From a gjeng: what they usually do first.
  const group = useGroup(draft.groupId ?? undefined);
  const g = group.data;
  const forGroup = useMemo(() => {
    if (!g) return [];
    const history = [g.nextEvent?.title, ...g.pastEvents.map((p) => p.title), g.defaults.title].filter((t): t is string => !!t);
    return activitiesFor(suggestIdeas({ history, nameTheme: suggestCategory(g.name), limit: 4 }));
  }, [g]);

  const results = useMemo(() => searchActivities(query), [query]);
  const activities = useMemo(() => (open ? activitiesFor(open.activities) : []), [open]);

  const pick = (a: Activity) => {
    // The activity's own picture, even if another one was chosen before.
    draft.set({ coverTouched: false });
    draft.setTitle(a.title);
    router.back();
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back={open && !query ? 'back' : 'close'} onBack={() => (open && !query ? setOpen(null) : router.back())} />
        <ScreenScroll>
          <PageTitle title={open && !query ? open.label : 'Hva har du lyst til å finne på?'} />
          <Input icon="search" placeholder="Søk etter aktiviteter" value={query} onChangeText={setQuery} clearable accessibilityLabel="Søk etter aktiviteter" returnKeyType="search" />

          {query.trim() ? (
            results.length ? (
              <Grid items={results} onPick={pick} />
            ) : (
              <Animated.View entering={FadeIn} style={{ marginTop: spacing.xl, gap: spacing.md }}>
                <Text variant="body" color="textSecondary">
                  Ingen forslag for «{query.trim()}».
                </Text>
                <PressableScale onPress={() => pick({ title: query.trim().replace(/^./, (c) => c.toUpperCase()), category: 'hangout', cover: '', inSeason: false })} accessibilityRole="button">
                  <Text variant="callout" color="primary">
                    Bruk «{query.trim()}» som navn
                  </Text>
                </PressableScale>
              </Animated.View>
            )
          ) : open ? (
            <Grid items={activities} onPick={pick} />
          ) : (
            <>
              {forGroup.length ? (
                <View style={{ marginTop: spacing.xl }}>
                  <Text variant="title3" style={{ marginBottom: spacing.md }}>
                    Forslag for {g!.name}
                  </Text>
                  <Grid items={forGroup} onPick={pick} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between', marginTop: spacing.xl }}>
                {INSPIRATION_GROUPS.map((c) => (
                  <ImageCard key={c.id} uri={groupPhoto(c)} label={c.label} onPress={() => setOpen(c)} />
                ))}
              </View>
            </>
          )}
        </ScreenScroll>
      </KeyboardAware>
    </Screen>
  );
}

function Grid({ items, onPick }: { items: Activity[]; onPick: (a: Activity) => void }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between', marginTop: spacing.lg }}>
      {items.map((a) => (
        <ImageCard key={a.title} uri={a.cover} label={a.title} tag={a.inSeason ? 'Passer nå' : undefined} onPress={() => onPick(a)} />
      ))}
    </Animated.View>
  );
}

