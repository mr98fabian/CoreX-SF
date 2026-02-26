import { Zap, Clock, DollarSign, ChevronRight } from 'lucide-react';
import type { FloatKillOpportunity } from '../hooks/useStrategyData';

interface Props {
    opportunities: FloatKillOpportunity[];
}

const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function FloatKillBanner({ opportunities }: Props) {
    if (!opportunities || opportunities.length === 0) return null;

    const killable = opportunities.filter(o => o.can_kill);
    const atRisk = opportunities.filter(o => !o.can_kill);

    return (
        <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-black/60 p-5 shadow-lg shadow-cyan-500/5 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/15">
                    <Zap className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
                        ⚡ Float Kill Opportunities
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Credit cards in grace period — pay now to keep 0% interest
                    </p>
                </div>
                {killable.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 animate-pulse">
                        {killable.length} KILLABLE
                    </span>
                )}
            </div>

            {/* Killable Cards */}
            {killable.length > 0 && (
                <div className="space-y-2 mb-3">
                    {killable.map((opp, idx) => (
                        <div
                            key={`kill-${idx}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/15 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white truncate">{opp.name}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                        CAN KILL
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{opp.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-cyan-300">{formatMoney(opp.balance)}</p>
                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <Clock size={10} />
                                    <span>{opp.days_until_due} days left</span>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                        </div>
                    ))}
                </div>
            )}

            {/* At-Risk Cards (not killable but in grace) */}
            {atRisk.length > 0 && (
                <div className="space-y-2">
                    {atRisk.map((opp, idx) => (
                        <div
                            key={`risk-${idx}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-300 truncate">{opp.name}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                                        AT RISK
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{opp.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-medium text-amber-300">{formatMoney(opp.balance)}</p>
                                <div className="flex items-center gap-1 text-[10px] text-red-400">
                                    <DollarSign size={10} />
                                    <span>{formatMoney(opp.monthly_interest_at_risk)}/mo at risk</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
