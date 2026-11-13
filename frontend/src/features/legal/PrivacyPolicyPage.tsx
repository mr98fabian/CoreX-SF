import { useLanguage } from '@/contexts/LanguageContext';
import { LegalDocument } from './LegalDocument';
import { PRIVACY_COPY } from './privacyCopy';

/** Privacy Policy: Spanish first, English as the fallback. Text lives in privacyCopy.ts. */
export default function PrivacyPolicyPage() {
    const { language } = useLanguage();
    return <LegalDocument copy={PRIVACY_COPY[language === 'en' ? 'en' : 'es']} otherDocPath="/terms" />;
}
