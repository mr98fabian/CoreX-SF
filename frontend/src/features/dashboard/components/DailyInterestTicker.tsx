import { useEffect, useState, useRef } from 'react';
import { Flame } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DailyInterestTickerProps {
    /** Total daily interest from all debts (from API) */
    dailyInterest: number;
}

/**
 * Daily Interest Bleeding Ticker
 * Skill: neuromarketing-conversion — "Make abstract annual costs feel immediate and real"
 * 
 * Shows a real-time ticking counter of interest being charged RIGHT NOW.
 * The psychological effect: transforming "$4,800/year in interest" into 
 * "$0.55 every hour" creates visceral urgency.
 */
export function DailyInterestTicker({ dailyInterest }: DailyInterestTickerProps) {
    const { language } = useLanguage();
    const [accumulated, setAccumulated] = useState(0);
    const startTime = useRef(Date.now());

    // Interest per second = dailyInterest / 86400
    const perSecond = dailyInterest / 86400;

    useEffect(() => {
        if (dailyInterest <= 0) return;

        const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime.current) / 1000;
            setAccumulated(elapsed * perSecond);
        }, 100); // Update 10x per second for smooth ticking

        return () => clearInterval(interval);
    }, [dailyInterest, perSecond]);

    if (dailyInterest <= 0) return null;

    const hourlyRate = dailyInterest / 24;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/10 dark:border-rose-500/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <Flame size={14} className="text-rose-400 animate-pulse flex-shrink-0" />
            <p className="text-[11px] text-rose-400/90 font-mono">
                <span className="font-bold tabular-nums">${dailyInterest.toFixed(2)}</span>
                <span className="text-rose-400/60">
                    /{language === 'es' ? 'día en intereses' : 'day in interest'}
                </span>
                <span className="mx-1.5 text-rose-400/30">·</span>
                <span className="text-rose-400/60">
                    ${hourlyRate.toFixed(2)}/{language === 'es' ? 'hora' : 'hr'}
                </span>
                {accumulated > 0.01 && (
                    <>
                        <span className="mx-1.5 text-rose-400/30">·</span>
                        <span className="text-rose-300 font-bold tabular-nums">
                            +${accumulated.toFixed(4)}
                        </span>
                        <span className="text-rose-400/50 ml-0.5">
                            {language === 'es' ? 'desde que abriste esta página' : 'since you opened this page'}
                        </span>
                    </>
                )}
            </p>
        </div>
    );
}
