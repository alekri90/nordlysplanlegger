import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { StepHeader } from '@/components/create/StepHeader';
import { BottomBar, Button, Chip, Icon, Input, KeyboardAware, PageTitle, PressableScale, Screen, ScreenScroll, Text } from '@/components/ui';
import { CATEGORY_LIST, coverOptions, defaultCover, thumb } from '@/lib/categories';
import { useCreateDraft } from '@/state/createDraft';
import { gutter, radius, spacing, useColors } from '@/theme';

/** Every theme, the catch-all last. */
const THEMES = [...CATEGORY_LIST.filter((c) => c.id !== 'hangout'), ...CATEGORY_LIST.filter((c) => c.id === 'hangout')];

const IDEAS = ['Badstu med jentene', 'Middag', 'Spillkveld', 'Filmkveld', 'Quiz', 'Padel', 'Hyttetur', 'Vors', 'Julebord'];

/** Step 1 — what are we doing? Typing suggests a category and matching photos. */
export default function CreateWhat() {
  const colors = useColors();
  const draft = useCreateDraft();
  const category = draft.category;
  const photos = coverOptions(category);
  const custom = !photos.includes(draft.coverImageUrl) ? draft.coverImageUrl : null;
  const grid = custom ? [custom, ...photos.slice(0, 4)] : photos.slice(0, 5);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) draft.set({ coverImageUrl: result.assets[0].uri, coverTouched: true });
  };

  const valid = draft.title.trim().length > 0;

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
                {IDEAS.map((idea) => (
                  <Chip key={idea} label={idea} onPress={() => draft.setTitle(idea)} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <Text variant="title3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
            Velg tema og bilde
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginHorizontal: -gutter, marginBottom: spacing.md }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: gutter }}
          >
            {THEMES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                icon={c.icon}
                selected={c.id === category}
                onPress={() => draft.set({ category: c.id, coverImageUrl: defaultCover(c.id), coverTouched: true })}
              />
            ))}
          </ScrollView>

          <Animated.View key={category} entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {grid.map((url, i) => {
              const selected = draft.coverImageUrl === url;
              return (
                <PressableScale
                  key={url}
                  onPress={() => draft.set({ coverImageUrl: url, coverTouched: true })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Bilde ${i + 1}`}
                  style={{
                    width: '48.6%',
                    aspectRatio: 1.2,
                    borderRadius: radius.md,
                    overflow: 'hidden',
                    borderWidth: selected ? 3 : 0,
                    borderColor: colors.primary,
                  }}
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
            <PressableScale
              onPress={pickImage}
              accessibilityLabel="Last opp eget bilde"
              style={{
                width: '48.6%',
                aspectRatio: 1.2,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.borderStrong,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="image" size={24} color="textSecondary" />
              <Text variant="footnote" color="textSecondary">
                Eget bilde
              </Text>
            </PressableScale>
          </Animated.View>
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Fortsett" disabled={!valid} onPress={() => router.push('/create/when')} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
