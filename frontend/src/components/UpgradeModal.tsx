import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Rocket, Crown, Check, Sparkles, TrendingDown, Infinity as InfinityIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Savings estimate shape from backend ───
interface PlanSavings {
    annual_savings: number;
    monthly_savings: number;
    roi_days: number;
    accounts_used: number;
    plan_cost_annual: number;
}
interface SavingsEstimate {
    has_data: boolean;
    total_debt: number;
    plans: Record<string, PlanSavings>;
}

// ─── Plans Data (single source of truth) ───
// Feature keys reference LanguageContext translations
const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        icon: Zap,
        accounts: 2,
        monthly: 0,
        annual: 0,
        color: 'slate',
        gradient: 'from-slate-500 to-slate-600',
        featureKeys: ['upgrade.feature.debtAccounts2', 'upgrade.feature.basicVelocity', 'upgrade.feature.monthlyProjections'],
    },
    {
        id: 'velocity',
        name: 'Velocity',
        icon: Zap,
        accounts: 6,
        monthly: 19.99,
        annual: 96.99,
        color: 'amber',
        gradient: 'from-amber-500 to-orange-500',
        featureKeys: ['upgrade.feature.debtAccounts6', 'upgrade.feature.fullVelocity', 'upgrade.feature.actionPlanGPS', 'upgrade.feature.prioritySupport'],
    },
    {
        id: 'accelerator',
        name: 'Accelerator',
        icon: Rocket,
        accounts: 12,
        monthly: 34.99,
        annual: 196.99,
        color: 'purple',
        gradient: 'from-purple-500 to-indigo-500',
        popular: true,
        featureKeys: ['upgrade.feature.debtAccounts12', 'upgrade.feature.accelerationSim', 'upgrade.feature.advancedAnalytics', 'upgrade.feature.pdfReports', 'upgrade.feature.prioritySupport'],
    },
    {
        id: 'freedom',
        name: 'Freedom',
        icon: Crown,
        accounts: Infinity,
        monthly: 54.99,
        annual: 346.99,
        color: 'yellow',
        gradient: 'from-amber-400 to-yellow-500',
        featureKeys: ['upgrade.feature.unlimitedAccounts', 'upgrade.feature.allAccelerator', 'upgrade.feature.apiAccess', 'upgrade.feature.whiteGlove'],
    },
] as const;

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Optional: highlight a specific reason to upgrade */
    reason?: string;
    /** Current plan ID for disabling the current plan button */
    currentPlan?: string;
}

