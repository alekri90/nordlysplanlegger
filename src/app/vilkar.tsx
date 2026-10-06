import { LegalPage } from '@/components/LegalPage';
import { TERMS } from '@/lib/legal';

export default function Terms() {
  return <LegalPage title="Vilkår" sections={TERMS} />;
}
