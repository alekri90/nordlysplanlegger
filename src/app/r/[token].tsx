import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CalendarLegend, MonthCalendar, type DayState } from '@/components/calendar/MonthCalendar';
import { PlansNote, usePlannedDays, withoutOurs } from '@/components/calendar/usePlannedDays';
import { ConflictNote } from '@/components/event/CalendarConflict';
import { ThemeSheet } from '@/components/event/ThemeSheet';
import { Avatar, BottomBar, Button, Card, EmptyState, Icon, Input, PageSkeleton, PressableScale, Screen, ScreenScroll, Tag, Text, useToast } from '@/components/ui';
import { useAnswerRoleRequest, useRoleRequestByToken, useSetRoleTheme } from '@/data/hooks';
import type { PlannerEvent, RoleRequestView } from '@/data/types';
import { useBusyItems } from '@/lib/calendarBusy';
import { conflictsFor, type BusyItem, type ConflictWhen } from '@/lib/calendarConflicts';
import { useMe } from '@/state/session';
import { roleActivity } from '@/lib/activities';
import { groupByWeek } from '@/lib/clearance';
import { formatLong, monthKey, today } from '@/lib/dates';
import { timeHintLabel } from '@/lib/eventText';
import { haptics } from '@/lib/haptics';
import { setAll } from '@/lib/roleRequest';
import { radius, spacing, useColors } from '@/theme';

type Answer = boolean | null;

/**
 * The page for someone asked to take a role (the sauna master), no account or app needed:
 * «Kan» / «Kan ikke» / «Ikke svart» per date, many at once, a word if you like, send.
 */
export default function RoleAnswerPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const q = useRoleRequestByToken(token);
  if (q.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!q.data) {
    return (
      <Screen>
        <EmptyState icon="link-2" title="Lenken virker ikke" body="Forespørselen kan være avbrutt. Spør den som sendte den." />
      </Screen>
    );
  }
  return <Answering v={q.data} />;
}

