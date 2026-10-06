import { router } from 'expo-router';
import { View } from 'react-native';

import { Header, Screen, ScreenScroll, Text } from '@/components/ui';
import { LEGAL, type LegalSection } from '@/lib/legal';
import { spacing } from '@/theme';

/** Plain, readable legal page. Opened from the app or directly on the web (no history to go back to). */
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <Screen>
      <Header back="back" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScreenScroll bottomInset={spacing.huge}>
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs }}>
          Nordlys Planlegger · Sist oppdatert {LEGAL.updated}
        </Text>
        <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
          {sections.map((s) => (
            <View key={s.title} style={{ gap: spacing.sm }}>
              <Text variant="headline" accessibilityRole="header">
                {s.title}
              </Text>
              {s.paragraphs.map((p) => (
                <Text key={p} variant="body" color="textSecondary">
                  {p}
                </Text>
              ))}
            </View>
          ))}
          {LEGAL.contactEmail ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="headline">Kontakt</Text>
              <Text variant="body" color="textSecondary">
                Spørsmål? Skriv til {LEGAL.contactEmail}.
              </Text>
            </View>
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
