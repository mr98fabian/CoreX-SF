import { useState, useEffect } from 'react';
import { ArrowUpRight, X, AlertTriangle, Crown, Sparkles, Infinity as InfinityIcon, Shield, Zap, FileText } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';

/**
 * UpgradeNudge — Fullscreen centered modal CTA that appears every 2 minutes.
 *
 * Triggers when:
 *   1. User has locked accounts (plan limit exceeded), OR
 *   2. User is on the free 'starter' plan (gentle nudge to upgrade)
 *
 * Shown at most once per browser session, never while the onboarding tour
 * is open or during the first minutes after entering the dashboard/demo.
 * Does not appear for unlimited plan users.
 */
const SHOWN_KEY = 'korex_upsell_shown';
const FIRST_TOUR_DELAY = 5 * 60 * 1000; // let the first walkthrough finish uninterrupted

export default function UpgradeNudge({ suppressed = false }: { suppressed?: boolean }) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);

    // Determine context from localStorage
    const plan = localStorage.getItem('korex-plan') || 'starter';
    const isFree = plan === 'starter';
    const isPaid = plan !== 'starter';

    const createdAt = user?.created_at;

    useEffect(() => {
        if (isPaid || suppressed) return;
        try {
            if (sessionStorage.getItem(SHOWN_KEY)) return;
        } catch { /* storage blocked: fall through, the timer still limits it */ }

        // Don't nudge users with accounts less than 2 days old
        // (allow nudge if no creation date — demo accounts)
        if (createdAt) {
            const ageMs = Date.now() - new Date(createdAt).getTime();
            const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
            if (ageMs < TWO_DAYS_MS) return;
        }

        const timer = setTimeout(() => {
            try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* ignore */ }
            setVisible(true);
        }, FIRST_TOUR_DELAY);

        return () => clearTimeout(timer);
    }, [isPaid, createdAt, suppressed]);

    const handleDismiss = () => {
        setVisible(false);
    };

    const handleUpgrade = () => {
        setShowUpgrade(true);
        setVisible(false);
    };

    return (
        <>
            {/* ═══ Centered Fullscreen Modal ═══ */}
            {visible && !isPaid && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] animate-in fade-in duration-300"
                        onClick={handleDismiss}
                    />

                    {/* Modal Card */}
                    <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
                        <div
                            className="relative w-full max-w-md pointer-events-auto overflow-hidden rounded-3xl border border-border bg-card animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
                        >
                            {/* Top accent bar */}
                            <div className="h-1.5 bg-kx-amber" />

                            {/* Dismiss button */}
                            <button
                                onClick={handleDismiss}
                                className="absolute top-4 right-4 z-10 text-kx-ink3 hover:text-kx-ink transition-colors p-1.5 rounded-full hover:bg-kx-raised"
                                aria-label="Dismiss"
                            >
                                <X size={18} />
                            </button>

                            <div className="relative p-8 space-y-6 text-center">
                                {/* Icon */}
                                <div className={`mx-auto w-20 h-20 rounded-2xl border flex items-center justify-center ${isFree ? 'bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)]' : 'bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] border-[color-mix(in_srgb,var(--kx-debt)_30%,transparent)]'}`}>
                                    {isFree
                                        ? <Crown size={36} className="text-kx-amber" />
                                        : <AlertTriangle size={36} className="text-kx-debt" />
                                    }
                                </div>

                                {/* Title */}
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-extrabold text-kx-ink tracking-tight">
                                        {isFree
                                            ? t('upgrade.unlockPower')
                                            : t('upgrade.debtsUnmonitored')
                                        }
                                    </h2>
                                    <p className="text-sm text-kx-ink2 leading-relaxed max-w-xs mx-auto">
                                        {isFree
                                            ? t('upgrade.starterNudge')
                                            : t('upgrade.lockedNudge')
                                        }
                                    </p>
                                </div>

                                {/* Feature highlights for free users */}
                                {isFree && (
                                    <div className="grid grid-cols-2 gap-2 text-left">
                                        {[
                                            { Icon: InfinityIcon, text: 'Cuentas Ilimitadas' },
                                            { Icon: Shield, text: 'Peace Shield™' },
                                            { Icon: Zap, text: 'Estrategia Avanzada' },
                                            { Icon: FileText, text: 'Reportes PDF' },
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-kx-surface border border-kx-line">
                                                <f.Icon size={15} className="text-kx-amber shrink-0" strokeWidth={1.75} />
                                                <span className="text-xs text-kx-ink2 font-medium">{f.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* CTA Button */}
                                <button
                                    onClick={handleUpgrade}
                                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-kx-amber hover:bg-ignition-hover text-ignition-ink text-sm font-extrabold transition-colors active:scale-[0.98] group"
                                >
                                    <Sparkles size={16} />
                                    {t('upgrade.viewUpgradePlans')}
                                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>

                                {/* Dismiss link */}
                                <button
                                    onClick={handleDismiss}
                                    className="text-xs text-kx-ink2 hover:text-kx-ink2 transition-colors"
                                >
                                    {t('upgrade.dismissShame')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Upgrade Modal (plan selection) */}
            <UpgradeModal
                open={showUpgrade}
                onOpenChange={setShowUpgrade}
                reason={isFree
                    ? t('upgrade.premiumDesc')
                    : t('upgrade.moreAccountsDesc')
                }
            />
        </>
    );
}
