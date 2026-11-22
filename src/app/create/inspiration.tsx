import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ImageCard } from '@/components/create/ImageCard';
import { Header, Input, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { useEvents, useGroup } from '@/data/hooks';
import { suggestCategory } from '@/lib/categories';
import { today } from '@/lib/dates';
import { suggestIdeas } from '@/lib/ideas';
import { activitiesFor, groupPhoto, INSPIRATION_GROUPS, searchActivities, type Activity, type InspirationGroup } from '@/lib/inspiration';
import { earlierPlans, FEATURED, temptingNow, type TemptingCard } from '@/lib/tempting';
import { useCreateDraft } from '@/state/createDraft';
import { useMe } from '@/state/session';
import { spacing } from '@/theme';

/**
 * «Trenger du inspirasjon?» — who with, then what. Picking an activity fills in the name and its
 * picture on step 1 and comes back; nothing is saved until the plan is sent as usual.
 */
export default function Inspiration() {
  const draft = useCreateDraft();
  const { fra } = useLocalSearchParams<{ fra?: string }>();
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

  // From «Se flere» on the home screen: what you did before, what fits now, and more — not the three you just saw.
  const me = useMe();
  const events = useEvents();
  const ideas = useMemo(() => {
    if (fra !== 'hjem') return [];
    const t = today();
    const all = events.data ?? [];
    const ahead = all.filter((e) => e.status !== 'cancelled' && e.status !== 'completed' && (!e.selectedDate || e.selectedDate >= t));
    const seen = FEATURED.map((f) => ({ title: f.title, activityType: f.kit ?? null }));
    return temptingNow({ earlier: earlierPlans(all, me?.id, t), planned: [...ahead, ...seen], limit: 6 });
  }, [fra, events.data, me?.id]);
  const pickIdea = (card: TemptingCard) => {
    draft.startFromIdea(card, me?.id);
    router.replace('/create');
  };

  const results = useMemo(() => searchActivities(query), [query]);
  const activities = useMemo(() => (open ? activitiesFor(open.activities) : []), [open]);

  const pick = (a: Activity) => {
    // The activity's own picture, even if another one was chosen before.
    draft.set({ coverTouched: false });
    draft.setTitle(a.title);
    // From «Se flere» on the home screen there's no step 1 underneath yet.
    if (fra === 'hjem') router.replace('/create');
    else router.back();
  };

  return (
    <Screen>
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
            {ideas.length ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text variant="title3">Forslag til deg</Text>
                <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between', marginTop: spacing.md }}>
                  {ideas.map((c) => (
                    <ImageCard key={c.key} uri={c.cover} label={c.title} tag={c.reason === 'again' ? 'Gjør igjen' : c.reason === 'season' ? 'Passer nå' : undefined} onPress={() => pickIdea(c)} />
                  ))}
                </Animated.View>
              </View>
            ) : null}
            {forGroup.length ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text variant="title3" style={{ marginBottom: spacing.md }}>
                  Forslag for {g!.name}
                </Text>
                <Grid items={forGroup} onPick={pick} />
              </View>
            ) : null}
            {ideas.length ? (
              <Text variant="title3" style={{ marginTop: spacing.xxl }}>
                Hvem er du med?
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between', marginTop: ideas.length ? spacing.md : spacing.xl }}>
              {INSPIRATION_GROUPS.map((c) => (
                <ImageCard key={c.id} uri={groupPhoto(c)} label={c.label} onPress={() => setOpen(c)} />
              ))}
            </View>
          </>
        )}
      </ScreenScroll>
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

