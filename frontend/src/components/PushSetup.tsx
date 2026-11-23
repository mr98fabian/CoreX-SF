/**
 * Android app only. After sign-in: re-registers the push token when the permission is granted
 * (so a new token or time zone reaches the server), and — once in the app's life, only if the
 * system hasn't been asked yet — shows our own screen explaining the benefit BEFORE the system
 * dialog. "Ahora no" is final: it is never shown automatically again (Ajustes can still turn it on).
 * Tapping a notice opens its destination (payload `data.route`).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { syncNoticeProfile } from '@/lib/noticeProfile';
import { isAndroidApp, markPushAsked, onNoticeTap, pushAsked, pushPermission, requestPush, serverCanPush, startPush } from '@/lib/push';

export function PushSetup() {
    const { user, isDemo } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [ask, setAsk] = useState(false);
    const signedIn = !!user && !isDemo;

    // Every platform: the language and time zone notice e-mails are written in
    useEffect(() => {
        if (signedIn) void syncNoticeProfile();
    }, [signedIn]);

    useEffect(() => {
        if (!isAndroidApp() || !signedIn) return;
        let cancelled = false;
        let removeTap: (() => void) | null = null;
        onNoticeTap((path) => navigate(path)).then((r) => { removeTap = r; }).catch(() => undefined);
        (async () => {
            if (!(await serverCanPush()) || cancelled) return;
            const permission = await pushPermission();
            if (permission === 'granted') await startPush();
            else if (permission === 'prompt' && pushAsked() === null && !cancelled) setAsk(true);
        })().catch(() => undefined);
        return () => { cancelled = true; removeTap?.(); };
    }, [signedIn, navigate]);

    if (!ask) return null;

    const answer = async (yes: boolean) => {
        markPushAsked(yes ? 'yes' : 'no');
        setAsk(false);
        if (yes) await requestPush().catch(() => undefined);
    };

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="push-pre-title" data-testid="push-pre"
            className="kx-scope fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <div className="w-full max-w-sm space-y-4 rounded-[20px] border border-kx-line bg-kx-surface p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--kx-amber)_15%,transparent)]">
                    <Bell className="h-5 w-5 text-kx-amber" />
                </div>
                <h2 id="push-pre-title" className="text-lg font-semibold text-kx-ink">{t('push.preTitle')}</h2>
                <p className="text-[14.5px] text-kx-ink2">{t('push.preBody')}</p>
                <div className="flex gap-3">
                    <button type="button" data-testid="push-pre-yes" onClick={() => answer(true)}
                        className="kx-press flex-1 rounded-xl bg-kx-amber py-3 text-sm font-bold text-kx-on-amber">{t('push.preYes')}</button>
                    <button type="button" data-testid="push-pre-no" onClick={() => answer(false)}
                        className="kx-press flex-1 rounded-xl border border-kx-line py-3 text-sm font-semibold text-kx-ink">{t('push.preNo')}</button>
                </div>
            </div>
        </div>
    );
}
