import { useMemo } from 'react';
import { Zap, Flame, BarChart3 } from 'lucide-react';
import { getCommanderRank, getEffectiveScore, type CommanderRank } from '@/hooks/useCommanderRank';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * CommanderBadge — Visual rank badge with material glow + progress bar.
 *
 * Shows the user's current Commander Rank (e.g. "💎 Capitán de Diamante")
 * with a progress bar towards the next rank, all styled with the
 * material's color palette.
 */

interface CommanderBadgeProps {
    /** Whether the user is on a paid plan (2x XP boost) */
    isPaid?: boolean;
    /** Compact mode for sidebar / small areas */
    compact?: boolean;
}

export function CommanderBadge({ isPaid = false, compact = false }: CommanderBadgeProps) {
    const { language } = useLanguage();
    const streak = useLoginStreak();

    const rank: CommanderRank = useMemo(() => {
        const effectiveScore = getEffectiveScore(streak.score, isPaid);
        return getCommanderRank(effectiveScore);
    }, [streak.score, isPaid]);

    const isEs = language === 'es';
    const displayName = isEs ? rank.fullDisplayEs : rank.fullDisplayEn;
    const nextName = isEs ? rank.nextRankEs : rank.nextRankEn;

    if (compact) {
        return (
            <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                style={{
                    background: `${rank.material.color}14`,
                    borderColor: `${rank.material.color}59`,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: rank.material.color,
                }}
            >
                <span>{rank.material.emoji}</span>
                <span className="truncate max-w-[120px]">
                    {isEs ? rank.military.nameEs : rank.military.nameEn}
                </span>
                {rank.military.stars && (
                    <span className="text-[9px] opacity-70">{rank.military.stars}</span>
                )}
            </div>
        );
    }

    return (
        <div
            className="relative overflow-hidden rounded-xl border bg-card p-3 transition-colors group"
            style={{ borderColor: `${rank.material.color}40` }}
        >
            {/* Rank display */}
            <div className="relative flex items-center gap-2.5">
                {/* Material emblem */}
                <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg text-xl"
                    style={{ background: `${rank.material.color}1f` }}
                >
                    {rank.material.emoji}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Rank name with material color */}
                    <div className="flex items-center gap-1.5">
                        <span
                            className="text-sm font-extrabold truncate"
                            style={{ color: rank.material.color }}
                        >
                            {displayName}
                        </span>
                        {rank.military.stars && (
                            <span className="text-[10px]" style={{ color: `${rank.material.color}99` }}>
                                {rank.military.stars}
                            </span>
                        )}
                    </div>

                    {/* Progress bar to next rank */}
                    {!rank.isMaxRank && (
                        <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-neutral-800/50 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${rank.progressPercent}%`,
                                        background: rank.material.color,
                                    }}
                                />
                            </div>
                            <span className="text-[9px] font-mono text-gray-500 tabular-nums whitespace-nowrap">
                                {rank.progressPercent}%
                            </span>
                        </div>
                    )}

                    {/* Next rank hint */}
                    {!rank.isMaxRank && nextName && (
                        <p className="text-[9px] text-gray-500 mt-0.5 truncate">
                            {isEs ? 'Siguiente' : 'Next'}: {nextName}
                        </p>
                    )}

                    {/* Max rank badge */}
                    {rank.isMaxRank && (
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: rank.material.color }}>
                            {isEs ? '¡RANGO MÁXIMO!' : 'MAX RANK!'}
                        </p>
                    )}
                </div>
            </div>

            {/* Level indicator */}
            <div className="absolute top-1.5 right-2 text-[9px] font-mono text-slate-600">
                Lv.{rank.level}/90
            </div>

            {/* Paid boost indicator */}
            {isPaid && (
                <div className="absolute bottom-1.5 right-2 text-[8px] font-bold text-gold-400 flex items-center gap-0.5">
                    <Zap size={9} /> 2x
                </div>
            )}

            {/* Streak info */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><Flame size={11} className="text-ignition" /> {streak.rawStreak} {isEs ? 'días racha' : 'day streak'}</span>
                <span className="flex items-center gap-1"><BarChart3 size={11} /> {streak.score} {isEs ? 'pts' : 'pts'}</span>
            </div>
        </div>
    );
}
