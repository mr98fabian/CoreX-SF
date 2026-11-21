/**
 * Ajustes → Notificaciones, Android app only: one switch that reflects the system permission AND
 * the user's preference (GET/PUT /api/push/preferences). Blocked in the system → the switch opens
 * the phone's notification settings (only the system can undo a denial).
 */
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import { AppSettings, isAndroidApp, pushPermission, requestPush, startPush, type PushPermission } from '@/lib/push';

export function PushToggleRow() {
    const { t } = useLanguage();
    const [permission, setPermission] = useState<PushPermission | null>(null);
    const [enabled, setEnabled] = useState(true);
    const [busy, setBusy] = useState(false);
    const android = isAndroidApp();

    useEffect(() => {
        if (!android) return;
        pushPermission().then(setPermission).catch(() => setPermission('prompt'));
        apiFetch<{ enabled: boolean }>('/api/push/preferences').then((r) => setEnabled(r.enabled)).catch(() => undefined);
    }, [android]);

    if (!android || permission === null) return null;

    const on = permission === 'granted' && enabled;
    const save = (value: boolean) => apiFetch<{ enabled: boolean }>('/api/push/preferences', { method: 'PUT', body: JSON.stringify({ enabled: value }) })
        .then((r) => setEnabled(r.enabled));

    const toggle = async (next: boolean) => {
        setBusy(true);
        try {
            if (!next) {
                await save(false);
            } else if (permission === 'denied') {
                await AppSettings.openNotificationSettings();
            } else {
                const granted = permission === 'granted' ? 'granted' : await requestPush();
                setPermission(granted);
                if (granted === 'granted') {
                    await startPush();
                    await save(true);
                }
            }
        } catch { /* the switch keeps showing the real state */ } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="push-toggle-row" className="flex items-center justify-between gap-3 rounded-lg border border-kx-line p-3">
            <div className="flex min-w-0 items-start gap-3">
                <Bell className="mt-0.5 h-4 w-4 flex-none text-kx-amber" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-kx-ink">{t('push.toggle')}</p>
                    <p className="text-xs text-kx-ink2">{permission === 'denied' ? t('push.deniedSub') : t('push.toggleSub')}</p>
                </div>
            </div>
            <Switch data-testid="push-toggle" checked={on} disabled={busy} onCheckedChange={toggle} aria-label={t('push.toggle')} />
        </div>
    );
}
