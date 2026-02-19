import { useMemo } from 'react';
import { calculateHealthScore, type HealthScore } from '@/hooks/useFinancialHealthScore';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * HealthScoreGauge — Circular SVG gauge showing composite financial score.
 */

interface HealthScoreGaugeProps {
    shieldFillPercent: number;
    totalDebt: number;
    liquidCash: number;
    streakScore: number;
    commanderLevel: number;
}

export function HealthScoreGauge(props: HealthScoreGaugeProps) {
    const { language } = useLanguage();

    const health: HealthScore = useMemo(() =>
        calculateHealthScore(props),
        [props.shieldFillPercent, props.totalDebt, props.liquidCash, props.streakScore, props.commanderLevel]
    );

    const isEs = language === 'es';

    // SVG circle math
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (health.score / 100) * circumference;

    return (
        <div className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-zinc-950/30 h-full">
            {/* Circular gauge */}
            <div className="relative shrink-0">
                <svg width="88" height="88" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor"
                        className="text-slate-200 dark:text-zinc-800" strokeWidth="6" />
                    {/* Progress arc */}
                    <circle cx="50" cy="50" r={radius} fill="none"
                        stroke={health.color} strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={dashOffset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                    />
                </svg>
                {/* Center score */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black tabular-nums" style={{ color: health.color }}>
                        {health.score}
                    </span>
                    <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                        {health.grade}
                    </span>
                </div>
            </div>

            {/* Score details */}
            <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isEs ? 'Salud Financiera' : 'Financial Health'}
                </h4>
                <p className="text-[10px] text-slate-500 mb-2">
                    {isEs ? health.messageEs : health.messageEn}
                </p>

                {/* Breakdown bars */}
                <div className="space-y-1">
                    {([
                        [isEs ? 'Escudo' : 'Shield', health.breakdown.shield, 30],
                        [isEs ? 'Deuda' : 'Debt', health.breakdown.debtProgress, 25],
                        [isEs ? 'Racha' : 'Streak', health.breakdown.consistency, 20],
                        [isEs ? 'Liquidez' : 'Cash', health.breakdown.cashRatio, 15],
                        [isEs ? 'Rango' : 'Rank', health.breakdown.rank, 10],
                    ] as [string, number, number][]).map(([label, val, max]) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className="text-[8px] text-slate-500 w-10 shrink-0">{label}</span>
                            <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${(val / max) * 100}%`,
                                        backgroundColor: health.color,
                                    }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-500 tabular-nums w-6 text-right">{val}/{max}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
