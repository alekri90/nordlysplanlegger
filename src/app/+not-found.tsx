import { router } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <EmptyState icon="compass" title="Her var det tomt" body="Siden finnes ikke, eller lenken er gammel." action="Til forsiden" onAction={() => router.replace('/')} />
    </Screen>
  );
}
