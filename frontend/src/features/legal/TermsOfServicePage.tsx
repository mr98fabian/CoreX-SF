import { useLanguage } from '@/contexts/LanguageContext';
import { LegalDocument } from './LegalDocument';
import { termsCopy } from './termsCopy';

/** Terms of Service: Spanish first, English as the fallback. Text lives in termsCopy.ts. */
export default function TermsOfServicePage() {
    const { language } = useLanguage();
    return <LegalDocument copy={termsCopy(language === 'en' ? 'en' : 'es', new Date().getFullYear())} otherDocPath="/privacy" />;
}
