/**
 * Ajustes → Notificaciones, web and app: the notice e-mails switch (GET/PUT /api/push/email).
 * Same notices as push (cuts, the day's mission, paid-off debts), at most one a day across both.
 */
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';

export function EmailToggleRow() {
    const { t } = useLanguage();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        apiFetch<{ enabled: boolean }>('/api/push/email').then((r) => setEnabled(r.enabled)).catch(() => setEnabled(null));
    }, []);

    if (enabled === null) return null;

    const toggle = async (next: boolean) => {
        setBusy(true);
        try {
            const r = await apiFetch<{ enabled: boolean }>('/api/push/email', { method: 'PUT', body: JSON.stringify({ enabled: next }) });
            setEnabled(r.enabled);
        } catch { /* the switch keeps showing the saved state */ } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="email-toggle-row" className="flex items-center justify-between gap-3 rounded-lg border border-kx-line p-3">
            <div className="flex min-w-0 items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 flex-none text-kx-amber" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-kx-ink">{t('email.toggle')}</p>
                    <p className="text-xs text-kx-ink2">{t('email.toggleSub')}</p>
                </div>
            </div>
            <Switch data-testid="email-toggle" checked={enabled} disabled={busy} onCheckedChange={toggle} aria-label={t('email.toggle')} />
        </div>
    );
}
