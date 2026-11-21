/**
 * /oauth/consent?request=<handle> — the screen an assistant (Claude…) sends the user to when
 * it asks to connect to their KoreX (routers/oauth.py). Signed-in only: without a session
 * the user signs in and comes straight back here (lib/returnTo). The grant is whatever the
 * backend validated; labels come from GET /api/tokens/scopes. Payments are never granted.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { clearReturnTo, rememberReturnTo } from '@/lib/returnTo';

interface Details {
    client_name: string;
    redirect_host: string | null;
    scopes: { scope: string; label: string }[];
    blocked: 'demo' | 'free_plan' | null;
}

type Phase = 'loading' | 'ready' | 'working' | 'done' | 'cancelled' | 'expired' | 'failed';

export default function ConsentPage() {
    const { t } = useLanguage();
    usePageTitle(t('oauth.title'));
    const { user, loading } = useAuth();
    const location = useLocation();
    const handle = new URLSearchParams(location.search).get('request') ?? '';
    const [details, setDetails] = useState<Details | null>(null);
    const [labels, setLabels] = useState<Record<string, string>>({});
    const [phase, setPhase] = useState<Phase>('loading');

    useEffect(() => {
        if (!user || !handle) return;
        clearReturnTo();
        Promise.all([
            apiFetch<Details>('/api/oauth/consent/details', { method: 'POST', body: JSON.stringify({ request: handle }) }),
            apiFetch<{ scope: string; label: string }[]>('/api/tokens/scopes').catch(() => []),
        ]).then(([d, all]) => {
            setDetails(d);
            setLabels(Object.fromEntries(all.map((s) => [s.scope, s.label])));
            setPhase('ready');
        }).catch(() => setPhase('expired'));
    }, [user, handle]);

    if (!loading && !user) {
        rememberReturnTo(`${location.pathname}${location.search}`);
        return <Navigate to="/login" replace />;
    }

    const decide = async (approve: boolean) => {
        setPhase('working');
        try {
            const { redirect_to } = await apiFetch<{ redirect_to: string }>(`/api/oauth/consent/${approve ? 'approve' : 'deny'}`, {
                method: 'POST', body: JSON.stringify({ request: handle }),
            });
            setPhase(approve ? 'done' : 'cancelled');
            window.location.assign(redirect_to); // back to the assistant (some leave the user here: the done line covers it)
        } catch {
            setPhase('failed');
        }
    };

    const message = (text: string, testId: string) => (
        <p data-testid={testId} className="rounded-xl border border-[var(--kx-line-soft)] p-4 text-[14.5px] text-kx-ink">{text}</p>
    );

    return (
        <div className="kx-scope min-h-screen bg-kx-bg px-5 py-10">
            <div className="mx-auto max-w-md space-y-5">
                <h1 className="text-xl font-semibold text-kx-ink">{t('oauth.title')}</h1>
                {(!handle || phase === 'expired') && message(t('oauth.expired'), 'consent-expired')}
                {handle && phase === 'loading' && <p className="text-sm text-kx-ink2" aria-busy="true">{t('oauth.loading')}</p>}
                {phase === 'done' && message(t('oauth.done'), 'consent-done')}
                {phase === 'cancelled' && message(t('oauth.cancelled'), 'consent-cancelled')}
                {phase === 'failed' && message(t('oauth.failed'), 'consent-failed')}
                {details && (phase === 'ready' || phase === 'working') && (
                    <div className="space-y-4 rounded-[20px] border border-kx-line bg-kx-surface p-[18px]">
                        <p data-testid="consent-client" className="text-[15px] font-semibold text-kx-ink">
                            {t('oauth.asks').replace('{client}', details.client_name)}
                        </p>
                        {details.redirect_host && <p className="text-xs text-kx-ink3">{t('oauth.via').replace('{host}', details.redirect_host)}</p>}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[.16em] text-kx-ink2">{t('oauth.canDo')}</p>
                            <ul data-testid="consent-scopes" className="mt-2 space-y-1.5 text-[14px] text-kx-ink">
                                {details.scopes.map((s) => (
                                    <li key={s.scope} className="flex gap-2"><span className="font-bold text-kx-paid">✓</span>{labels[s.scope] ?? s.label}</li>
                                ))}
                            </ul>
                        </div>
                        <p data-testid="consent-no-payments" className="text-[14px] font-semibold text-kx-ink">{t('oauth.noPayments')}</p>
                        {details.blocked ? (
                            <div className="space-y-3">
                                <p className="text-sm text-kx-ink2">{details.blocked === 'demo' ? t('oauth.demo') : t('oauth.freePlan')}</p>
                                {details.blocked === 'free_plan' && (
                                    <Link to="/dashboard/settings/plans" className="inline-block rounded-xl bg-kx-amber px-4 py-2.5 text-sm font-bold text-kx-on-amber">{t('oauth.seePlans')}</Link>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button type="button" data-testid="consent-authorize" onClick={() => decide(true)} disabled={phase === 'working'}
                                    className="kx-press flex-1 rounded-xl bg-kx-amber py-3 text-sm font-bold text-kx-on-amber disabled:opacity-50">
                                    {phase === 'working' ? t('oauth.working') : t('oauth.authorize')}
                                </button>
                                <button type="button" data-testid="consent-cancel" onClick={() => decide(false)} disabled={phase === 'working'}
                                    className="kx-press flex-1 rounded-xl border border-kx-line py-3 text-sm font-semibold text-kx-ink disabled:opacity-50">
                                    {t('oauth.cancel')}
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-kx-ink3">{t('oauth.revokeHint')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
