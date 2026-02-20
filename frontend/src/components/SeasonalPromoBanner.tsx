/**
 * SeasonalPromoBanner — Configurable promo bar for seasonal campaigns.
 *
 * Shows a dismissible top banner with countdown timer and themed styling.
 * Driven by a simple config object — swap the promo without touching code.
 *
 * Usage: Add to DashboardLayout alongside other global components.
 * The promo auto-hides when:
 *   1. User dismisses it (stored in localStorage for 24h)
 *   2. The promo end date passes
 *   3. No active promo is configured
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, ArrowUpRight } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';

// ─── PROMO CONFIG — Edit this object to change the active promotion ───
// Set to `null` to disable all promos
const ACTIVE_PROMO: PromoConfig | null = {
    id: 'launch-2026',
    title: '🚀 Launch Special',
    subtitle: 'First 100 users get 40% off any plan',
    ctaText: 'Claim Offer',
    // Gradient for the banner background
    gradient: 'from-violet-600/95 via-purple-600/95 to-indigo-600/95',
    accentColor: 'violet',
    borderColor: 'border-violet-400/30',
    // End date — banner auto-hides after this
    endDate: new Date('2026-06-01T23:59:59'),
    // Promo code to show in upgrade modal
    promoCode: 'LAUNCH40',
};

interface PromoConfig {
    id: string;
    title: string;
    subtitle: string;
    ctaText: string;
    gradient: string;
    accentColor: string;
    borderColor: string;
    endDate: Date;
    promoCode?: string;
}

export function SeasonalPromoBanner() {
    const [dismissed, setDismissed] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');

    // Check if promo is active and not expired
    const isActive = useMemo(() => {
        if (!ACTIVE_PROMO) return false;
        return new Date() < ACTIVE_PROMO.endDate;
    }, []);

    // Check if dismissed within 24h
    useEffect(() => {
        if (!ACTIVE_PROMO) return;
        const key = `corex-promo-dismissed-${ACTIVE_PROMO.id}`;
        const lastDismissed = localStorage.getItem(key);
        if (lastDismissed) {
            const elapsed = Date.now() - parseInt(lastDismissed, 10);
            if (elapsed < 24 * 60 * 60 * 1000) {
                setDismissed(true);
            }
        }
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!ACTIVE_PROMO || !isActive) return;

        const updateCountdown = () => {
            const diff = ACTIVE_PROMO.endDate.getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('');
                return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h left`);
            } else {
                setTimeLeft(`${hours}h ${mins}m left`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60_000);
        return () => clearInterval(interval);
    }, [isActive]);

    const handleDismiss = () => {
        if (!ACTIVE_PROMO) return;
        setDismissed(true);
        localStorage.setItem(`corex-promo-dismissed-${ACTIVE_PROMO.id}`, String(Date.now()));
    };

    if (!ACTIVE_PROMO || !isActive || dismissed) return null;

    const plan = localStorage.getItem('corex-plan') || 'starter';
    if (plan !== 'starter') return null; // Only show to free users

    return (
        <>
            <div className="fixed top-[4.5rem] left-0 right-0 z-[90] animate-in slide-in-from-top-4 fade-in duration-500">
                <div className={`bg-gradient-to-r ${ACTIVE_PROMO.gradient} backdrop-blur-xl border-b ${ACTIVE_PROMO.borderColor} shadow-lg`}>
                    <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Sparkles size={18} className="text-white/90 flex-shrink-0 animate-pulse" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                    {ACTIVE_PROMO.title}
                                    {timeLeft && (
                                        <span className="ml-2 text-[11px] font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                                            ⏰ {timeLeft}
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-white/60 truncate">{ACTIVE_PROMO.subtitle}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowUpgrade(true)}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                            >
                                {ACTIVE_PROMO.ctaText}
                                <ArrowUpRight size={14} />
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
                reason={`${ACTIVE_PROMO.title} — ${ACTIVE_PROMO.subtitle}`}
            />
        </>
    );
}
