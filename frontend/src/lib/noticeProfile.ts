/**
 * Notice e-mails (backend/email_engine.py): the server writes each e-mail in the app's language
 * and keeps quiet hours in the user's time zone, so the app reports both — on every sign-in
 * (PushSetup) and on every language switch (LanguageContext). No Capacitor code: web and app alike.
 */
import { apiFetch } from '@/lib/api';

function appLanguage(): 'es' | 'en' {
    try {
        return localStorage.getItem('korex-language') === 'en' ? 'en' : 'es';
    } catch {
        return 'es';
    }
}

function timeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    } catch {
        return 'America/Chicago';
    }
}

/** Best effort: a failed sync only means the next sign-in tries again. */
export function syncNoticeProfile(): Promise<void> {
    return apiFetch('/api/push/profile', {
        method: 'PUT',
        body: JSON.stringify({ language: appLanguage(), timezone: timeZone() }),
    }).then(() => undefined, () => undefined);
}
