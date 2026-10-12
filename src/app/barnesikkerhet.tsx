import { LegalPage } from '@/components/LegalPage';
import { CHILD_SAFETY } from '@/lib/legal';

/** Child safety standards, public (Google Play requires a published page). */
export default function ChildSafety() {
  return <LegalPage title="Barns sikkerhet" sections={CHILD_SAFETY} contactFirst />;
}
