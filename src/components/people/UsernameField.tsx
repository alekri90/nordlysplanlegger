import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Chip, Icon, Input, Text } from '@/components/ui';
import { repo } from '@/data';
import type { UsernameCheck } from '@/data/types';
import { normalizeUsername, sanitizeUsernameInput, USERNAME_MESSAGES, usernameFormatProblem } from '@/lib/username';
import { spacing, useColors } from '@/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Used for suggestions ("Alexander Kristensen" → @alexanderk, @alexk …). */
  displayName?: string;
  /** Reports whether the current value can be saved. */
  onValidChange?: (valid: boolean) => void;
  /** Current username: unchanged is always valid. */
  current?: string;
};

/** "@alexander er ledig" / "@alexander er opptatt" + alternatives, checked as you type. */
export function UsernameField({ value, onChange, displayName, onValidChange, current }: Props) {
  const colors = useColors();
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const normalized = normalizeUsername(value);
  const formatProblem = normalized ? usernameFormatProblem(normalized) : null;
  const unchanged = !!current && normalizeUsername(current) === normalized;

  const needsCheck = !!normalized && !formatProblem && !unchanged;

  useEffect(() => {
    if (!needsCheck) return;
    let alive = true;
    const t = setTimeout(() => {
      repo
        .checkUsername(normalized, displayName)
        .then((r) => alive && setCheck(r))
        .catch(() => alive && setCheck(null));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [needsCheck, normalized, displayName]);

  // Only trust a result for exactly what is typed now.
  const fresh = needsCheck && check?.normalized === normalized ? check : null;
  const checking = needsCheck && !fresh;
  const valid = unchanged || (!formatProblem && !!fresh?.available);
  useEffect(() => onValidChange?.(valid), [valid, onValidChange]);

  let status: { text: string; tone: 'ok' | 'bad' | 'muted' } | null = null;
  if (!normalized) status = null;
  else if (unchanged) status = { text: 'Ditt nåværende brukernavn', tone: 'muted' };
  else if (formatProblem) status = { text: USERNAME_MESSAGES[formatProblem], tone: 'bad' };
  else if (checking || !fresh) status = { text: 'Sjekker …', tone: 'muted' };
  else if (fresh.available) status = { text: `@${normalized} er ledig`, tone: 'ok' };
  else status = { text: fresh.reason === 'taken' ? `@${normalized} er opptatt` : USERNAME_MESSAGES[fresh.reason ?? 'blocked'], tone: 'bad' };

  return (
    <View>
      <Input
        value={value}
        onChangeText={(t) => onChange(sanitizeUsernameInput(t))}
        placeholder="brukernavn"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={24}
        icon="at-sign"
        accessibilityLabel="Brukernavn"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, marginLeft: 4, minHeight: 20 }} accessibilityLiveRegion="polite">
        {status?.tone === 'muted' && checking ? <ActivityIndicator size="small" color={colors.textTertiary} /> : null}
        {status?.tone === 'ok' ? <Icon name="check-circle" size={15} color="success" /> : null}
        {status?.tone === 'bad' ? <Icon name="alert-circle" size={15} color="danger" /> : null}
        {status ? (
          <Text variant="footnote" color={status.tone === 'ok' ? 'success' : status.tone === 'bad' ? 'danger' : 'textTertiary'}>
            {status.text}
          </Text>
        ) : null}
      </View>
      {fresh && !fresh.available && fresh.suggestions.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          {fresh.suggestions.map((s) => (
            <Chip key={s} label={`@${s}`} onPress={() => onChange(s)} accessibilityHint="Bruk dette brukernavnet" />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
