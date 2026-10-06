import { Redirect, useLocalSearchParams } from 'expo-router';

import { ResultsView } from '@/components/event/ResultsView';
import { ErrorState, PageSkeleton, Screen } from '@/components/ui';
import { useEvent } from '@/data/hooks';

/** Direct link to the results (e.g. from a notification). */
export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  if (event.isLoading) return <Screen><PageSkeleton /></Screen>;
  if (!event.data) return <Screen><ErrorState onRetry={() => event.refetch()} /></Screen>;
  if (event.data.status !== 'polling') return <Redirect href={`/event/${id}`} />;
  return <ResultsView event={event.data} />;
}
