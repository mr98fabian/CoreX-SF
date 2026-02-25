/**
 * InterestBleedBanner — Sticky bottom bar (free users only).
 * 
 * Shows real daily interest loss e.g. "💸 Estás perdiendo $13.15/día en intereses"
 * with a CTA to upgrade and stop the bleed.
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
    const [dismissed, setDismissed] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);

    const plan = localStorage.getItem('korex-plan') || 'starter';
    const isFree = plan === 'starter';

    useEffect(() => {
        if (!isFree) return;

        // Check if dismissed within the last 24 hours
        const lastDismissed = localStorage.getItem('korex-bleed-dismissed');
        if (lastDismissed) {
            const elapsed = Date.now() - parseInt(lastDismissed, 10);
            if (elapsed < 24 * 60 * 60 * 1000) {
                setDismissed(true);
                return;
            }
        }

        // Fetch dashboard data to get real daily interest
        apiFetch<{ total_daily_interest?: number }>('/api/dashboard')
            .then((data) => {
                if (data.total_daily_interest && data.total_daily_interest > 0) {
                    setDailyInterest(data.total_daily_interest);
                }
            })
            .catch(() => { /* silent */ });
    }, [isFree]);

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
            <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="bg-gradient-to-r from-rose-950/95 via-red-950/95 to-rose-950/95 backdrop-blur-xl border-t border-rose-500/30 shadow-2xl shadow-rose-900/40">
                    <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                        {/* Left: Loss indicator */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 p-2 rounded-full bg-rose-500/20 animate-pulse">
                                <TrendingDown size={18} className="text-rose-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                    💸 {isEs
                                        ? `Estás perdiendo $${dailyInterest.toFixed(2)}/día en intereses`
                                        : `You're losing $${dailyInterest.toFixed(2)}/day in interest`
                                    }
                                </p>
                                <p className="text-[11px] text-rose-300/70 truncate">
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
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 hover:scale-105 active:scale-95 animate-pulse"
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