export default function UpgradeModal({ open, onOpenChange, reason, currentPlan = 'starter' }: UpgradeModalProps) {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const [savings, setSavings] = useState<SavingsEstimate | null>(null);

    // Fetch savings estimate when modal opens
    useEffect(() => {
        if (!open) return;
        apiFetch<SavingsEstimate>('/api/subscriptions/savings-estimate')
            .then(setSavings)
            .catch(() => setSavings(null)); // Silently fail — savings are optional
    }, [open]);

    const handleUpgrade = async (planId: string) => {
        setUpgrading(planId);
        try {
            const data = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                method: 'POST',
                body: JSON.stringify({
                    plan: planId,
                    billing_cycle: billing,
                }),
            });
            const checkoutUrl = data.checkout_url;

            if (!checkoutUrl) {
                throw new Error('No checkout URL returned');
            }

            // Open LemonSqueezy hosted checkout in a new tab
            window.open(checkoutUrl, '_blank');

            toast({
                title: t('upgrade.checkoutOpened'),
                description: t('upgrade.checkoutOpenedDesc'),
            });
            onOpenChange(false);
        } catch {
            toast({
                title: t('upgrade.checkoutFailed'),
                description: t('upgrade.checkoutFailedDesc'),
                variant: 'destructive',
            });
        } finally {
            setUpgrading(null);
        }
    };

    const currentIdx = PLANS.findIndex(p => p.id === currentPlan);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] w-[95vw] bg-zinc-950/98 backdrop-blur-2xl border-zinc-800/60 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 pb-4 bg-gradient-to-b from-emerald-950/30 to-transparent">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={22} className="text-emerald-400" />
                            <DialogTitle className="text-xl font-bold text-white">
                                {t('upgrade.title')}
                            </DialogTitle>
                        </div>
                        {reason === 'rank_boost' ? (
                            <DialogDescription asChild>
                                <div className="flex items-center gap-2.5 mt-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2">
                                    <Crown size={18} className="text-amber-400 shrink-0" />
                                    <span className="text-sm font-semibold text-amber-300">
                                        {t('upgrade.rankBoostReason')}
                                    </span>
                                </div>
                            </DialogDescription>
                        ) : (
                            <DialogDescription className="text-sm sm:text-base text-zinc-400">
                                {reason || t('upgrade.defaultReason')}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {/* Billing Toggle */}
                    <div className="flex items-center gap-2 mt-4">
                        <button
                            onClick={() => setBilling('monthly')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${billing === 'monthly'
                                ? 'bg-zinc-800 text-white border border-zinc-700'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {t('upgrade.monthly')}
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${billing === 'annual'
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {t('upgrade.annual')} <span className="text-emerald-400 ml-1">{t('upgrade.save')} 60%</span>
                        </button>
                    </div>
                </div>

                {/* Plan Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-6">
                    {PLANS.map((plan, idx) => {
                        const Icon = plan.icon;
                        const isCurrent = plan.id === currentPlan;
                        const isDowngrade = idx < currentIdx;
                        const price = billing === 'annual' ? plan.annual : plan.monthly * 12;
                        const monthlyPrice = billing === 'annual'
                            ? (plan.annual / 12).toFixed(0)
                            : plan.monthly;
                        const isPopular = 'popular' in plan && plan.popular;

                        return (
                            <div
                                key={plan.id}
                                className={`relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${isCurrent
                                    ? 'border-emerald-500/40 bg-emerald-950/20 ring-1 ring-emerald-500/20'
                                    : isPopular
                                        ? 'border-purple-500/40 bg-purple-950/10 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/20'
                                        : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60 hover:bg-zinc-900/60'
                                    }`}
                            >
                                {/* Popular Badge */}
                                {isPopular && !isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500 text-white shadow-lg">
                                        {t('upgrade.mostPopular')}
                                    </div>
                                )}

                                {/* Current Badge */}
                                {isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
                                        {t('upgrade.current')}
                                    </div>
                                )}

                                {/* Icon + Name */}
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${plan.gradient} bg-opacity-20`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <span className="text-base font-bold text-white">{plan.name}</span>
                                </div>

                                {/* Price */}
                                <div className="mb-3">
                                    {plan.monthly === 0 ? (
                                        <div className="text-3xl font-black text-white">{t('upgrade.free')}</div>
                                    ) : (
                                        <>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white">${monthlyPrice}</span>
                                                <span className="text-sm text-zinc-500">/mo</span>
                                            </div>
                                            {billing === 'annual' && (
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    ${price}/{t('upgrade.year')} · <span className="text-emerald-400 font-semibold">{t('upgrade.save')} ${plan.monthly * 12 - plan.annual}</span>
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Accounts */}
                                <div className="text-sm text-zinc-400 mb-2 font-medium">
                                    {plan.accounts === Infinity ? t('upgrade.unlimited') : plan.accounts} {t('upgrade.accounts')}
                                    {savings?.has_data && savings.plans[plan.id] && (
                                        <span className="text-zinc-500 ml-1">
                                            · {plan.accounts === Infinity
                                                ? t('upgrade.allDebtsOptimized')
                                                : t('upgrade.topDebtsOptimized').replace('{n}', String(savings.plans[plan.id].accounts_used))}
                                        </span>
                                    )}
                                </div>

                                {/* Interest Savings — shown in both monthly & annual views */}
                                {savings?.has_data && savings.plans[plan.id] && savings.plans[plan.id].annual_savings > 0 && (() => {
                                    const s = savings.plans[plan.id];
                                    const displaySavings = billing === 'monthly'
                                        ? `~$${Math.round(s.monthly_savings).toLocaleString()}/mo`
                                        : `~$${Math.round(s.annual_savings).toLocaleString()}/yr`;
                                    const netGain = s.annual_savings - s.plan_cost_annual;
                                    const isUnlimited = plan.accounts === Infinity;

                                    return (
                                        <div className="mb-3 space-y-2">
                                            {/* Main savings badge — special gold variant for Freedom */}
                                            {isUnlimited ? (
                                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-amber-500/30">
                                                    <div className="flex-shrink-0 p-1 rounded-full bg-amber-500/20">
                                                        <InfinityIcon size={16} className="text-amber-400" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-amber-300 block leading-snug">
                                                            {displaySavings} + {t('upgrade.noLimits')}
                                                        </span>
                                                        <span className="text-xs text-amber-400/70 leading-snug">
                                                            {t('upgrade.futureDebtsCovered')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                    <TrendingDown size={16} className="text-emerald-400 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-sm font-bold text-emerald-400 block leading-snug">
                                                            {displaySavings} {t('upgrade.inInterest')}
                                                        </span>
                                                        <span className="text-xs text-emerald-500/70 leading-snug">
                                                            {billing === 'monthly' ? t('upgrade.savedEachMonth') : t('upgrade.savedEachYear')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Net ROI for paid plans */}
                                            {s.plan_cost_annual > 0 && netGain > 0 && (
                                                <p className="text-xs text-zinc-500 pl-1 leading-snug">
                                                    {t('upgrade.netGain')} <span className={`${isUnlimited ? 'text-amber-400' : 'text-emerald-400'} font-semibold`}>${Math.round(netGain).toLocaleString()}/yr</span> {t('upgrade.afterPlanCost')}
                                                    {s.roi_days > 0 && s.roi_days < 365 && (
                                                        <> · {t('upgrade.paysForItself')} <span className="text-white font-semibold">{s.roi_days} {t('upgrade.days')}</span></>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Features */}
                                <ul className="space-y-2 mb-5 flex-1">
                                    {plan.featureKeys.map((fk, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                            {t(fk)}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <Button
                                    size="default"
                                    disabled={isCurrent || isDowngrade || upgrading !== null}
                                    onClick={() => handleUpgrade(plan.id)}
                                    className={`w-full text-sm h-10 font-semibold ${isCurrent
                                        ? 'bg-emerald-900/30 text-emerald-400 cursor-default border border-emerald-500/20'
                                        : isPopular
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30'
                                            : isDowngrade
                                                ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                                                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                        }`}
                                >
                                    {upgrading === plan.id
                                        ? t('upgrade.processing')
                                        : isCurrent
                                            ? t('upgrade.active')
                                            : isDowngrade
                                                ? t('upgrade.downgrade')
                                                : plan.monthly === 0
                                                    ? t('upgrade.getStarted')
                                                    : t('upgrade.button')
                                    }
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
