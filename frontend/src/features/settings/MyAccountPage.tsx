/**
 * Ajustes → Mi Cuenta: the account's email and plan, and at the end the danger zone (#eliminar).
 * Deleting is two plain steps — what gets erased (and a store-subscription warning when one is
 * paid), then the password (or, for Google-only accounts, the email) and "Eliminar para siempre".
 * Cancel is visible on both steps. DELETE /api/user/me does the real deletion (routers/account.py);
 * then the session ends and the login says so.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch, ApiError } from '@/lib/api';
import { AmberRule, BankHeader, Section } from '@/components/kx';
import { planLabel, type SubStatus } from '@/lib/planLimits';
import { PAID_KEYS } from '@/lib/pricing';
import { clearReturnTo } from '@/lib/returnTo';

const BILLED = new Set(['active', 'on_trial', 'past_due', 'cancelled']);

export default function MyAccountPage() {
    const { t, language } = useLanguage();
    const es = language === 'es';
    usePageTitle(t('account.title'));
    const { user, isDemo, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState<SubStatus | null>(null);
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [secret, setSecret] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { apiFetch<SubStatus>('/api/subscriptions/status').then(setStatus).catch(() => setStatus(null)); }, []);
    useEffect(clearReturnTo, []); // arrived (maybe from /eliminar-cuenta → login): the return is spent
    useEffect(() => {
        if (location.hash !== '#eliminar') return;
        const id = window.setTimeout(() => document.getElementById('eliminar')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
        return () => window.clearTimeout(id);
    }, [location.hash]);

    // Accounts that only sign in with Google have no password: they confirm with their email
    const providers = new Set<string>([
        ...((user?.app_metadata?.providers as string[] | undefined) ?? []),
        ...((user?.identities ?? []).map((i) => i.provider)),
    ]);
    const hasPassword = providers.size === 0 || providers.has('email');
    const paying = !!status && status.source === 'subscription' && PAID_KEYS.has(status.plan) && BILLED.has(status.status);
    const storeWarning = paying ? (status?.store_source === 'google_play' ? t('account.playWarning') : t('account.webWarning')) : null;

    const cancel = () => { setStep(0); setSecret(''); setError(null); };

    const deleteForever = async () => {
        setBusy(true);
        setError(null);
        try {
            await apiFetch('/api/user/me', {
                method: 'DELETE',
                body: JSON.stringify(hasPassword ? { password: secret } : { confirm_email: secret }),
            });
            try { await signOut(); } catch { /* the login no longer exists: the local session is cleared anyway */ }
            navigate('/login?cuenta=eliminada', { replace: true });
        } catch (e) {
            const status403 = e instanceof ApiError && e.status === 403;
            setError(status403 ? (hasPassword ? t('account.wrongPassword') : t('account.wrongEmail')) : t('account.failed'));
            setBusy(false);
        }
    };

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={t('account.title')} greeting={user?.user_metadata?.full_name || ''} />
                <AmberRule />

                <Section tone="neutral" title={t('account.title')}>
                    <dl className="space-y-3 text-[14.5px]">
                        <div>
                            <dt className="text-xs text-kx-ink2">{t('account.email')}</dt>
                            <dd data-testid="account-email" className="font-semibold text-kx-ink break-all">{user?.email ?? ''}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-kx-ink2">{t('account.plan')}</dt>
                            <dd data-testid="account-plan" className="font-semibold text-kx-ink">{status ? planLabel(status.plan, es) : '…'}</dd>
                        </div>
                    </dl>
                </Section>

                <section id="eliminar" data-testid="danger-zone" className="space-y-4 rounded-[20px] border border-[color-mix(in_srgb,var(--kx-debt)_40%,transparent)] p-[18px]">
                    <p className="text-xs font-bold uppercase tracking-[.16em] text-kx-debt">{t('account.danger')}</p>
                    {isDemo ? (
                        <p className="text-sm text-kx-ink2">{t('account.demo')}</p>
                    ) : step === 0 ? (
                        <button type="button" data-testid="delete-start" onClick={() => setStep(1)}
                            className="kx-press w-full rounded-xl border border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] py-3 text-sm font-bold text-kx-debt">
                            {t('account.delete')}
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <p data-testid="delete-what" className="text-[14px] text-kx-ink">{t('account.deleteWhat')}</p>
                            {storeWarning && (
                                <p data-testid="delete-store-warning" role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--kx-amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--kx-amber)_8%,transparent)] p-3 text-[13.5px] font-semibold text-kx-ink">
                                    {storeWarning}
                                </p>
                            )}
                            {step === 2 && (
                                <label className="block space-y-1.5">
                                    <span className="text-sm text-kx-ink2">{hasPassword ? t('account.passwordLabel') : t('account.emailLabel')}</span>
                                    <input data-testid="delete-secret" type={hasPassword ? 'password' : 'email'} autoComplete={hasPassword ? 'current-password' : 'email'}
                                        value={secret} onChange={(e) => setSecret(e.target.value)}
                                        className="w-full rounded-xl border border-kx-line bg-kx-surface px-3 py-3 text-[15px] text-kx-ink" />
                                </label>
                            )}
                            {error && <p data-testid="delete-error" role="alert" className="text-sm font-semibold text-kx-debt">{error}</p>}
                            <div className="flex gap-3">
                                {step === 1 ? (
                                    <button type="button" data-testid="delete-continue" onClick={() => setStep(2)}
                                        className="kx-press flex-1 rounded-xl bg-[var(--kx-debt)] py-3 text-sm font-bold text-white">
                                        {t('account.continue')}
                                    </button>
                                ) : (
                                    <button type="button" data-testid="delete-forever" onClick={deleteForever} disabled={busy || !secret.trim()}
                                        className="kx-press flex-1 rounded-xl bg-[var(--kx-debt)] py-3 text-sm font-bold text-white disabled:opacity-50">
                                        {busy ? t('account.deleting') : t('account.deleteForever')}
                                    </button>
                                )}
                                <button type="button" data-testid="delete-cancel" onClick={cancel} disabled={busy}
                                    className="kx-press flex-1 rounded-xl border border-kx-line py-3 text-sm font-semibold text-kx-ink">
                                    {t('account.cancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
