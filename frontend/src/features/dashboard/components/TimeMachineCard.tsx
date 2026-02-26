import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';

interface TimeMachineProps {
    /** Total daily interest across all debts */
    dailyInterest: number;
    /** User registration date (ISO string) */
    registrationDate?: string;
}

/**
 * Time Machine Regret Trigger
 * Skill: neuromarketing-conversion §5
 * 
 * Shows "If you had started X months ago, you'd have $Y less debt today."
 * Only appears if user has been registered for 30+ days.
 * Creates healthy urgency without being aggressive.
 */
export function TimeMachineCard({ dailyInterest, registrationDate }: TimeMachineProps) {
    const { language } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const [show, setShow] = useState(false);
    const [monthsAgo, setMonthsAgo] = useState(0);
    const [potentialSavings, setPotentialSavings] = useState(0);

    useEffect(() => {
        if (dailyInterest <= 0) return;

        // Calculate how long user has been registered
        const regDate = registrationDate ? new Date(registrationDate) : null;
        if (!regDate) return;

        const now = new Date();
        const diffMs = now.getTime() - regDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Only show if user has been around 30+ days
        if (diffDays < 30) return;

        const months = Math.floor(diffDays / 30);
        const savings = dailyInterest * diffDays * 0.3; // Conservative 30% reduction estimate

        setMonthsAgo(months);
        setPotentialSavings(savings);
        setShow(true);
    }, [dailyInterest, registrationDate]);

    if (!show) return null;

    return (
        <div className="col-span-12 px-4 py-3 rounded-xl border border-amber-500/10 bg-gradient-to-r from-amber-500/5 to-transparent dark:from-amber-950/20 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0 mt-0.5">
                    <Clock size={16} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-amber-400/80 font-medium mb-0.5">
                        {language === 'es' ? '⏰ Máquina del Tiempo' : '⏰ Time Machine'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'es'
                            ? `Si hubieras empezado una estrategia de ataque hace ${monthsAgo} meses, podrías tener ${formatMoney(potentialSavings)} menos de deuda hoy.`
                            : `If you had started an attack strategy ${monthsAgo} months ago, you could have ${formatMoney(potentialSavings)} less debt today.`
                        }
                    </p>
                    <p className="text-[10px] text-amber-400/50 mt-1 flex items-center gap-1">
                        <AlertTriangle size={9} />
                        {language === 'es'
                            ? 'Cada mes que esperas = más intereses que nunca recuperarás'
                            : 'Every month you wait = more interest you\'ll never recover'}
                    </p>
                </div>
            </div>
        </div>
    );
}
