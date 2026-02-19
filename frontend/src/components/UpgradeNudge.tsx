import { useState, useEffect, useMemo } from 'react';
import { ArrowUpRight, X, AlertTriangle, Crown, Sparkles } from 'lucide-react';
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
 * Dismissible, reappears every 2 minutes until the user upgrades.
 * Does not appear for unlimited plan users.
 */
export default function UpgradeNudge() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);

    // Determine context from localStorage
    const plan = localStorage.getItem('corex-plan') || 'starter';
    const isFree = plan === 'starter';
    const isPaid = plan !== 'starter';

    // Don't nudge users with accounts less than 2 days old
    const isNewAccount = useMemo(() => {
        const createdAt = user?.created_at;
        if (!createdAt) return false; // Allow nudge if no date (demo)
        const ageMs = Date.now() - new Date(createdAt).getTime();
        const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
        return ageMs < TWO_DAYS_MS;
    }, [user?.created_at]);

    useEffect(() => {
        if (isPaid || isNewAccount) return;

        // Initial delay of 30 seconds, then every 2 minutes
        const INITIAL_DELAY = 30_000;
        const REPEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

        const initialTimer = setTimeout(() => {
            setVisible(true);
        }, INITIAL_DELAY);

        const interval = setInterval(() => {
            setVisible(true);
        }, REPEAT_INTERVAL);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [isPaid, isNewAccount]);

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
                            className="relative w-full max-w-md pointer-events-auto overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-950/98 backdrop-blur-xl shadow-2xl shadow-amber-900/30 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
                        >
                            {/* Ambient glow effects */}
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-emerald-500/5 pointer-events-none" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/15 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />

                            {/* Top accent bar */}
                            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500" />

                            {/* Dismiss button */}
                            <button
                                onClick={handleDismiss}
                                className="absolute top-4 right-4 z-10 text-slate-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                                aria-label="Dismiss"
                            >
                                <X size={18} />
                            </button>

                            <div className="relative p-8 space-y-6 text-center">
                                {/* Icon */}
                                <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-900/20">
                                    {isFree
                                        ? <Crown size={36} className="text-amber-400" />
                                        : <AlertTriangle size={36} className="text-rose-400" />
                                    }
                                </div>

                                {/* Title */}
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                                        {isFree
                                            ? <>🚀 {t('upgrade.unlockPower')}</>
                                            : t('upgrade.debtsUnmonitored')
                                        }
                                    </h2>
                                    <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
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
                                            { icon: '📊', text: 'Cuentas Ilimitadas' },
                                            { icon: '🛡️', text: 'Peace Shield™' },
                                            { icon: '⚡', text: 'Estrategia Avanzada' },
                                            { icon: '📈', text: 'Reportes PDF' },
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                                <span className="text-base">{f.icon}</span>
                                                <span className="text-xs text-slate-300 font-medium">{f.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* CTA Button */}
                                <button
                                    onClick={handleUpgrade}
                                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-sm font-extrabold transition-all shadow-xl shadow-amber-900/40 hover:shadow-amber-900/60 hover:scale-[1.02] active:scale-[0.98] group"
                                >
                                    <Sparkles size={16} />
                                    {t('upgrade.viewUpgradePlans')}
                                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>

                                {/* Dismiss link */}
                                <button
                                    onClick={handleDismiss}
                                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                                >
                                    Ahora no, gracias
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
