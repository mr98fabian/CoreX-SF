import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Clock, DollarSign, ArrowRight, Sparkles } from "lucide-react";
import type { MorningBriefingData } from "../hooks/useStrategyData";

interface Props {
    data: MorningBriefingData;
}

export default function MorningBriefing({ data }: Props) {
    const formatMoney = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    const { recommended_action: action, impact, shield_status: shield } = data;

    return (
        <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 h-full">
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
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Opportunity Detected
                            </h2>
                            <p className="text-xs text-slate-400">
                                You have {formatMoney(data.available_cash)} in strategic liquidity
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
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                        <Zap className="h-4 w-4" />
                        RECOMMENDED ACTION
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-xl font-bold text-white font-mono">
                                {formatMoney(action.amount)}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-slate-300">
                                <span>Move to</span>
                                <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                                <span className="font-semibold text-white">
                                    {action.destination}
                                </span>
                                <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-400">
                                    {action.destination_apr}% APR
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-400 italic">
                        "{action.reason}"
                    </p>
                </div>

                {/* Impact Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5 text-center">
                        <Clock className="h-3.5 w-3.5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-emerald-400 font-mono">
                            {impact.days_accelerated}
                        </p>
                        <p className="text-[10px] text-slate-400">Days Accelerated</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5 text-center">
                        <DollarSign className="h-3.5 w-3.5 text-amber-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-amber-400 font-mono">
                            ${impact.interest_saved_monthly.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-400">Saved / Month</p>
                    </div>
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-2.5 text-center">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-purple-400 font-mono">
                            {impact.freedom_hours_earned}h
                        </p>
                        <p className="text-[10px] text-slate-400">Freedom Hours</p>
                    </div>
                </div>

                {/* Info footer — replaces the old execute button */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-800">
                    <Sparkles className="h-3 w-3 text-amber-500/50" />
                    <span>Execute transfers from the <span className="text-amber-400 font-medium">Action Plan</span> page</span>
                </div>
            </CardContent>
        </Card>
    );
}
