/**
 * InterestBleedBanner — Inline dashboard banner (free users only).
 *
 * Shows real daily interest loss e.g. "Estás perdiendo $13.15/día en intereses"
 * with a CTA to upgrade and stop the bleed. Rendered inline at the top of
 * the dashboard — no longer a fixed overlay.
 *
 * Psychology: Loss aversion + urgency + real data = high conversion.
 * Source: neuromarketing-conversion skill §2
 */
import { useState, useEffect } from 'react';
import { X, TrendingDown, ArrowUpRight } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';

export function InterestBleedBanner() {
    const { language } = useLanguage();
    const [dailyInterest, setDailyInterest] = useState<number | null>(null);
    // Dismissed within the last 24 hours?
    const [dismissed, setDismissed] = useState(() => {
        const lastDismissed = localStorage.getItem('korex-bleed-dismissed');
        if (!lastDismissed) return false;
        return Date.now() - parseInt(lastDismissed, 10) < 24 * 60 * 60 * 1000;
    });
    const [showUpgrade, setShowUpgrade] = useState(false);

    const plan = localStorage.getItem('korex-plan') || 'starter';
    const isFree = plan === 'starter';

    useEffect(() => {
        if (!isFree || dismissed) return;

        // Fetch dashboard data to get real daily interest
        apiFetch<{ total_daily_interest?: number }>('/api/dashboard')
            .then((data) => {
                if (data.total_daily_interest && data.total_daily_interest > 0) {
                    setDailyInterest(data.total_daily_interest);
                }
            })
            .catch(() => { /* silent */ });
    }, [isFree, dismissed]);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('korex-bleed-dismissed', String(Date.now()));
    };

    // Don't show if: paid user, dismissed, or no interest data
    if (!isFree || dismissed || !dailyInterest || dailyInterest <= 0) return null;

    const isEs = language === 'es';
    const monthlyLoss = (dailyInterest * 30).toFixed(0);
    const yearlyLoss = (dailyInterest * 365).toFixed(0);

    return (
        <>
            <div className="animate-in fade-in duration-500">
                <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-l-2 border-l-rose-500 border-border">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                        {/* Left: Loss indicator */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 p-2 rounded-full bg-rose-500/10">
                                <TrendingDown size={18} className="text-rose-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">
                                    {isEs
                                        ? `Estás perdiendo $${dailyInterest.toFixed(2)}/día en intereses`
                                        : `You're losing $${dailyInterest.toFixed(2)}/day in interest`
                                    }
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {isEs
                                        ? `= $${monthlyLoss}/mes · $${yearlyLoss}/año que le regalas al banco`
                                        : `= $${monthlyLoss}/mo · $${yearlyLoss}/yr gifted to the bank`
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Right: CTA + Dismiss */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowUpgrade(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ignition hover:bg-ignition-hover text-ignition-ink text-xs font-bold transition-colors active:scale-95"
                            >
                                {isEs ? 'Detener sangría' : 'Stop the bleed'}
                                <ArrowUpRight size={14} />
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 rounded-full text-rose-400/50 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label="Dismiss"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <UpgradeModal
                open={showUpgrade}
                onOpenChange={setShowUpgrade}
                reason={isEs
                    ? `Estás perdiendo $${yearlyLoss}/año en intereses. Nuestro Velocity Engine puede reducir eso hasta 70%.`
                    : `You're losing $${yearlyLoss}/yr in interest. Our Velocity Engine can reduce that by up to 70%.`
                }
            />
        </>
    );
}
