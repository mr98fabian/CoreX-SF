/**
 * Upgrade pitch: one move, Gratis → KoreX Anual. Names and prices from lib/pricing.ts (the
 * only commercial source). The savings line is REAL: the user's plan vs paying only the
 * minimums (compare_paths, the same numbers as Inicio's chart), labelled as an estimate.
 * No comparable data → no savings figure at all.
 * Opened from UpgradeNudge, AccountsPage, ActionPlanPage, Dashboard and Rankings.
 * Android build (lib/billing → google_play): Play Billing with Play's localized price; that
 * branch never calls the Lemon checkout.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { MoneyAmount } from '@/components/MoneyAmount';
import { COMMERCIAL_PLANS, PAID_KEYS, PAID_PLAN_ID } from '@/lib/pricing';
import { usePlanSavings } from '@/hooks/usePlanSavings';
import { getBillingProvider } from '@/lib/billing';
import { playButtonLabel, usePlayBilling } from '@/hooks/usePlayBilling';
import { PlayStoreActions } from '@/components/PlayStoreActions';

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
    const free = COMMERCIAL_PLANS.starter;
    const paid = COMMERCIAL_PLANS[PAID_PLAN_ID];
    const paying = PAID_KEYS.has(currentPlan);

    // Real plan-vs-minimums savings (null when there is nothing to compare)
    const savings = usePlanSavings(open);
    const onPlay = getBillingProvider() === 'google_play';
    const play = usePlayBilling({ enabled: onPlay && open, onActivated: () => onOpenChange(false) });

    const handleUpgrade = async () => {
        if (onPlay) return play.buy(); // Google Play: no path to Lemon in the Android build
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
                            {onPlay ? play.priceText : formatMoney(paid.annual)}<small className="ml-1 text-xs font-normal text-kx-ink2">{es ? '/año' : '/yr'}</small>
                        </p>
                        {onPlay
                            ? play.trialLine && <p className="text-[13px] text-kx-ink">{play.trialLine}</p>
                            : <p className="text-[13px] text-kx-ink">{es ? `1 mes gratis, luego ${formatMoney(paid.annual)}/año` : `1 month free, then ${formatMoney(paid.annual)}/yr`}</p>}
                        <ul className="mt-3 space-y-1.5">
                            {row(true, es ? 'Deudas ilimitadas' : 'Unlimited debts')}
                            {row(true, es ? 'Tu IA conectada' : 'Your AI connected')}
                            {row(true, es ? 'Todo ilimitado' : 'Everything unlimited')}
                        </ul>
                        {savings && (
                            <p data-testid="upgrade-estimate" className="mt-3 text-[12.5px] text-kx-ink2">
                                {es ? 'Con tu plan pagas ' : 'With your plan you pay '}
                                <MoneyAmount value={savings.interest} className="text-kx-paid" />
                                {es ? ' menos de interés que pagando solo el mínimo. Estimado.' : ' less interest than paying only the minimum. Estimate.'}
                            </p>
                        )}
                        <button type="button" onClick={handleUpgrade} disabled={paying || upgrading || (onPlay && play.phase !== 'idle')}
                            className="kx-press mt-4 block w-full rounded-xl bg-kx-amber py-3 text-center text-sm font-bold text-kx-on-amber disabled:opacity-50">
                            {paying ? (es ? 'Tu plan actual' : 'Your current plan') : onPlay ? playButtonLabel(play, t) : upgrading ? t('upgrade.processing') : (es ? 'Empezar mes gratis' : 'Start free month')}
                        </button>
                        {onPlay && <div className="mt-3"><PlayStoreActions play={play} /></div>}
                    </div>
                </div>
                <p className="px-6 pb-6 text-center text-xs text-kx-ink3">{onPlay ? t('billing.footer') : (es ? 'Cancela durante el mes gratis y no se cobra nada. Precios en USD.' : 'Cancel during the free month and nothing is charged. Prices in USD.')}</p>
            </DialogContent>
        </Dialog>
    );
}
