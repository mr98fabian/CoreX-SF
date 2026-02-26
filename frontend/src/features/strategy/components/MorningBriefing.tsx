import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Zap, Shield, Clock, DollarSign, ArrowRight, Sparkles, AlertTriangle, Rocket, Banknote, Home, Link2, Loader2 } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { emitDataChanged } from "@/lib/dataSync";
import type { MorningBriefingData } from "../hooks/useStrategyData";

interface AllocationEntry {
    source_name: string;
    source_type: string;
    amount: number;
    balance_after?: number;
    apr?: number;
    spread?: number;
}

interface RecommendedSource {
    type: 'cash' | 'uil' | 'heloc' | 'combined' | 'multi';
    source_name: string;
    amount: number;
    reason_es: string;
    interest_spread: number;
    allocation_plan?: AllocationEntry[];
    weapon_allocations?: AllocationEntry[];
}

interface Props {
    data: MorningBriefingData;
    onExecute?: () => void;
    /** Allocation breakdown from dashboard velocity_target.recommended_source */
    recommendedSource?: RecommendedSource | null;
    /** Execute callback — receives transfer list */
    onExecuteAttack?: (transfers: Array<{ source: string; dest: string; amount: number; title: string }>) => void;
    executingAttack?: boolean;
}

const ACCOUNT_TYPE_ICON: Record<string, string> = {
    checking: '🏦',
    savings: '🐷',
    uil: '🔗',
    heloc: '🏠',
};

const SOURCE_ICONS: Record<string, typeof Banknote> = {
    cash: Banknote,
    uil: Link2,
    heloc: Home,
    combined: Zap,
    multi: Banknote,
};

