/**
 * Planes (Ajustes › Mi plan): the user's state on top (GET /api/subscriptions/status) and the
 * two commercial plans — Gratis and KoreX Anual — from lib/pricing.ts. Checkout is the Lemon
 * Squeezy annual variant only (POST /api/subscriptions/checkout, plan=freedom, annual).
 * Founder or a current gift (checkout_hidden): state only, nothing to buy.
 * Android build (lib/billing → google_play): Play Billing instead, with Play's localized price,
 * "Restaurar compras" and "Gestionar en Google Play"; that branch never calls the Lemon checkout.
 */
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { AmberRule, BankHeader, StatePhrase } from '@/components/kx';
import { PlanCards } from '@/components/kx/PlanCards';
import { longDate, planLabel, type SubStatus } from '@/lib/planLimits';
import { PAID_KEYS, PAID_PLAN_ID } from '@/lib/pricing';
import { getBillingProvider } from '@/lib/billing';
import { playButtonLabel, usePlayBilling } from '@/hooks/usePlayBilling';
import { PlayStoreActions } from '@/components/PlayStoreActions';

function stateLine(st: SubStatus, es: boolean): string {
    if (st.source === 'demo') return es ? 'Estás en la demo: todo abierto para probar, sin IA.' : "You're in the demo: everything open to try, no AI.";
    if (st.plan === 'founder') return es ? 'Tu cuenta es Fundadora: deudas ilimitadas, IA y todo lo demás, para siempre.' : 'Your account is a Founder account: unlimited debts, AI and everything else, forever.';
    if (st.source === 'grant' && st.grant_ends_at) return es ? `Plan pago regalado, activo hasta el ${longDate(st.grant_ends_at, true)}.` : `Paid plan (gift), active until ${longDate(st.grant_ends_at, false)}.`;
    if (st.source === 'grant') return es ? 'Tu acceso ya está activo.' : 'Your access is already active.';
    if (PAID_KEYS.has(st.plan)) return es ? `${planLabel(st.plan, true)} activo.` : `${planLabel(st.plan, false)} active.`;
    return es ? `Estás en Gratis: hasta ${st.accounts_limit} deudas, sin IA.` : `You're on Free: up to ${st.accounts_limit} debts, no AI.`;
}

export default function PlansPage() {
    const { language, t } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Planes' : 'Plans');
    const { toast } = useToast();
    const { isDemo } = useAuth();
    const [st, setSt] = useState<SubStatus | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const loadStatus = () => { apiFetch<SubStatus>('/api/subscriptions/status').then(setSt).catch(() => undefined); };
    useEffect(loadStatus, []);
    const onPlay = getBillingProvider() === 'google_play';
    const play = usePlayBilling({ enabled: onPlay, onActivated: loadStatus });

    const choose = async () => {
        if (isDemo) {
            toast({ title: es ? 'Crea tu cuenta para elegir un plan' : 'Create your account to choose a plan' });
            return;
        }
        if (onPlay) return play.buy(); // Google Play: no path to Lemon in the Android build
        setBusy(PAID_PLAN_ID);
        try {
            const { checkout_url } = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                method: 'POST', body: JSON.stringify({ plan: PAID_PLAN_ID, billing_cycle: 'annual' }),
            });
            window.location.href = checkout_url;
        } catch {
            toast({ title: es ? 'No pudimos abrir el pago' : "We couldn't open checkout", variant: 'destructive' });
            setBusy(null);
        }
    };

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Planes' : 'Plans'} greeting={es ? 'claros, sin letra chica' : 'clear, no fine print'} />
                <AmberRule />
                <StatePhrase>{es ? 'Empieza gratis. Conecta tu IA cuando pagues.' : 'Start free. Connect your AI when you pay.'}</StatePhrase>
                {st && (
                    <p data-testid="plans-state" className="rounded-xl border border-[var(--kx-line-soft)] p-4 text-[14.5px] text-kx-ink">
                        {stateLine(st, es)}
                    </p>
                )}
                {!st?.checkout_hidden && (onPlay ? (
                    <PlanCards currentPlan={st?.plan} onChoose={choose} busy={play.phase !== 'idle' ? PAID_PLAN_ID : null}
                        ctaLabel={() => playButtonLabel(play, t)}
                        store={{ price: play.priceText, trialLine: play.trialLine, footer: t('billing.footer') }} />
                ) : (
                    <PlanCards currentPlan={st?.plan} onChoose={choose} busy={busy} />
                ))}
                {onPlay && !st?.checkout_hidden && <PlayStoreActions play={play} storeSource={st?.store_source} />}
            </div>
        </div>
    );
}
