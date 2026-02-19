import { useMemo } from 'react';
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
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                    background: `linear-gradient(135deg, ${rank.material.glowColor}, transparent)`,
                    borderColor: rank.material.color,
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
            className="relative overflow-hidden rounded-xl border p-3 transition-all duration-500 group"
            style={{
                borderColor: `${rank.material.color}40`,
                background: `linear-gradient(135deg, ${rank.material.glowColor}, transparent 70%)`,
            }}
        >
            {/* Ambient glow */}
            <div
                className="absolute -top-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none transition-opacity group-hover:opacity-50"
                style={{ background: rank.material.color }}
            />

            {/* Rank display */}
            <div className="relative flex items-center gap-2.5">
                {/* Material emoji with glow */}
                <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg text-xl"
                    style={{
                        background: `${rank.material.glowColor}`,
                        boxShadow: `0 0 12px ${rank.material.glowColor}`,
                    }}
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
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800/50 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${rank.progressPercent}%`,
                                        background: `linear-gradient(90deg, ${rank.material.color}80, ${rank.material.color})`,
                                        boxShadow: `0 0 6px ${rank.material.glowColor}`,
                                    }}
                                />
                            </div>
                            <span className="text-[9px] font-mono text-slate-500 tabular-nums whitespace-nowrap">
                                {rank.progressPercent}%
                            </span>
                        </div>
                    )}

                    {/* Next rank hint */}
                    {!rank.isMaxRank && nextName && (
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">
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
                <div className="absolute bottom-1.5 right-2 text-[8px] font-bold text-amber-400/60 flex items-center gap-0.5">
                    ⚡ 2x
                </div>
            )}

            {/* Streak info */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                <span>🔥 {streak.rawStreak} {isEs ? 'días racha' : 'day streak'}</span>
                <span>📊 {streak.score} {isEs ? 'pts' : 'pts'}</span>
            </div>
        </div>
    );
}