export default function MorningBriefing({ data, recommendedSource, onExecuteAttack, executingAttack = false }: Props) {
    const { formatMoney } = useFormatMoney();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { recommended_action: action, impact, shield_status: shield } = data;
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleGoToActionPlan = () => {
        emitDataChanged('strategy');
        navigate('/dashboard/action-plan');
    };

    // Build allocation list from recommended source
    const allAllocations: AllocationEntry[] = recommendedSource ? [
        ...(recommendedSource.allocation_plan || []),
        ...(recommendedSource.weapon_allocations || []),
    ] : [];

    const canExecute = recommendedSource && allAllocations.length > 0 && onExecuteAttack;

    // Check if any weapon allocations exist — indicates shield risk
    const hasWeaponAllocations = (recommendedSource?.weapon_allocations?.length ?? 0) > 0;

    const buildTransfers = () => {
        if (!recommendedSource) return [];
        return allAllocations.map((a) => ({
            source: a.source_name,
            dest: action.destination,
            amount: a.amount,
            title: `Attack ${action.destination} from ${a.source_name}`,
        }));
    };

    const handleConfirmedExecute = () => {
        const transfers = buildTransfers();
        if (transfers.length > 0 && onExecuteAttack) {
            onExecuteAttack(transfers);
        }
        setShowConfirm(false);
    };

    return (
        <>
            <Card className="relative overflow-hidden border-amber-500/20 dark:border-amber-500/20 border-amber-200 bg-gradient-to-br from-white via-slate-50 to-white dark:from-black dark:via-slate-900 dark:to-black h-full">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <CardContent className="relative p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Sparkles className="h-4 w-4 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    {t("strategy.morningBriefing.opportunity")}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatMoney(data.available_cash)} {t("strategy.morningBriefing.liquidity")}
                                </p>
                            </div>
                        </div>
                        <Badge
                            className={`${shield.health === "strong"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : shield.health === "moderate"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                }`}
                        >
                            <Shield className="h-3 w-3 mr-1" />
                            Shield {shield.percentage}%
                        </Badge>
                    </div>

                    {/* Action Card — informational recommendation */}
                    <div className="rounded-xl bg-gray-100/80 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700/50 p-4 space-y-3 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-500 dark:text-amber-400">
                            <Zap className="h-4 w-4" />
                            {t("strategy.morningBriefing.recommended")}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <p className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                    {formatMoney(action.amount)}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-slate-600 dark:text-gray-300">
                                    <span>{t("strategy.morningBriefing.moveTo")}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {action.destination}
                                    </span>
                                    <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-400">
                                        {action.destination_apr}% APR
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                            "{action.reason}"
                        </p>

                        {/* Gap-First Strategy Info */}
                        {action.gap_coverage && action.gap_coverage.total_cost > 0 && (
                            <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 space-y-1.5">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                                    <AlertTriangle size={13} />
                                    Gap-First Strategy Active
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    {formatMoney(action.gap_coverage.total_cost)} covers interest shortfalls on{' '}
                                    {action.gap_coverage.debts.map(d => d.name).join(', ')}{' '}
                                    before attacking {action.destination}.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Impact Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5 text-center">
                            <Clock className="h-3.5 w-3.5 text-emerald-400 mx-auto mb-1" />
                            <p className="text-lg font-bold text-emerald-400 font-mono">
                                {impact.days_accelerated}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("strategy.morningBriefing.daysAccelerated")}</p>
                        </div>
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5 text-center">
                            <DollarSign className="h-3.5 w-3.5 text-amber-400 mx-auto mb-1" />
                            <p className="text-lg font-bold text-amber-400 font-mono">
                                {formatMoney(impact.interest_saved_monthly)}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("strategy.morningBriefing.savedMonth")}</p>
                        </div>
                        <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-2.5 text-center">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400 mx-auto mb-1" />
                            <p className="text-lg font-bold text-purple-400 font-mono">
                                {impact.freedom_hours_earned}h
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("strategy.morningBriefing.freedomHours")}</p>
                        </div>
                    </div>

                    {/* ═══ ALLOCATION BREAKDOWN + EXECUTE ═══ */}
                    {canExecute ? (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Toggle: show/hide breakdown */}
                            <button
                                onClick={() => setShowBreakdown(!showBreakdown)}
                                className="w-full flex items-center justify-between text-[11px] px-3 py-2 rounded-lg
                                    bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20
                                    text-slate-600 dark:text-zinc-400 hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    {(() => {
                                        const Icon = SOURCE_ICONS[recommendedSource.type] || Banknote;
                                        return <Icon className="h-3 w-3" strokeWidth={1.5} />;
                                    })()}
                                    <span>{recommendedSource.reason_es}</span>
                                </span>
                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                                    {showBreakdown ? '▲' : '▼'} {allAllocations.length} cuenta(s)
                                </span>
                            </button>

                            {/* Breakdown cards */}
                            {showBreakdown && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {allAllocations.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{ACCOUNT_TYPE_ICON[a.source_type] || '💳'}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">{a.source_name}</span>
                                                    {a.balance_after !== undefined && (
                                                        <span className="text-[10px] text-gray-400 dark:text-zinc-600">Queda: {formatMoney(a.balance_after)}</span>
                                                    )}
                                                    {a.spread && (
                                                        <span className="text-[10px] text-emerald-500">Spread +{a.spread.toFixed(1)}% ({a.apr}% APR)</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="font-bold font-mono text-sm text-amber-600 dark:text-amber-400">{formatMoney(a.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Execute button — opens confirmation dialog */}
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={executingAttack}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                                    bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
                                    text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40
                                    transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {executingAttack ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Ejecutando...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4 fill-white" strokeWidth={1.5} />
                                        EJECUTAR ATAQUE — {formatMoney(recommendedSource.amount)}
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* Fallback: navigate to Action Plan */
                        <button
                            onClick={handleGoToActionPlan}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm
                                bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500
                                text-white shadow-lg shadow-amber-900/20 hover:shadow-amber-500/25 transition-all duration-300 active:scale-[0.98]"
                        >
                            <Rocket className="h-4 w-4 shrink-0" />
                            {t("strategy.morningBriefing.executeFrom")} {t("strategy.morningBriefing.actionPlan")}
                        </button>
                    )}
                </CardContent>
            </Card>

            {/* ═══ CONFIRMATION DIALOG ═══ */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="max-w-sm bg-white dark:bg-black border-gray-200 dark:border-neutral-800 text-slate-900 dark:text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-lg">
                            <Zap className="h-5 w-5 text-amber-400" />
                            Confirmar Ataque
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm text-gray-400">
                                <p>
                                    Vas a mover <span className="font-bold text-slate-900 dark:text-white font-mono">{formatMoney(recommendedSource?.amount ?? 0)}</span>{' '}
                                    hacia <span className="font-bold text-slate-900 dark:text-white">{action.destination}</span>.
                                </p>

                                {/* Shield warning */}
                                {hasWeaponAllocations && (
                                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                                            <AlertTriangle size={14} />
                                            ⚠️ Ataque desde armas financieras
                                        </div>
                                        <p className="text-xs text-rose-300/80 leading-relaxed">
                                            Esta operación utiliza fondos de HELOC/UIL que forman parte de tu arsenal.
                                            Asegúrate de que puedes cubrir los pagos de estos instrumentos.
                                        </p>
                                    </div>
                                )}

                                {/* Per-account breakdown */}
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Desglose por cuenta:</p>
                                    {allAllocations.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-[#0f0f0f]/80 border border-gray-200 dark:border-neutral-800">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{ACCOUNT_TYPE_ICON[a.source_type] || '💳'}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-gray-200">{a.source_name}</span>
                                                    {a.balance_after !== undefined && (
                                                        <span className="text-[10px] text-gray-500">Queda: {formatMoney(a.balance_after)}</span>
                                                    )}
                                                    {a.spread && (
                                                        <span className="text-[10px] text-emerald-400">Spread +{a.spread.toFixed(1)}%</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="font-bold font-mono text-sm text-amber-400">{formatMoney(a.amount)}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Impact summary */}
                                <div className="flex items-center gap-3 pt-1">
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-emerald-400 font-mono">{impact.days_accelerated}</p>
                                        <p className="text-[10px] text-gray-500">días</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-amber-400 font-mono">{formatMoney(impact.interest_saved_monthly)}</p>
                                        <p className="text-[10px] text-gray-500">/mes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-purple-400 font-mono">{impact.freedom_hours_earned}h</p>
                                        <p className="text-[10px] text-gray-500">libertad</p>
                                    </div>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="bg-gray-100 dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmedExecute}
                            disabled={executingAttack}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold border-0"
                        >
                            {executingAttack ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    Ejecutando...
                                </>
                            ) : (
                                <>
                                    <Zap className="h-4 w-4 mr-1" />
                                    Confirmar Ataque
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
