/**
 * Planes (Ajustes › Mi plan): plan cards with limits from the server and the
 * existing Lemon Squeezy checkout (POST /api/subscriptions/checkout; TEST mode
 * until the owner activates live).
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

export default function PlansPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Planes' : 'Plans');
    const { toast } = useToast();
    const { isDemo } = useAuth();
    const [plan, setPlan] = useState<string | undefined>();
    const [st, setSt] = useState<SubStatus | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => { apiFetch<SubStatus>('/api/subscriptions/status').then((s) => { setPlan(s.plan); setSt(s); }).catch(() => undefined); }, []);

    const choose = async (id: string, cycle: 'monthly' | 'annual') => {
        if (isDemo) {
            toast({ title: es ? 'Crea tu cuenta para elegir un plan' : 'Create your account to choose a plan' });
            return;
        }
        setBusy(id);
        try {
            const { checkout_url } = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                method: 'POST', body: JSON.stringify({ plan: id, billing_cycle: cycle }),
            });
            window.location.href = checkout_url;
        } catch {
            toast({ title: es ? 'No pudimos abrir el pago' : "We couldn't open checkout", variant: 'destructive' });
            setBusy(null);
        }
    };

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Planes' : 'Plans'} greeting={es ? 'claros, sin letra chica' : 'clear, no fine print'} />
                <AmberRule />
                <StatePhrase>{es ? 'Empieza gratis. Conecta tu IA cuando pagues.' : 'Start free. Connect your AI when you pay.'}</StatePhrase>
                {st?.checkout_hidden ? (
                    // Founder or a current gift: nothing to buy — show the state, not checkout buttons
                    <p data-testid="plans-state" className="rounded-xl border border-[var(--kx-line-soft)] p-4 text-[14.5px] text-kx-ink">
                        {st.plan === 'founder'
                            ? (es ? 'Tu cuenta es Fundadora: deudas ilimitadas, IA y todo lo demás, para siempre.' : 'Your account is a Founder account: unlimited debts, AI and everything else, forever.')
                            : st.grant_ends_at
                                ? (es ? `Tienes ${planLabel(st.grant_plan, true)} regalado, activo hasta el ${longDate(st.grant_ends_at, true)}.` : `You have ${planLabel(st.grant_plan, false)} as a gift, active until ${longDate(st.grant_ends_at, false)}.`)
                                : (es ? 'Tu acceso ya está activo.' : 'Your access is already active.')}
                    </p>
                ) : (
                    <PlanCards currentPlan={plan === 'freedom-dev' ? 'freedom' : plan} onChoose={choose} busy={busy} />
                )}
            </div>
        </div>
    );
}
