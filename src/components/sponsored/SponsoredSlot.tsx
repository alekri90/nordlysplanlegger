import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Linking, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { repo } from '@/data';
import type { SponsoredSuggestion } from '@/data/types';
import { FEATURES } from '@/lib/config';
import { radius, spacing } from '@/theme';

type Props = { placement: SponsoredSuggestion['placement']; category?: string; heading?: string };

/**
 * Native, relevant sponsored suggestions (e.g. "Trenger dere sted?" after a sauna date is set).
 * Renders nothing until FEATURES.sponsored is enabled. Never a banner.
 */
export function SponsoredSlot({ placement, category, heading = 'Trenger dere sted?' }: Props) {
  const { data } = useQuery({
    queryKey: ['sponsored', placement, category],
    queryFn: () => repo.listSponsored(placement, category),
    enabled: FEATURES.sponsored,
  });
  if (!FEATURES.sponsored || !data?.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="headline">{heading}</Text>
      {data.map((s) => (
        <Card key={s.id} onPress={() => Linking.openURL(s.ctaUrl)} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          {s.imageUrl ? <Image source={{ uri: s.imageUrl }} style={{ width: 56, height: 56, borderRadius: radius.md }} /> : null}
          <View style={{ flex: 1 }}>
            <Text variant="callout">{s.title}</Text>
            {s.body ? (
              <Text variant="footnote" color="textSecondary" numberOfLines={2}>
                {s.body}
              </Text>
            ) : null}
            <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
              Sponset · {s.sponsorName}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}