function Answering({ v }: { v: RoleRequestView }) {
  const toast = useToast();
  const send = useAnswerRoleRequest(v.token);
  const type = roleActivity(v.activityType);
  const roleLabel = type?.role.lower ?? v.roleLabel;
  const t = today();
  const dates = useMemo(() => v.dates.filter((d) => d.date >= t || d.mine), [v.dates, t]);
  const openDates = dates.filter((d) => !d.taken && !d.cancelled);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(v.dates.map((d) => [d.id, d.answer])));
  const [reply, setReply] = useState(v.reply ?? '');
  const [sent, setSent] = useState(false);
  const org = v.organizer.name;
  const me = useMe();
  const setTheme = useSetRoleTheme(v.token);
  const [themeFor, setThemeFor] = useState<RoleRequestView['dates'][number] | null>(null);

  // Your calendar for these days: plans in the app (a ring) and the phone's calendar (a dot).
  const planned = usePlannedDays(v.dates.map((d) => d.eventId));
  const allBusy = useBusyItems(dates[0]?.date ?? null, dates[dates.length - 1]?.date ?? null);
  const busy = useMemo(() => withoutOurs(allBusy, planned), [allBusy, planned]);
  const moment = (date: string): ConflictWhen => ({ date, startTime: v.startTime, timeHint: v.timeHint });
  const months = [...new Set(dates.map((d) => monthKey(d.date)))].sort();
  const asked = new Map(dates.map((d) => [d.date, d]));
  const dayState = (date: string): DayState => {
    const d = asked.get(date);
    if (!d) return 'disabled';
    if (d.mine) return 'best';
    if (d.taken || d.cancelled) return 'disabled';
    const a = answers[d.id] ?? null;
    return a === true ? 'best' : a === false ? 'unavailable' : 'candidate';
  };
  const cycle = (date: string) => {
    const d = asked.get(date);
    if (!d || d.taken || d.cancelled || d.mine) return;
    const a = answers[d.id] ?? null;
    setOne(d.id, a === null ? true : a === true ? false : null);
  };
  const anyPlan = dates.some((d) => planned.has(d.date));
  const anyBusy = dates.some((d) => conflictsFor(busy, moment(d.date)).length > 0);

  const saveTheme = async (theme: string | null) => {
    if (!themeFor) return;
    try {
      await setTheme.mutateAsync({ dateId: themeFor.id, theme });
      toast({ message: theme ? 'Temaet er lagret' : 'Temaet er fjernet', tone: 'success' });
      setThemeFor(null);
    } catch {
      toast({ message: 'Kunne ikke lagre. Prøv igjen.', tone: 'error' });
    }
  };

  const setOne = (id: string, a: Answer) => {
    haptics.tap();
    setAnswers((s) => ({ ...s, [id]: a }));
  };
  const setMany = (a: Answer, only?: string[]) => {
    haptics.light();
    setAnswers((s) => ({ ...s, ...setAll(dates, a, only) }));
  };

  const can = openDates.filter((d) => answers[d.id] === true).length;
  const cannot = openDates.filter((d) => answers[d.id] === false).length;
  const blank = openDates.length - can - cannot;

  const submit = async () => {
    try {
      await send.mutateAsync({ answers: Object.fromEntries(openDates.map((d) => [d.id, answers[d.id] ?? null])), reply: reply.trim() || null });
      haptics.success();
      setSent(true);
    } catch {
      toast({ message: 'Kunne ikke sende. Prøv igjen.', tone: 'error' });
    }
  };

  if (sent) {
    // Dates where only this person was asked are confirmed at once; the rest the organizer decides.
    const mineNow = v.dates.filter((d) => d.mine).length;
    const rest = can - mineNow;
    const outcome = mineNow
      ? `Du er ${roleLabel} på ${mineNow} ${mineNow === 1 ? 'dato' : 'datoer'}${rest > 0 ? `, og ${org} velger for ${rest} til` : ''}.`
      : can
        ? `Du kan ${can} ${can === 1 ? 'dato' : 'datoer'}. ${org} velger hvem som blir ${roleLabel}, og du får beskjed.`
        : '';
    return (
      <Screen>
        <EmptyState
          icon="check-circle"
          title="Takk!"
          body={`${org} har fått svaret ditt. ${outcome || (can ? `Du kan ${can} ${can === 1 ? 'dato' : 'datoer'}.` : 'Du kan ingen av datoene.')} Du kan endre svaret med den samme lenken.`}
        />
      </Screen>
    );
  }

  const weeks = groupByWeek(dates.map((d) => d.date));
  const byDate = new Map(dates.map((d) => [d.date, d]));

  return (
    <Screen>
      <ScreenScroll bottomInset={220} contentContainerStyle={{ paddingTop: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={org} uri={v.organizer.avatarUrl} size={48} />
          <Text variant="title2" style={{ flex: 1 }} accessibilityRole="header">
            {org} spør om du kan være {roleLabel}
          </Text>
        </View>

        <Card muted style={{ marginTop: spacing.xl, gap: 4 }}>
          <Text variant="headline">{v.title}</Text>
          <Text variant="footnote" color="textSecondary">
            {timeHintLabel(v.timeHint, v.startTime)}
            {v.placeName ? ` · ${v.placeName}` : ''}
          </Text>
          {v.note ? (
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              «{v.note}»
            </Text>
          ) : null}
          <Text variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
            Svar på hver dato. Du får beskjed når en dato er bekreftet.
          </Text>
        </Card>

        <Text variant="title3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Kalenderen din
        </Text>
        <View style={{ gap: spacing.xl }}>
          {months.map((m) => (
            <MonthCalendar key={m} month={m} getState={dayState} onPressDay={cycle} isBusy={(d) => asked.has(d) && conflictsFor(busy, moment(d)).length > 0} hasPlan={(d) => asked.has(d) && planned.has(d)} dayHint="Trykk for å svare Kan, Kan ikke eller Ikke svart" />
          ))}
        </View>
        <CalendarLegend
          items={[
            { state: 'candidate', label: 'Spurt om' },
            { state: 'best', label: 'Kan' },
            { state: 'unavailable', label: 'Kan ikke' },
            ...(anyPlan ? [{ state: 'plan' as const, label: 'Har noe planlagt' }] : []),
            ...(anyBusy ? [{ state: 'busy' as const, label: 'Noe i kalenderen' }] : []),
          ]}
        />
        {!me ? (
          <Text variant="footnote" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
            Har du Nordlys-appen? Åpner du lenken der, ser du også det du har planlagt.
          </Text>
        ) : null}

        {openDates.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl, alignItems: 'center' }}>
            <Text variant="subhead" color="textSecondary" style={{ flexBasis: '100%' }}>
              Merk alle på én gang
            </Text>
            <Button size="sm" variant="secondary" icon="check" title="Kan alle" fullWidth={false} onPress={() => setMany(true)} />
            <Button size="sm" variant="secondary" icon="x" title="Kan ingen" fullWidth={false} onPress={() => setMany(false)} />
            <Button size="sm" variant="ghost" title="Nullstill" fullWidth={false} onPress={() => setMany(null)} />
          </View>
        ) : null}

        {weeks.map((w) => {
          const inWeek = w.dates.map((d) => byDate.get(d)!).filter(Boolean);
          const openInWeek = inWeek.filter((d) => !d.taken && !d.cancelled).map((d) => d.id);
          return (
            <View key={w.label + w.dates[0]} style={{ marginTop: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                  {w.label}
                </Text>
                {openInWeek.length > 1 ? (
                  <PressableScale onPress={() => setMany(true, openInWeek)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Kan hele ${w.label.toLowerCase()}`}>
                    <Text variant="footnote" color="primary">
                      Kan hele uka
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
              <View style={{ gap: spacing.sm }}>
                {inWeek.map((d) => (
                  <DateAnswer
                    key={d.id}
                    date={d.date}
                    value={answers[d.id] ?? null}
                    mine={d.mine}
                    taken={d.taken}
                    cancelled={d.cancelled}
                    roleLabel={roleLabel}
                    onChange={(a) => setOne(d.id, a)}
                    plans={planned.get(d.date)}
                    busy={busy}
                    when={moment(d.date)}
                    theme={d.theme}
                    themeLabel={type?.theme.label ?? 'Tema'}
                    onTheme={d.mine && type ? () => setThemeFor(d) : undefined}
                    onOpen={d.mine && d.eventId && me ? () => router.push(`/event/${d.eventId}`) : undefined}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: spacing.xl }}>
          <Input
            label={`Melding til ${org} (valgfritt)`}
            placeholder="F.eks. «Torsdager kan jeg fra kl. 19»"
            value={reply}
            onChangeText={setReply}
            multiline
            maxLength={500}
            style={{ minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' }}
          />
        </View>
      </ScreenScroll>
      <ThemeSheet visible={!!themeFor} onClose={() => setThemeFor(null)} activity={v.activityType} value={themeFor?.theme ?? null} subtitle={themeFor ? formatLong(themeFor.date) : undefined} loading={setTheme.isPending} onSave={saveTheme} />
      {openDates.length ? (
        <BottomBar>
          <Text variant="footnote" color="textSecondary" align="center" style={{ marginBottom: spacing.sm }}>
            {[`${can} kan`, `${cannot} kan ikke`, blank ? `${blank} ikke svart` : null].filter(Boolean).join(' · ')}
          </Text>
          <Button variant="ink" icon="send" title="Send svar" loading={send.isPending} onPress={submit} />
        </BottomBar>
      ) : null}
    </Screen>
  );
}

function DateAnswer({
  date,
  value,
  mine,
  taken,
  cancelled,
  roleLabel,
  onChange,
  plans,
  busy,
  when,
  theme,
  themeLabel,
  onTheme,
  onOpen,
}: {
  date: string;
  value: Answer;
  mine: boolean;
  taken: boolean;
  cancelled: boolean;
  roleLabel: string;
  onChange: (a: Answer) => void;
  plans?: PlannerEvent[];
  busy: BusyItem[];
  when: ConflictWhen;
  theme: string | null;
  themeLabel: string;
  onTheme?: () => void;
  onOpen?: () => void;
}) {
  const colors = useColors();
  const locked = taken || cancelled;
  const options: { a: Answer; label: string; fg: string; bg: string }[] = [
    { a: true, label: 'Kan', fg: colors.success, bg: colors.successSoft },
    { a: false, label: 'Kan ikke', fg: colors.danger, bg: colors.dangerSoft },
    { a: null, label: 'Ikke svart', fg: colors.textSecondary, bg: colors.surfaceMuted },
  ];
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: value === true && !locked ? colors.success : colors.border,
        backgroundColor: colors.surface,
        gap: spacing.sm,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="body" style={{ flex: 1 }}>
          {formatLong(date)}
        </Text>
        {mine ? <Tag label={`Du er ${roleLabel}`} tone="success" icon="award" /> : taken ? <Tag label="Tatt av en annen" /> : cancelled ? <Tag label="Avlyst" /> : null}
      </View>
      {!taken && !cancelled ? (
        <>
          <PlansNote plans={plans} date={date} />
          <ConflictNote busy={busy} when={when} />
        </>
      ) : null}
      {mine && (onTheme || onOpen || theme) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          {theme ? (
            <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
              {themeLabel}: {theme}
            </Text>
          ) : null}
          {onTheme ? <Button size="sm" variant="secondary" icon="edit-2" title={theme ? 'Endre' : `Legg til ${themeLabel.toLowerCase()}`} fullWidth={false} onPress={onTheme} /> : null}
          {onOpen ? <Button size="sm" variant="secondary" icon="calendar" title="Åpne" fullWidth={false} onPress={onOpen} /> : null}
        </View>
      ) : null}
      {locked ? null : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={formatLong(date)}>
          {options.map((o) => {
            const on = value === o.a;
            return (
              <PressableScale
                key={o.label}
                onPress={() => onChange(o.a)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${formatLong(date)}: ${o.label}`}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 4,
                  backgroundColor: on ? o.bg : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? o.fg : colors.border,
                }}
              >
                {on ? <Icon name={o.a === true ? 'check' : o.a === false ? 'x' : 'minus'} size={14} tint={o.fg} /> : null}
                <Text variant="footnote" style={{ color: on ? o.fg : colors.text }}>
                  {o.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}
