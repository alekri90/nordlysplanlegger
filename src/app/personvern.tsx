import { LegalPage } from '@/components/LegalPage';
import { PRIVACY } from '@/lib/legal';

export default function Privacy() {
  return <LegalPage title="Personvern" sections={PRIVACY} />;
}
