import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { KitBring } from '@/components/kit/KitBring';
import { KitDiet } from '@/components/kit/KitDiet';
import { KitFieldsForm } from '@/components/kit/KitFieldsForm';
import { KitPoker } from '@/components/kit/KitPoker';
import { KitRides } from '@/components/kit/KitRides';
import { Button, Card, Icon, PressableScale, Sheet, Text, useToast } from '@/components/ui';
import type { ActivityDetailsData, KitRef, PlannerEvent } from '@/data/types';
import { useEventKit, useSetActivityDetails } from '@/data/hooks';
import { CATEGORIES } from '@/lib/categories';
import { kitLines, type KitActivityType } from '@/lib/activities';
import { spacing } from '@/theme';

type Props = {
  type: KitActivityType;
  /** The event when signed in; null on an invite page (then `token` is used). */
  event: PlannerEvent | null;
  token?: string;
  /** Details when there is no event object (invite page). */
  details?: ActivityDetailsData | null;
  isOrganizer?: boolean;
  isMember?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A building-block activity on the event and the invite: its own details (the table, the menu,
 * the route), then the parts people use — diets, the bring list, rides, the poker pot.
 */
export function ActivityKit({ type, event, token, details, isOrganizer, style }: Props) {
  const ref: KitRef = token ? { token } : { eventId: event?.id };
  const kit = useEventKit(ref);
  const [editOpen, setEditOpen] = useState(false);
  const shownDetails = event?.activityDetails ?? kit.data?.details ?? details ?? null;
  const lines = kitLines(type, shownDetails);
  const groups: { group: string | undefined; lines: typeof lines }[] = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.group === l.group) last.lines.push(l);
    else groups.push({ group: l.group, lines: [l] });
  }
  const k = kit.data;

  return (
    <View style={[{ gap: spacing.md }, style]}>
      {lines.length || (isOrganizer && type.kit.fields.length) ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={CATEGORIES[type.category].icon} size={16} color="primary" />
            <Text variant="headline" style={{ flex: 1 }}>
              {type.kit.detailsTitle}
            </Text>
            {isOrganizer && event ? (
              <PressableScale onPress={() => setEditOpen(true)} accessibilityRole="button" accessibilityLabel={`Endre ${type.kit.detailsTitle.toLowerCase()}`}>
                <Text variant="footnote" color="primary">
                  {lines.length ? 'Endre' : 'Legg til'}
                </Text>
              </PressableScale>
            ) : null}
          </View>
          {groups.map((g, i) => (
            <View key={`${g.group ?? 'f'}-${i}`} style={{ gap: spacing.xs }}>
              {g.group ? (
                <Text variant="subhead" color="textSecondary">
                  {g.group}
                </Text>
              ) : null}
              {g.lines.map((l) => (
                <View key={l.key} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Text variant="footnote" color="textSecondary" style={{ width: 96 }}>
                    {l.label}
                  </Text>
                  <Text variant="callout" style={{ flex: 1 }}>
                    {l.value}
                  </Text>
                </View>
              ))}
            </View>
          ))}
          {!lines.length ? (
            <Text variant="footnote" color="textSecondary">
              {type.kit.detailsSubtitle}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {k && type.kit.poker ? <KitPoker kit={k} kitRef={ref} event={event} /> : null}
      {k && (type.kit.bring || k.bring.length) ? <KitBring kit={k} kitRef={ref} /> : null}
      {k && type.kit.rides ? <KitRides kit={k} kitRef={ref} /> : null}
      {k && type.kit.diet ? <KitDiet kit={k} kitRef={ref} /> : null}

      {isOrganizer && event ? <EditSheet visible={editOpen} onClose={() => setEditOpen(false)} type={type} event={event} values={shownDetails?.fields ?? {}} /> : null}
    </View>
  );
}

function EditSheet({ visible, onClose, type, event, values }: { visible: boolean; onClose: () => void; type: KitActivityType; event: PlannerEvent; values: Record<string, string> }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={type.kit.detailsTitle} subtitle="Alle som er med ser endringen.">
      {/* Starts from what is saved each time it opens. */}
      <EditForm key={`${visible}`} type={type} event={event} initial={values} onDone={onClose} />
    </Sheet>
  );
}

function EditForm({ type, event, initial, onDone }: { type: KitActivityType; event: PlannerEvent; initial: Record<string, string>; onDone: () => void }) {
  const toast = useToast();
  const save = useSetActivityDetails();
  const [values, setValues] = useState(initial);
  return (
    <View style={{ gap: spacing.lg }}>
      <KitFieldsForm type={type} values={values} onChange={(key, v) => setValues((x) => ({ ...x, [key]: v }))} />
      <Button
        title="Lagre"
        variant="ink"
        loading={save.isPending}
        onPress={async () => {
          try {
            await save.mutateAsync({ eventId: event.id, type: type.id, details: { ...(event.activityDetails ?? {}), fields: cleanFields(values) } });
            toast({ message: 'Lagret', tone: 'success', icon: 'check' });
            onDone();
          } catch {
            toast({ message: 'Kunne ikke lagre. Prøv igjen.', tone: 'error' });
          }
        }}
      />
    </View>
  );
}

/** Only the fields that have something in them. */
export function cleanFields(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
}
