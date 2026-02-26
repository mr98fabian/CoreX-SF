import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Info, Crosshair, ChevronDown, ChevronUp } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ConfidenceMeterData } from "../hooks/useStrategyData";

interface Props {
    data: ConfidenceMeterData;
}

// Show top N debts by default, toggle to show all
const INITIAL_VISIBLE = 5;

export default function ConfidenceMeter({ data }: Props) {
    const [showAll, setShowAll] = useState(false);
    const { formatMoney } = useFormatMoney();
    const { t } = useLanguage();

    if (!data.debts_ranked.length) {
        return (
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardContent className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t("strategy.confidence.noDebts")}</p>
                </CardContent>
            </Card>
        );
    }

    const maxApr = Math.max(...data.debts_ranked.map((d) => d.apr));
    const visibleDebts = showAll ? data.debts_ranked : data.debts_ranked.slice(0, INITIAL_VISIBLE);
    const hasMore = data.debts_ranked.length > INITIAL_VISIBLE;

    return (
        <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50 backdrop-blur-sm h-full">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-sm">
                    <Crosshair className="h-4 w-4 text-rose-400" />
                    {t("strategy.confidence.whyTarget")}
                </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {/* APR Comparison Bars — compact */}
                <div className="space-y-2">
                    {visibleDebts.map((debt) => {
                        const widthPct = maxApr > 0 ? (debt.apr / maxApr) * 100 : 0;

                        return (
                            <div key={debt.name} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {debt.is_target && (
                                            <Target className="h-3 w-3 text-amber-400 shrink-0" />
                                        )}
                                        <span
                                            className={`text-xs font-medium truncate ${debt.is_target
                                                ? "text-slate-900 dark:text-white"
                                                : "text-gray-500 dark:text-gray-400"
                                                }`}
                                        >
                                            {debt.name}
                                        </span>
                                        {debt.is_target && (
                                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                                                {t("strategy.confidence.target")}
                                            </Badge>
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs font-mono font-bold shrink-0 ml-2 ${debt.is_target
                                            ? "text-rose-400"
                                            : "text-gray-400 dark:text-gray-500"
                                            }`}
                                    >
                                        {debt.apr}% APR
                                    </span>
                                </div>

                                {/* Thin progress bar */}
                                <div className="w-full h-2 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${debt.is_target
                                            ? "bg-gradient-to-r from-rose-500 to-amber-500"
                                            : "bg-slate-300 dark:bg-slate-700"
                                            }`}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>

                                {/* Sub-stats — single line */}
                                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                                    <span>{t("strategy.confidence.balance")}: {formatMoney(debt.balance)}</span>
                                    <span>{t("strategy.confidence.costsDay")} ${debt.daily_cost.toFixed(2)}{t("strategy.confidence.perDay")}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Show More/Less toggle */}
                {hasMore && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors py-1 border border-gray-200 dark:border-neutral-800 rounded-lg hover:border-slate-300 dark:hover:border-neutral-700"
                    >
                        {showAll ? (
                            <>
                                <ChevronUp className="h-3 w-3" />
                                {t("strategy.confidence.showLess")}
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-3 w-3" />
                                {t("strategy.confidence.showAll")} ({data.debts_ranked.length})
                            </>
                        )}
                    </button>
                )}

                {/* Explanation */}
                {data.explanation && (
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
                        <div className="flex gap-2">
                            <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                                {data.explanation}
                            </p>
                        </div>
                    </div>
                )}

                {/* Strategy Label */}
                <div className="flex items-center justify-center pt-2 border-t border-gray-200 dark:border-neutral-800">
                    <Badge
                        variant="outline"
                        className="border-slate-300 dark:border-neutral-700 text-gray-500 dark:text-gray-400 text-[10px]"
                    >
                        {t("strategy.confidence.strategy")}: {data.strategy.charAt(0).toUpperCase() + data.strategy.slice(1)} {t("strategy.confidence.method")}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
