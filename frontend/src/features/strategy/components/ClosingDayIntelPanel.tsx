import { CalendarDays, ShoppingCart, CreditCard, Clock, Info } from 'lucide-react';
import { useState } from 'react';
import type { ClosingDayIntel } from '../hooks/useStrategyData';

interface TipItem {
    type: string;
    message: string;
}

interface Props {
    intelligence: ClosingDayIntel[];
}

export default function ClosingDayIntelPanel({ intelligence }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (!intelligence || intelligence.length === 0) return null;

    return (
        <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/30 to-slate-950/60 p-5 shadow-lg backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-500/15">
                    <CalendarDays className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-violet-300 uppercase tracking-wider">
                        📅 Closing Day Intelligence
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Optimal purchase & payment timing per card
                    </p>
                </div>
            </div>

            {/* Cards */}
            <div className="space-y-2">
                {intelligence.map((card) => {
                    const isOpen = expanded === card.name;

                    return (
                        <div
                            key={card.name}
                            className={`
                                rounded-lg border transition-all duration-200 cursor-pointer
                                ${isOpen
                                    ? 'border-violet-500/40 bg-violet-500/10'
                                    : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/40 hover:border-violet-400 dark:hover:border-violet-500/20'
                                }
                            `}
                            onClick={() => setExpanded(isOpen ? null : card.name)}
                        >
                            {/* Summary Row */}
                            <div className="flex items-center gap-3 p-3">
                                <CreditCard className="h-4 w-4 text-violet-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">{card.name}</span>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                                        <span>Closes: Day {card.closing_day}</span>
                                        {card.due_day > 0 && <span>Due: Day {card.due_day}</span>}
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase
                                            ${card.cycle_position === 'early'
                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                : card.cycle_position === 'pre_close'
                                                    ? 'bg-amber-500/15 text-amber-400'
                                                    : 'bg-slate-500/15 text-slate-400'
                                            }
                                        `}>
                                            {card.cycle_position.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex items-center gap-1 text-xs text-violet-300">
                                        <ShoppingCart size={12} />
                                        <span className="font-semibold">{card.float_days_if_buy_today}d float</span>
                                    </div>
                                    {card.credit_utilization !== null && (
                                        <span className={`text-[10px] ${card.credit_utilization > 30 ? 'text-amber-400' : 'text-emerald-400'
                                            }`}>
                                            {card.credit_utilization}% util.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isOpen && (
                                <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700/50 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                    {/* Timing Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-black/20 text-center">
                                            <p className="text-[10px] text-slate-500 uppercase">Days to Close</p>
                                            <p className="text-lg font-bold text-violet-300">{card.days_until_close}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-black/20 text-center">
                                            <p className="text-[10px] text-slate-500 uppercase">Grace Period</p>
                                            <p className="text-lg font-bold text-slate-300">{card.grace_period_days}d</p>
                                        </div>
                                    </div>

                                    {/* Optimal Window */}
                                    {card.optimal_purchase_window && (
                                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <ShoppingCart size={14} className="text-emerald-400 shrink-0" />
                                            <p className="text-xs text-emerald-300">
                                                <span className="font-semibold">Best time to buy:</span>{' '}
                                                Day {card.optimal_purchase_window.start_day} – {card.optimal_purchase_window.end_day}
                                                {' '}(max float)
                                            </p>
                                        </div>
                                    )}

                                    {/* Tips */}
                                    {card.tips.length > 0 && (
                                        <div className="space-y-1.5">
                                            {card.tips.map((tip: TipItem | string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                                    <Info size={12} className="text-violet-400 shrink-0 mt-0.5" />
                                                    <span>{typeof tip === 'string' ? tip : tip.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Due Countdown */}
                                    {card.days_until_due !== null && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <Clock size={12} className={
                                                card.days_until_due <= 5 ? 'text-red-400' : 'text-slate-500'
                                            } />
                                            <span className={
                                                card.days_until_due <= 5
                                                    ? 'text-red-300 font-semibold'
                                                    : 'text-slate-400'
                                            }>
                                                {card.days_until_due <= 5
                                                    ? `⚠️ Payment due in ${card.days_until_due} days!`
                                                    : `Payment due in ${card.days_until_due} days`
                                                }
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
