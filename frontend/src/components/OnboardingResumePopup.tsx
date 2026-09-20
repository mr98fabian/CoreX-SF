import { useState } from 'react';
import { Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'korex_onboarding_skipped';

interface OnboardingResumePopupProps {
    /** Restart the onboarding wizard */
    onResume: () => void;
}

/**
 * Inline dashboard card shown when a user skipped the onboarding tutorial.
 * Replaces the old floating popup to reduce modal fatigue.
 * Uses localStorage to track skip state — no backend migration needed.
 */
export function OnboardingResumePopup({ onResume }: OnboardingResumePopupProps) {
    const { language } = useLanguage();
    const [dismissed, setDismissed] = useState(false);

    const wasSkipped = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!wasSkipped || dismissed) return null;

    const handleResume = () => {
        localStorage.removeItem(STORAGE_KEY);
        onResume();
    };

    return (
        <div className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 animate-in fade-in duration-500">
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-2 right-2 text-gray-400 hover:text-foreground transition-colors"
                aria-label={language === 'es' ? 'Descartar' : 'Dismiss'}
            >
                <X size={14} />
            </button>

            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Rocket className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0 pr-5">
                    <h3 className="text-sm font-semibold text-foreground">
                        {language === 'es'
                            ? 'Completa la configuración inicial'
                            : 'Finish the initial setup'}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {language === 'es'
                            ? 'El tutorial te muestra cómo sacar el máximo provecho al motor de velocidad.'
                            : 'The tutorial shows you how to get the most out of the velocity engine.'}
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={handleResume}
                    className="flex-shrink-0 text-xs h-8"
                >
                    {language === 'es' ? 'Reanudar' : 'Resume'}
                </Button>
            </div>
        </div>
    );
}
