import { useState, useEffect } from 'react';
import { Lock, ArrowUpRight, X, AlertTriangle, Crown } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * UpgradeNudge — Floating CTA toast that slides in after a delay.
 *
 * Triggers when:
 *   1. User has locked accounts (plan limit exceeded), OR
 *   2. User is on the free 'starter' plan (gentle nudge to upgrade)
 *
 * Dismissible, only appears once per session (uses sessionStorage).
 * Appears after 30 seconds to avoid interrupting the user's flow.
 */
export default function UpgradeNudge() {
    const { t } = useLanguage();
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);

    // Determine context from localStorage
    const plan = localStorage.getItem('corex-plan') || 'starter';
    const isFree = plan === 'starter';
    const isUnlimited = plan === 'freedom' || plan === 'freedom-dev';

    useEffect(() => {
        // Don't show for unlimited plans or if already dismissed this session
        if (isUnlimited) return;
        if (sessionStorage.getItem('corex-nudge-dismissed')) return;

        const timer = setTimeout(() => {
            setVisible(true);
        }, 30_000); // 30 seconds delay

        return () => clearTimeout(timer);
    }, [isUnlimited]);

    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('corex-nudge-dismissed', '1');
        // Animate out, then hide
        setTimeout(() => setVisible(false), 400);
    };

    const handleUpgrade = () => {
        setShowUpgrade(true);
        handleDismiss();
    };

    if (!visible || isUnlimited) return (
        <UpgradeModal
            open={showUpgrade}
            onOpenChange={setShowUpgrade}
            reason={isFree
                ? t('upgrade.premiumDesc')
                : t('upgrade.moreAccountsDesc')
            }
        />
    );

    return (
        <>
            {/* Floating Toast */}
            <div
                className={`fixed bottom-6 right-6 z-30 max-w-sm transition-all duration-500 ease-out pointer-events-none ${dismissed
                    ? 'translate-y-4 opacity-0'
                    : 'translate-y-0 opacity-100'
                    }`}
                style={{ animation: dismissed ? 'none' : 'slideInUp 0.5s ease-out' }}
            >
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-amber-900/20 pointer-events-auto">
                    {/* Ambient glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-rose-500/5 pointer-events-none" />
                    <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                    {/* Dismiss button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-3 right-3 z-10 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>

                    <div className="relative p-4 space-y-3">
                        {/* Icon + Title */}
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isFree
                                ? 'bg-amber-500/10 border border-amber-500/20'
                                : 'bg-rose-500/10 border border-rose-500/20'
                                }`}>
                                {isFree
                                    ? <Crown size={18} className="text-amber-400" />
                                    : <AlertTriangle size={18} className="text-rose-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">
                                    {isFree
                                        ? t('upgrade.unlockPower')
                                        : t('upgrade.debtsUnmonitored')
                                    }
                                </p>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                    {isFree
                                        ? t('upgrade.starterNudge')
                                        : t('upgrade.lockedNudge')
                                    }
                                </p>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={handleUpgrade}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition-all shadow-lg shadow-amber-900/30 hover:shadow-amber-900/50 group"
                        >
                            <Lock size={12} />
                            {t('upgrade.viewUpgradePlans')}
                            <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <UpgradeModal
                open={showUpgrade}
                onOpenChange={setShowUpgrade}
                reason={isFree
                    ? t('upgrade.premiumDesc')
                    : t('upgrade.moreAccountsDesc')
                }
            />

            {/* Keyframe animation */}
            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(20px) translateX(0); opacity: 0; }
                    to { transform: translateY(0) translateX(0); opacity: 1; }
                }
            `}</style>
        </>
    );
}
