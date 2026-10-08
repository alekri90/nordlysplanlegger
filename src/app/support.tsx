import { LegalPage } from '@/components/LegalPage';
import { SUPPORT } from '@/lib/legal';

/** Support page for the App Store listing (support URL) and Profil → Hjelp og kontakt. */
export default function Support() {
  return <LegalPage title="Hjelp og kontakt" sections={SUPPORT} contactFirst />;
}
