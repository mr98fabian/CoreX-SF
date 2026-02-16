import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Clock, DollarSign, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MorningBriefingData } from "../hooks/useStrategyData";

interface Props {
    data: MorningBriefingData;
    onExecute?: () => void;
}

export default function MorningBriefing({ data }: Props) {
    const { formatMoney } = useFormatMoney();
    const { t } = useLanguage();
    const { recommended_action: action, impact, shield_status: shield } = data;

    return (
        <Card className="relative overflow-hidden border-amber-500/20 dark:border-amber-500/20 border-amber-200 bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 h-full">
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
                            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                <div className="rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-4 space-y-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-500 dark:text-amber-400">
                        <Zap className="h-4 w-4" />
                        {t("strategy.morningBriefing.recommended")}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                {formatMoney(action.amount)}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-slate-600 dark:text-slate-300">
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

                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                        "{action.reason}"
                    </p>

                    {/* Gap-First Strategy Info */}
                    {action.gap_coverage && action.gap_coverage.total_cost > 0 && (
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                                <AlertTriangle size={13} />
                                Gap-First Strategy Active
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
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
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("strategy.morningBriefing.daysAccelerated")}</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5 text-center">
                        <DollarSign className="h-3.5 w-3.5 text-amber-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-amber-400 font-mono">
                            {formatMoney(impact.interest_saved_monthly)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("strategy.morningBriefing.savedMonth")}</p>
                    </div>
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-2.5 text-center">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-purple-400 font-mono">
                            {impact.freedom_hours_earned}h
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("strategy.morningBriefing.freedomHours")}</p>
                    </div>
                </div>

                {/* Info footer — replaces the old execute button */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Sparkles className="h-3 w-3 text-amber-500/50" />
                    <span>{t("strategy.morningBriefing.executeFrom")} <span className="text-amber-500 dark:text-amber-400 font-medium">{t("strategy.morningBriefing.actionPlan")}</span> {t("strategy.morningBriefing.page")}</span>
                </div>
            </CardContent>
        </Card>
    );
}
