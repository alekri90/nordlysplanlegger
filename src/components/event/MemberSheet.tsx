import { View } from 'react-native';

import { confirmDestructive, PersonSheet } from '@/components/people/PersonSheet';
import { Chip, Divider, ListRow, Text, Toggle, useToast } from '@/components/ui';
import { useRemoveEventMember, useSetMemberAnswer, useSetMemberPaysShare } from '@/data/hooks';
import type { EventMember } from '@/data/types';
import { firstName } from '@/lib/eventText';
import { spacing } from '@/theme';

type Answer = 'attending' | 'declined' | 'invited';

const ANSWERS: { id: Answer; label: string }[] = [
  { id: 'attending', label: 'Kommer' },
  { id: 'declined', label: 'Kan ikke' },
  { id: 'invited', label: 'Ikke svart' },
];

const answerOf = (m: EventMember): Answer | 'waitlisted' =>
  m.status === 'attending' || m.status === 'declined' || m.status === 'waitlisted' ? m.status : 'invited';

/**
 * Someone on the guest list: the usual person actions, and for the organizer side
 * - «Svaret deres»: set it for someone who answered on SMS (they're told, and it's marked «Satt av …»)
 * - «Betaler andel»: when there's a price, e.g. the sauna master doesn't share the cost
 * - «Fjern fra arrangementet»
 */
export function MemberSheet({
  member,
  canRemove,
  canSetAnswer = false,
  hasPrice = false,
  onClose,
}: {
  member: EventMember | null;
  canRemove: boolean;
  /** The event takes «Kommer / Kan ikke» answers (has a date, not cancelled). */
  canSetAnswer?: boolean;
  hasPrice?: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const remove = useRemoveEventMember();
  const setAnswer = useSetMemberAnswer();
  const setPays = useSetMemberPaysShare();
  const guest = canRemove && member && member.role === 'guest' ? member : null;
  const name = member ? firstName(member.person.name) : '';
  const current = guest ? answerOf(guest) : null;

  const pick = async (status: Answer) => {
    if (!guest || current === status || (status === 'attending' && current === 'waitlisted')) return;
    try {
      const result = await setAnswer.mutateAsync({ memberId: guest.id, status });
      toast(
        result === 'waitlisted'
          ? `Det er fullt – ${name} står på ventelisten`
          : status === 'invited'
            ? `${name} står som ikke svart`
            : `${name} er satt til «${status === 'attending' ? 'Kommer' : 'Kan ikke'}»${guest.userId ? ' og får beskjed' : ''}`,
      );
    } catch {
      toast({ message: 'Kunne ikke endre svaret', tone: 'error' });
    }
  };

  return (
    <PersonSheet
      person={member?.person ?? null}
      onClose={onClose}
      extra={
        guest ? (
          <>
            {canSetAnswer ? (
              <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
                <Text variant="footnote" color="textSecondary">
                  {current === 'waitlisted' ? 'Svaret deres · på ventelisten nå' : 'Svaret deres'}
                  {guest.answerSetBy ? ` · satt av ${guest.answerSetBy}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {ANSWERS.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.label}
                      selected={current === a.id || (a.id === 'attending' && current === 'waitlisted')}
                      onPress={() => pick(a.id)}
                      accessibilityHint={`Setter svaret for ${name}, for eksempel når de har svart på SMS`}
                    />
                  ))}
                </View>
                <Text variant="caption" color="textTertiary">
                  For når {name} har svart på SMS eller muntlig. {guest.userId ? 'De får beskjed og kan endre det selv.' : ''}
                </Text>
              </View>
            ) : null}
            {hasPrice ? (
              <>
                <Divider />
                <ListRow
                  icon="tag"
                  title="Betaler andel"
                  subtitle={guest.paysShare === false ? `${name} har plass, men deler ikke kostnaden` : 'Deler kostnaden med de andre'}
                  trailing={
                    <Toggle
                      value={guest.paysShare !== false}
                      onValueChange={async (v) => {
                        try {
                          await setPays.mutateAsync({ memberId: guest.id, paysShare: v });
                        } catch {
                          toast({ message: 'Kunne ikke lagre', tone: 'error' });
                        }
                      }}
                      accessibilityLabel={`${name} betaler andel`}
                    />
                  }
                />
              </>
            ) : null}
            <ListRow
              icon="user-minus"
              title="Fjern fra arrangementet"
              subtitle="De får ikke beskjed"
              destructive
              onPress={() =>
                confirmDestructive(`Fjerne ${name}?`, 'Invitasjonen slutter å virke. Du kan invitere dem igjen senere.', 'Fjern', async () => {
                  await remove.mutateAsync(guest.id);
                  toast(`${name} er fjernet`);
                  onClose();
                })
              }
            />
          </>
        ) : undefined
      }
    />
  );
}
