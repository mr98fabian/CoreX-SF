import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Trophy, Lock } from 'lucide-react';

/**
 * Achievement Wall — Grid of unlockable badges that track user milestones.
 * Shows earned achievements with full color and locked ones as grayscale.
 */

interface Achievement {
    id: string;
    emoji: string;
    titleEn: string;
    titleEs: string;
    descEn: string;
    descEs: string;
    condition: (ctx: AchievementContext) => boolean;
}

interface AchievementContext {
    streakRaw: number;       // Raw consecutive days
    streakScore: number;     // Effective score
    commanderLevel: number;  // 1-90
    shieldPercent: number;   // 0-100
    totalDebt: number;
    debtsEliminated: number;
    accountCount: number;
    interestSaved: number;
}

const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_login',
        emoji: '🎖️',
        titleEn: 'First Login', titleEs: 'Primera Conexión',
        descEn: 'Joined the battlefield', descEs: 'Te uniste al campo de batalla',
        condition: () => true, // Everyone gets this
    },
    {
        id: 'streak_7',
        emoji: '🔥',
        titleEn: '7-Day Streak', titleEs: 'Racha de 7 Días',
        descEn: 'Discipline unlocked', descEs: 'Disciplina desbloqueada',
        condition: (ctx) => ctx.streakRaw >= 7,
    },
    {
        id: 'streak_30',
        emoji: '⚡',
        titleEn: '30-Day Warrior', titleEs: 'Guerrero de 30 Días',
        descEn: 'A full month of consistency', descEs: 'Un mes completo de constancia',
        condition: (ctx) => ctx.streakRaw >= 30,
    },
    {
        id: 'streak_90',
        emoji: '🏆',
        titleEn: '90-Day Legend', titleEs: 'Leyenda de 90 Días',
        descEn: 'Three months straight', descEs: 'Tres meses seguidos',
        condition: (ctx) => ctx.streakRaw >= 90,
    },
    {
        id: 'shield_charged',
        emoji: '🛡️',
        titleEn: 'Shield Charged', titleEs: 'Escudo Cargado',
        descEn: 'Peace Shield at 100%', descEs: 'Peace Shield al 100%',
        condition: (ctx) => ctx.shieldPercent >= 100,
    },
    {
        id: 'debt_slayer',
        emoji: '💀',
        titleEn: 'Debt Slayer', titleEs: 'Destructor de Deudas',
        descEn: 'Eliminated a debt', descEs: 'Eliminaste una deuda',
        condition: (ctx) => ctx.debtsEliminated >= 1,
    },
    {
        id: 'iron_rank',
        emoji: '⚙️',
        titleEn: 'Iron Rank', titleEs: 'Rango Hierro',
        descEn: 'Reached Iron tier', descEs: 'Alcanzaste el nivel Hierro',
        condition: (ctx) => ctx.commanderLevel >= 19, // 9 (wood) + 9 (stone) + 1
    },
    {
        id: 'gold_rank',
        emoji: '🥇',
        titleEn: 'Gold Rank', titleEs: 'Rango Oro',
        descEn: 'Reached Gold tier', descEs: 'Alcanzaste el nivel Oro',
        condition: (ctx) => ctx.commanderLevel >= 46, // Wood(9)+Stone(9)+Iron(9)+Bronze(9)+Silver(9)+1
    },
    {
        id: 'diamond_rank',
        emoji: '💎',
        titleEn: 'Diamond Rank', titleEs: 'Rango Diamante',
        descEn: 'Reached Diamond tier', descEs: 'Alcanzaste Diamante',
        condition: (ctx) => ctx.commanderLevel >= 64, // Through Emerald(9) + 1
    },
    {
        id: 'data_master',
        emoji: '📊',
        titleEn: 'Data Master', titleEs: 'Maestro de Datos',
        descEn: 'Added 5+ accounts', descEs: 'Agregaste 5+ cuentas',
        condition: (ctx) => ctx.accountCount >= 5,
    },
    {
        id: 'interest_saver',
        emoji: '💰',
        titleEn: 'Interest Saver', titleEs: 'Ahorrador de Intereses',
        descEn: 'Saved $1,000+ in interest', descEs: 'Ahorraste $1,000+ en intereses',
        condition: (ctx) => ctx.interestSaved >= 1000,
    },
    {
        id: 'streak_365',
        emoji: '👑',
        titleEn: 'Yearly Crown', titleEs: 'Corona Anual',
        descEn: 'One full year of streaks', descEs: 'Un año completo de racha',
        condition: (ctx) => ctx.streakRaw >= 365,
    },
];

interface AchievementWallProps {
    context: AchievementContext;
}

export function AchievementWall({ context }: AchievementWallProps) {
    const { language } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const isEs = language === 'es';

    const evaluated = useMemo(() =>
        ACHIEVEMENTS.map(a => ({
            ...a,
            unlocked: a.condition(context),
        })),
        [context]
    );

    const unlockCount = evaluated.filter(a => a.unlocked).length;
    const displayList = expanded ? evaluated : evaluated.slice(0, 6);

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-zinc-950/30 p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {isEs ? 'Logros' : 'Achievements'}
                    </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                    {unlockCount}/{ACHIEVEMENTS.length}
                </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 flex-1 content-start">
                {displayList.map(a => (
                    <div
                        key={a.id}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${a.unlocked
                            ? 'border-amber-500/20 bg-amber-500/5'
                            : 'border-slate-200 dark:border-slate-800/30 opacity-40 grayscale'
                            }`}
                        title={a.unlocked
                            ? (isEs ? a.descEs : a.descEn)
                            : (isEs ? '🔒 Bloqueado' : '🔒 Locked')}
                    >
                        <span className="text-lg">{a.emoji}</span>
                        <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 leading-tight">
                            {isEs ? a.titleEs : a.titleEn}
                        </span>
                        {!a.unlocked && (
                            <Lock size={8} className="absolute top-1 right-1 text-slate-500" />
                        )}
                    </div>
                ))}
            </div>

            {ACHIEVEMENTS.length > 6 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                    {expanded
                        ? (isEs ? 'Ver menos' : 'Show less')
                        : (isEs ? `Ver todos (${ACHIEVEMENTS.length})` : `Show all (${ACHIEVEMENTS.length})`)}
                </button>
            )}
        </div>
    );
}
