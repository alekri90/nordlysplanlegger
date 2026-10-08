import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import { Header, Screen, ScreenScroll, Text } from '@/components/ui';
import { LEGAL, type LegalSection } from '@/lib/legal';
import { spacing } from '@/theme';

/** Plain, readable legal page. Opened from the app or directly on the web (no history to go back to). */
export function LegalPage({ title, sections, contactFirst }: { title: string; sections: LegalSection[]; contactFirst?: boolean }) {
  const contact = LEGAL.contactEmail ? (
    <View style={{ gap: spacing.sm }}>
      <Text variant="headline">Kontakt</Text>
      <Text variant="body" color="textSecondary">
        Spørsmål? Skriv til{' '}
        <Text variant="body" color="primary" onPress={() => Linking.openURL('mailto:' + LEGAL.contactEmail)} accessibilityRole="link">
          {LEGAL.contactEmail}
        </Text>
        .
      </Text>
    </View>
  ) : null;
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
          {contactFirst ? contact : null}
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
          {contactFirst ? null : contact}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
