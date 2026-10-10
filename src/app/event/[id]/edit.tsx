import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CoverPicker } from '@/components/create/CoverPicker';
import { TimePicker } from '@/components/create/TimePicker';
import { BottomBar, Button, Card, Header, Input, KeyboardAware, ListRow, PageSkeleton, Screen, ScreenScroll, Text, Toggle, useToast } from '@/components/ui';
import { useEvent, useSetSeriesCover, useUpdateEvent } from '@/data/hooks';
import type { CategoryId, PlannerEvent, TimeHint } from '@/data/types';
import { defaultCover } from '@/lib/categories';
import { spacing } from '@/theme';

/** Short form for the details that come later: picture, place, time, a note. */
export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  if (!event.data) return <Screen><PageSkeleton /></Screen>;
  return <EditForm event={event.data} />;
}

function EditForm({ event: e }: { event: PlannerEvent }) {
  const toast = useToast();
  const update = useUpdateEvent(e.id);
  const setSeriesCover = useSetSeriesCover();
  const [category, setCategory] = useState<CategoryId>(e.category);
  const [cover, setCover] = useState(e.coverImageUrl);
  const coverChanged = cover !== e.coverImageUrl;
  const inSeries = !!e.series && e.series.status !== 'ended';
  const [coverScope, setCoverScope] = useState<'this' | 'series'>('this');

  const [title, setTitle] = useState(e.title);
  const [place, setPlace] = useState(e.location?.name ?? '');
  const [address, setAddress] = useState(e.location?.address ?? '');
  const [pending, setPending] = useState(!!e.location?.detailsPending);
  const [description, setDescription] = useState(e.description ?? '');
  const [time, setTime] = useState<{ hint: TimeHint; time: string | null }>({ hint: e.startTime ? 'exact' : e.timeHint, time: e.startTime ?? null });

  const save = async () => {
    try {
      await update.mutateAsync({
        title: title.trim() || e.title,
        description: description.trim() || null,
        timeHint: time.hint,
        startTime: time.time,
        location: place.trim() ? { name: place.trim(), address: address.trim() || null, detailsPending: pending } : null,
        ...(coverChanged && !(inSeries && coverScope === 'series') && { coverImageUrl: cover }),
      });
      if (coverChanged && inSeries && coverScope === 'series') await setSeriesCover.mutateAsync({ seriesId: e.series!.id, coverImageUrl: cover, eventId: e.id });
      toast({ message: 'Lagret', tone: 'success' });
      router.back();
    } catch {
      toast({ message: 'Kunne ikke lagre', tone: 'error' });
    }
  };

  return (
    <Screen>
      <KeyboardAware>
        <Header back="close" title="Endre" />
        <ScreenScroll bottomInset={140}>
          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            <Input label="Navn" value={title} onChangeText={setTitle} maxLength={80} />
            <View>
              <Text variant="title3" style={{ marginBottom: spacing.md }}>
                Bilde
              </Text>
              <CoverPicker
                category={category}
                onCategory={(c) => {
                  setCategory(c);
                  setCover(defaultCover(c));
                }}
                value={cover}
                onChange={setCover}
              />
              {coverChanged && inSeries ? (
                <Card style={{ paddingVertical: spacing.xs, marginTop: spacing.md }}>
                  <ListRow title="Bare denne gangen" subtitle="De andre gangene beholder bildet sitt" radio selected={coverScope === 'this'} onPress={() => setCoverScope('this')} />
                  <ListRow title="Alle gangene fremover" subtitle="Blir det nye bildet for gjentakelsen" radio selected={coverScope === 'series'} onPress={() => setCoverScope('series')} />
                </Card>
              ) : null}
            </View>
            <Input label="Hvor?" icon="map-pin" placeholder="F.eks. Sørenga sjøbad" value={place} onChangeText={setPlace} />
            {place ? <Input label="Adresse" placeholder="Valgfritt" value={address} onChangeText={setAddress} /> : null}
            {place ? (
              <Card style={{ paddingVertical: spacing.xs }}>
                <ListRow title="Detaljer kommer" subtitle="Vis at stedet ikke er helt bestemt" trailing={<Toggle value={pending} onValueChange={setPending} accessibilityLabel="Detaljer kommer" />} />
              </Card>
            ) : null}
            {e.selectedDate ? <TimePicker hint={time.hint} time={time.time} allowHints={false} onChange={(hint, t) => setTime({ hint, time: t })} /> : null}
            <View>
              <Text variant="title3" style={{ marginBottom: spacing.md }}>
                Detaljer
              </Text>
              <Input placeholder="Det alle bør vite, f.eks. «Ta med håndkle». Nye beskjeder sender du fra arrangementet." value={description} onChangeText={setDescription} multiline style={{ minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' }} maxLength={2000} />
            </View>
          </View>
        </ScreenScroll>
        <BottomBar>
          <Button variant="ink" title="Lagre" loading={update.isPending || setSeriesCover.isPending} onPress={save} />
        </BottomBar>
      </KeyboardAware>
    </Screen>
  );
}
