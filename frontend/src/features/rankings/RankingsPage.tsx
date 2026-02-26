import { usePageTitle } from '@/hooks/usePageTitle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { getCommanderRank, getEffectiveScore, MILITARY_RANKS, MATERIAL_TIERS } from '@/hooks/useCommanderRank';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetHelp } from '@/components/WidgetHelp';
import { Trophy, Star, Shield, Flame, Zap, Crown, ChevronDown, ChevronUp, Lock, Rocket } from 'lucide-react';
import { useState } from 'react';
import UpgradeModal from '@/components/UpgradeModal';

export default function RankingsPage() {
    const { t, language } = useLanguage();
    usePageTitle(t('nav.rankings'));
    const streak = useLoginStreak();
    const plan = localStorage.getItem('korex-plan') || 'starter';
    const isPaid = plan !== 'starter';
    const effectiveScore = getEffectiveScore(streak.score, isPaid);
    const currentRank = getCommanderRank(effectiveScore);
    const [expandedTier, setExpandedTier] = useState<number | null>(currentRank.material.index);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const es = language === 'es';

    // Build the full rank table with cumulative days
    const rankTable: Array<{
        materialIndex: number;
        materialName: string;
        materialEmoji: string;
        materialColor: string;
        ranks: Array<{
            militaryIndex: number;
            militaryName: string;
            stars: string;
            cumulativeDays: number;
            isCurrent: boolean;
            isUnlocked: boolean;
        }>;
    }> = [];

    let cumulative = 0;
    for (const mat of MATERIAL_TIERS) {
        const ranks = [];
        for (const mil of MILITARY_RANKS) {
            cumulative += mat.daysPerRank;
            const isCurrent = currentRank.material.index === mat.index && currentRank.military.index === mil.index;
            const isUnlocked = effectiveScore >= cumulative;
            ranks.push({
                militaryIndex: mil.index,
                militaryName: es ? mil.nameEs : mil.nameEn,
                stars: mil.stars,
                cumulativeDays: cumulative,
                isCurrent,
                isUnlocked,
            });
        }
        rankTable.push({
            materialIndex: mat.index,
            materialName: es ? mat.nameEs : mat.nameEn,
            materialEmoji: mat.emoji,
            materialColor: mat.color,
            ranks,
        });
    }

    return (
        <div className="space-y-6 pb-16 animate-in fade-in duration-700">
            {/* ═══ HERO SECTION ═══ */}
            <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/5 p-6 md:p-8">
                <WidgetHelp helpKey="rankHero" />
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] opacity-30"
                        style={{ backgroundColor: currentRank.material.color }} />
                    <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[80px] opacity-20"
                        style={{ backgroundColor: currentRank.material.color }} />
                </div>

                <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
                    {/* Big Rank Badge */}
                    <div className="flex flex-col items-center">
                        <div className="text-7xl mb-2" style={{ filter: `drop-shadow(0 0 20px ${currentRank.material.glowColor})` }}>
                            {currentRank.material.emoji}
                        </div>
                        <div className="text-3xl tracking-wider text-amber-300">{currentRank.military.stars}</div>
                    </div>

                    <div className="text-center md:text-left flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-center md:justify-start">
                            {es ? 'Tu Rango Actual' : 'Your Current Rank'}
                        </p>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent"
                            style={{ backgroundImage: `linear-gradient(135deg, ${currentRank.material.color}, ${currentRank.material.color}88, white)` }}>
                            {es ? currentRank.fullDisplayEs : currentRank.fullDisplayEn}
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm">
                            {es ? `Nivel ${currentRank.level} de 90` : `Level ${currentRank.level} of 90`}
                        </p>
                        {!currentRank.isMaxRank && (
                            <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                <span className="text-amber-500">▸</span>
                                {es ? 'Siguiente:' : 'Next:'}{' '}
                                <span className="text-gray-300 font-semibold">
                                    {es ? currentRank.nextRankEs : currentRank.nextRankEn}
                                </span>
                            </p>
                        )}

                        {/* Progress to next rank */}
                        <div className="mt-4 max-w-md">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                <span>{es ? 'Progreso al siguiente rango' : 'Progress to next rank'}</span>
                                <span>{Math.round(currentRank.progressPercent)}%</span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${currentRank.progressPercent}%`,
                                        background: `linear-gradient(90deg, ${currentRank.material.color}, ${currentRank.material.color}cc)`,
                                        boxShadow: `0 0 12px ${currentRank.material.glowColor}`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="flex flex-wrap gap-4 mt-5">
                            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
                                <Flame size={14} className="text-orange-400" />
                                <span className="text-xs font-bold text-white">{streak.score}</span>
                                <span className="text-[10px] text-gray-400">{es ? 'pts racha' : 'streak pts'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
                                <Zap size={14} className="text-amber-400" />
                                <span className="text-xs font-bold text-white">{effectiveScore}</span>
                                <span className="text-[10px] text-gray-400">{es ? 'XP efectivo' : 'effective XP'}</span>
                            </div>
                            {isPaid && (
                                <div className="flex items-center gap-1.5 bg-amber-500/10 rounded-lg px-3 py-1.5 border border-amber-500/20">
                                    <Crown size={14} className="text-amber-400" />
                                    <span className="text-[10px] font-bold text-amber-400">2x XP BOOST</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ HOW IT WORKS ═══ */}
            <Card className="relative group">
                <WidgetHelp helpKey="howItWorks" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield size={18} className="text-blue-400" />
                        {es ? '¿Cómo Funciona?' : 'How Does It Work?'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-gray-400">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                            <p className="font-bold text-emerald-400 mb-1">✅ {es ? 'Sube de Rango' : 'Rank Up'}</p>
                            <p>{es ? 'Registra al menos 1 transacción (ingreso o gasto) cada día para sumar puntos a tu racha.' : 'Register at least 1 transaction (income or expense) daily to add points to your streak.'}</p>
                        </div>
                        <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                            <p className="font-bold text-rose-400 mb-1">⚠️ {es ? 'Penalización' : 'Penalty'}</p>
                            <p>{es ? 'Cada día que no registres transacción se restan 2 puntos de tu racha. ¡Mantén la constancia!' : 'Each day without a transaction deducts 2 points from your streak. Stay consistent!'}</p>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                            <p className="font-bold text-amber-400 mb-1">👑 {es ? 'Boost VIP' : 'VIP Boost'}</p>
                            <p>{es ? 'Los miembros VIP ganan 2x XP por transacción registrada. ¡Tu progreso se acelera enormemente!' : 'VIP members earn 2x XP per transaction. Your progress accelerates enormously!'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═══ VIP UPSELL ═══ */}
            {!isPaid && (
                <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-amber-600/5 to-orange-500/5 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-[60px]" />
                    <CardContent className="p-5 relative">
                        <div className="flex items-start gap-4">
                            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                                <Rocket size={24} className="text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-amber-300 mb-1">
                                    {es ? '¿Quieres avanzar más rápido?' : 'Want to progress faster?'}
                                </p>
                                <p className="text-xs text-gray-400 mb-3">
                                    {es
                                        ? 'Conviértete en VIP para ganar 2x XP por cada transacción registrada, acortar tu camino dramáticamente y agregar más cuentas simultáneas para un control financiero total.'
                                        : 'Go VIP to earn 2x XP per transaction, dramatically shorten your journey and add more simultaneous accounts for total financial control.'}
                                </p>
                                <button onClick={() => setShowUpgradeModal(true)} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-900/30">
                                    <Crown size={12} />
                                    {es ? 'Ver planes VIP' : 'View VIP plans'}
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ═══ FULL RANK TABLE ═══ */}
            <Card className="relative group">
                <WidgetHelp helpKey="commanderBadge" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Trophy size={18} className="text-amber-400" />
                        {es ? 'Tabla Completa de Rangos (90 Niveles)' : 'Full Rank Table (90 Levels)'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {rankTable.map(tier => {
                        const isExpanded = expandedTier === tier.materialIndex;
                        const unlockedCount = tier.ranks.filter(r => r.isUnlocked).length;
                        const hasCurrent = tier.ranks.some(r => r.isCurrent);
                        // Tier is locked if user hasn't reached any rank inside it and it's not the current tier
                        const isTierLocked = unlockedCount === 0 && !hasCurrent;

                        return (
                            <div key={tier.materialIndex} className="rounded-xl overflow-hidden border"
                                style={{ borderColor: hasCurrent ? tier.materialColor + '40' : 'rgba(255,255,255,0.05)' }}>
                                {/* Material Tier Header */}
                                <button
                                    onClick={() => !isTierLocked && setExpandedTier(isExpanded ? null : tier.materialIndex)}
                                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isTierLocked ? 'cursor-default opacity-50' : 'hover:bg-white/5'
                                        }`}
                                    style={{ backgroundColor: hasCurrent ? tier.materialColor + '08' : undefined }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{isTierLocked ? '🔒' : tier.materialEmoji}</span>
                                        <div className="text-left">
                                            <span className="text-sm font-bold" style={{ color: isTierLocked ? '#4b5563' : tier.materialColor }}>
                                                {isTierLocked ? '???' : tier.materialName}
                                            </span>
                                            {!isTierLocked && (
                                                <span className="text-[10px] text-gray-500 ml-2">
                                                    {unlockedCount}/9 {es ? 'desbloqueados' : 'unlocked'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasCurrent && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: tier.materialColor + '20', color: tier.materialColor }}>
                                                {es ? 'actual' : 'current'}
                                            </span>
                                        )}
                                        {!isTierLocked && (
                                            isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />
                                        )}
                                        {isTierLocked && <Lock size={14} className="text-slate-600" />}
                                    </div>
                                </button>

                                {/* Expanded: Individual Ranks — only for unlocked/current tiers */}
                                {isExpanded && !isTierLocked && (
                                    <div className="border-t border-white/5 divide-y divide-white/5">
                                        {tier.ranks.map(rank => {
                                            const isLocked = !rank.isUnlocked && !rank.isCurrent;
                                            return (
                                                <div
                                                    key={rank.militaryIndex}
                                                    className={`flex items-center justify-between px-4 py-2.5 transition-colors ${rank.isCurrent
                                                        ? 'bg-gradient-to-r from-amber-500/10 to-transparent'
                                                        : rank.isUnlocked
                                                            ? 'bg-white/[0.02]'
                                                            : 'opacity-35'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs w-6 text-center">
                                                            {isLocked ? <Lock size={10} className="text-slate-600 mx-auto" /> : (rank.stars || '—')}
                                                        </span>
                                                        <span className={`text-xs font-medium ${rank.isCurrent ? 'text-amber-300'
                                                            : isLocked ? 'text-slate-600 italic'
                                                                : 'text-gray-300'
                                                            }`}>
                                                            {isLocked ? '???' : rank.militaryName}
                                                        </span>
                                                        {rank.isCurrent && (
                                                            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                                                ← {es ? 'TÚ' : 'YOU'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {rank.isUnlocked ? (
                                                            <Star size={12} className="text-amber-400 fill-amber-400" />
                                                        ) : rank.isCurrent ? (
                                                            <Star size={12} className="text-amber-400 animate-pulse" />
                                                        ) : (
                                                            <Lock size={12} className="text-slate-700" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* ═══ REWARDS PREVIEW ═══ */}
            <Card className="relative group">
                <WidgetHelp helpKey="rankBenefits" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Star size={18} className="text-purple-400" />
                        {es ? 'Beneficios por Rango' : 'Rank Benefits'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <span className="text-lg">🏅</span>
                            <div>
                                <p className="font-bold text-gray-200">{es ? 'Insignias de Logro' : 'Achievement Badges'}</p>
                                <p className="text-gray-500 mt-0.5">{es ? 'Desbloquea insignias exclusivas en tu Muro de Logros conforme subes de rango' : 'Unlock exclusive badges on your Achievement Wall as you rank up'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <span className="text-lg">💚</span>
                            <div>
                                <p className="font-bold text-gray-200">{es ? 'Salud Financiera' : 'Financial Health'}</p>
                                <p className="text-gray-500 mt-0.5">{es ? 'Tu rango de Comandante contribuye directamente a tu Puntaje de Salud Financiera' : 'Your Commander rank directly contributes to your Financial Health Score'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <span className="text-lg">🎯</span>
                            <div>
                                <p className="font-bold text-gray-200">{es ? 'Disciplina Financiera' : 'Financial Discipline'}</p>
                                <p className="text-gray-500 mt-0.5">{es ? 'Mantener tu racha te obliga a revisar tus finanzas diariamente — el hábito más poderoso' : 'Keeping your streak forces daily financial check-ins — the most powerful habit'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <span className="text-lg">✨</span>
                            <div>
                                <p className="font-bold text-gray-200">{es ? 'Prestigio Visual' : 'Visual Prestige'}</p>
                                <p className="text-gray-500 mt-0.5">{es ? 'Tu rango y material brillan en el Dashboard y la barra lateral — muestra tu progreso' : 'Your rank and material glow on the Dashboard and sidebar — show off your progress'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <UpgradeModal
                open={showUpgradeModal}
                onOpenChange={setShowUpgradeModal}
                reason="rank_boost"
            />
        </div>
    );
}
