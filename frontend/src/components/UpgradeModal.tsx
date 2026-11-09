/**
 * Upgrade pitch: one move, Gratis → KoreX Anual. Names and prices from lib/pricing.ts (the
 * only commercial source); the interest-savings estimate comes from the engine
 * (GET /api/subscriptions/savings-estimate, plans.freedom) and is labelled as an estimate.
 * Opened from UpgradeNudge, AccountsPage, ActionPlanPage, Dashboard and Rankings.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { COMMERCIAL_PLANS, PAID_KEYS, PAID_PLAN_ID } from '@/lib/pricing';

interface PlanSavings { annual_savings: number; roi_days: number; plan_cost_annual: number }
interface SavingsEstimate { has_data: boolean; plans: Record<string, PlanSavings> }

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Optional: highlight a specific reason to upgrade */
    reason?: string;
    /** Current plan key; any paid key disables the checkout button */
    currentPlan?: string;
}

export default function UpgradeModal({ open, onOpenChange, reason, currentPlan = 'starter' }: UpgradeModalProps) {
    const { toast } = useToast();
    const { t, language } = useLanguage();
    const es = language === 'es';
    const { formatMoney } = useFormatMoney();
    const [upgrading, setUpgrading] = useState(false);
    const [savings, setSavings] = useState<SavingsEstimate | null>(null);
    const free = COMMERCIAL_PLANS.starter;
    const paid = COMMERCIAL_PLANS[PAID_PLAN_ID];
    const paying = PAID_KEYS.has(currentPlan);

    useEffect(() => {
        if (!open) return;
        apiFetch<SavingsEstimate>('/api/subscriptions/savings-estimate')
            .then(setSavings)
            .catch(() => setSavings(null)); // optional
    }, [open]);

    const handleUpgrade = async () => {
        setUpgrading(true);
        try {
            const data = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                method: 'POST',
                body: JSON.stringify({ plan: PAID_PLAN_ID, billing_cycle: 'annual' }),
            });
            if (!data.checkout_url) throw new Error('No checkout URL returned');
            window.open(data.checkout_url, '_blank'); // Lemon Squeezy hosted checkout
            toast({ title: t('upgrade.checkoutOpened'), description: t('upgrade.checkoutOpenedDesc') });
            onOpenChange(false);
        } catch {
            toast({ title: t('upgrade.checkoutFailed'), description: t('upgrade.checkoutFailedDesc'), variant: 'destructive' });
        } finally {
            setUpgrading(false);
        }
    };

    const s = savings?.has_data ? savings.plans[PAID_PLAN_ID] : undefined;
    const net = s ? s.annual_savings - s.plan_cost_annual : 0;
    const row = (ok: boolean, text: string) => (
        <li className="flex items-start gap-2 text-[13.5px] text-kx-ink2">
            {ok ? <Check size={15} strokeWidth={1.75} className="mt-0.5 flex-none text-kx-paid" /> : <X size={15} strokeWidth={1.75} className="mt-0.5 flex-none text-kx-ink3" />}
            {text}
        </li>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="kx-scope max-h-[90vh] w-[95vw] overflow-y-auto border-kx-line bg-kx-bg p-0 sm:max-w-[640px]">
                <div className="p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-kx-ink">
                            {es ? `Pasa a ${paid.name.es}` : `Go ${paid.name.en}`}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-kx-ink2">
                            {reason === 'rank_boost' ? t('upgrade.rankBoostReason') : (reason || t('upgrade.defaultReason'))}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="grid grid-cols-1 gap-4 px-6 pb-6 sm:grid-cols-2">
                    <div data-testid="upgrade-free" className="rounded-[20px] border border-kx-line bg-kx-surface p-[18px]">
                        <p className="text-xs font-bold uppercase tracking-[.16em] text-kx-ink2">{es ? free.name.es : free.name.en}</p>
                        <p className="kx-num mt-1 text-[26px] font-light text-kx-ink">{formatMoney(free.annual)}</p>
                        <ul className="mt-3 space-y-1.5">
                            {row(true, es ? 'Hasta 2 deudas' : 'Up to 2 debts')}
                            {row(true, es ? 'Calendario de deuda mes a mes' : 'Month-by-month debt calendar')}
                            {row(false, es ? 'Sin IA conectada' : 'No AI connection')}
                        </ul>
                    </div>

                    <div data-testid="upgrade-paid" className="kx-elev-1 rounded-[20px] border border-[rgba(245,158,11,.55)] bg-kx-surface p-[18px]">
                        <p className="text-xs font-bold uppercase tracking-[.16em] text-kx-amber-soft">{es ? paid.name.es : paid.name.en}</p>
                        <p className="kx-num mt-1 text-[34px] font-light text-kx-ink">
                            {formatMoney(paid.annual)}<small className="ml-1 text-xs font-normal text-kx-ink2">{es ? '/año' : '/yr'}</small>
                        </p>
                        <p className="text-[13px] text-kx-ink">{es ? `1 mes gratis, luego ${formatMoney(paid.annual)}/año` : `1 month free, then ${formatMoney(paid.annual)}/yr`}</p>
                        <ul className="mt-3 space-y-1.5">
                            {row(true, es ? 'Deudas ilimitadas' : 'Unlimited debts')}
                            {row(true, es ? 'Tu IA conectada' : 'Your AI connected')}
                            {row(true, es ? 'Todo ilimitado' : 'Everything unlimited')}
                        </ul>
                        {s && s.annual_savings > 0 && (
                            <p data-testid="upgrade-estimate" className="mt-3 text-[12.5px] text-kx-ink2">
                                {es ? 'Estimación: ' : 'Estimate: '}
                                <span className="kx-num text-kx-paid">~{formatMoney(Math.round(s.annual_savings))}</span>
                                {es ? ' al año en intereses' : ' a year in interest'}
                                {net > 0 && (es ? `, ~${formatMoney(Math.round(net))} netos tras el plan.` : `, ~${formatMoney(Math.round(net))} net after the plan.`)}
                            </p>
                        )}
                        <button type="button" onClick={handleUpgrade} disabled={paying || upgrading}
                            className="kx-press mt-4 block w-full rounded-xl bg-kx-amber py-3 text-center text-sm font-bold text-[#111418] disabled:opacity-50">
                            {paying ? (es ? 'Tu plan actual' : 'Your current plan') : upgrading ? t('upgrade.processing') : (es ? 'Empezar mes gratis' : 'Start free month')}
                        </button>
                    </div>
                </div>
                <p className="px-6 pb-6 text-center text-xs text-kx-ink3">{es ? 'Cancela durante el mes gratis y no se cobra nada. Precios en USD.' : 'Cancel during the free month and nothing is charged. Prices in USD.'}</p>
            </DialogContent>
        </Dialog>
    );
}
