import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Info, Crosshair } from "lucide-react";
import type { ConfidenceMeterData } from "../hooks/useStrategyData";

interface Props {
    data: ConfidenceMeterData;
}

export default function ConfidenceMeter({ data }: Props) {
    if (!data.debts_ranked.length) {
        return (
            <Card className="border-slate-800 bg-slate-950/50">
                <CardContent className="p-6 text-center text-slate-400">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active debts to analyze</p>
                </CardContent>
            </Card>
        );
    }

    // Find the maximum APR for proportional bar scaling
    const maxApr = Math.max(...data.debts_ranked.map((d) => d.apr));

    const formatMoney = (n: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n);

    return (
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Crosshair className="h-5 w-5 text-rose-400" />
                    Why This Target?
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* APR Comparison Bars */}
                <div className="space-y-3">
                    {data.debts_ranked.map((debt) => {
                        const widthPct = maxApr > 0 ? (debt.apr / maxApr) * 100 : 0;

                        return (
                            <div key={debt.name} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {debt.is_target && (
                                            <Target className="h-3.5 w-3.5 text-amber-400" />
                                        )}
                                        <span
                                            className={`text-sm font-medium ${debt.is_target
                                                    ? "text-white"
                                                    : "text-slate-400"
                                                }`}
                                        >
                                            {debt.name}
                                        </span>
                                        {debt.is_target && (
                                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                                                TARGET
                                            </Badge>
                                        )}
                                    </div>
                                    <span
                                        className={`text-sm font-mono font-bold ${debt.is_target
                                                ? "text-rose-400"
                                                : "text-slate-500"
                                            }`}
                                    >
                                        {debt.apr}% APR
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${debt.is_target
                                                ? "bg-gradient-to-r from-rose-500 to-amber-500"
                                                : "bg-slate-700"
                                            }`}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>

                                {/* Sub-stats */}
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>
                                        Balance: {formatMoney(debt.balance)}
                                    </span>
                                    <span>
                                        Costs ${debt.daily_cost.toFixed(2)}/day
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Explanation — the "simple language" block */}
                {data.explanation && (
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3.5">
                        <div className="flex gap-2">
                            <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-300 leading-relaxed">
                                {data.explanation}
                            </p>
                        </div>
                    </div>
                )}

                {/* Strategy Label */}
                <div className="flex items-center justify-center pt-2 border-t border-slate-800">
                    <Badge
                        variant="outline"
                        className="border-slate-700 text-slate-400 text-xs"
                    >
                        Strategy: {data.strategy.charAt(0).toUpperCase() + data.strategy.slice(1)} Method
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
