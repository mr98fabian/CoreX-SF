import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'corex_onboarding_skipped';

interface OnboardingResumePopupProps {
    /** Restart the onboarding wizard */
    onResume: () => void;
}

/**
 * Motivational popup shown when a user skipped the onboarding tutorial.
 * Appears each session until they either complete the tutorial or dismiss it.
 * Uses localStorage to track skip state — no backend migration needed.
 */
export function OnboardingResumePopup({ onResume }: OnboardingResumePopupProps) {
    const { language } = useLanguage();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const wasSkipped = localStorage.getItem(STORAGE_KEY) === 'true';
        if (!wasSkipped) return;

        // Delay appearance to avoid overwhelming the user on page load
        const timer = setTimeout(() => setVisible(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleResume = () => {
        localStorage.removeItem(STORAGE_KEY);
        setVisible(false);
        onResume();
    };

    const handleDismiss = () => {
        setVisible(false);
        // Keep the flag — popup will reappear next session/reload
    };

    return (
        <AnimatePresence>
            {visible && (
                /* Overlay: centered on mobile, bottom-right on sm+ */
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:items-end sm:justify-end sm:p-6"
                >
                    {/* Backdrop — mobile only (tap-to-dismiss) */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
                        onClick={handleDismiss}
                    />

                    {/* Card */}
                    <motion.div
                        initial={{ y: 40, scale: 0.95 }}
                        animate={{ y: 0, scale: 1 }}
                        exit={{ y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-sm"
                    >
                        <div className="relative p-5 rounded-2xl bg-slate-950/95 border border-amber-500/20 shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
                            {/* Close button */}
                            <button
                                onClick={handleDismiss}
                                className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>

                            {/* Content */}
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                                    <Rocket className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-white mb-1">
                                        {language === 'es'
                                            ? '¿Listo para tu carrera millonaria? 🚀'
                                            : 'Ready for your millionaire run? 🚀'}
                                    </h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {language === 'es'
                                            ? 'Completa el tutorial para desbloquear todo el poder del motor de velocidad y acelerar tu libertad financiera.'
                                            : 'Complete the tutorial to unlock the full power of the velocity engine and accelerate your financial freedom.'}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-4">
                                <Button
                                    onClick={handleResume}
                                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs h-8"
                                >
                                    {language === 'es' ? '¡Empezar ahora!' : 'Start now!'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleDismiss}
                                    className="text-slate-500 hover:text-white text-xs h-8"
                                >
                                    {language === 'es' ? 'Después' : 'Later'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
