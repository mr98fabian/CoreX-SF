import { TrendingDown, ArrowRightLeft, AlertCircle, DollarSign } from 'lucide-react';
import type { ArbitrageAlert } from '../hooks/useStrategyData';

interface Props {
    alerts: ArbitrageAlert[];
}

const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const severityStyles = {
    critical: {
        bg: 'bg-gradient-to-br from-red-950/40 to-slate-950/60',
        border: 'border-red-500/40',
        badge: 'bg-red-500/20 text-red-400',
        icon: 'text-red-400',
        highlight: 'text-red-300',
    },
    warning: {
        bg: 'bg-gradient-to-br from-amber-950/30 to-slate-950/60',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400',
        icon: 'text-amber-400',
        highlight: 'text-amber-300',
    },
    info: {
        bg: 'bg-gradient-to-br from-yellow-950/20 to-slate-950/60',
        border: 'border-yellow-500/25',
        badge: 'bg-yellow-500/15 text-yellow-400',
        icon: 'text-yellow-400',
        highlight: 'text-yellow-300',
    },
};

export default function ArbitrageAlertPanel({ alerts }: Props) {
    if (!alerts || alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Interest Rate Arbitrage
                </h3>
            </div>

            {alerts.map((alert, idx) => {
                const style = severityStyles[alert.severity as keyof typeof severityStyles] || severityStyles.info;

                return (
                    <div
                        key={`arb-${idx}`}
                        className={`
                            rounded-xl border p-4 shadow-lg backdrop-blur-sm
                            ${style.bg} ${style.border}
                            animate-in slide-in-from-bottom-2 duration-300
                        `}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`p-2 rounded-lg bg-slate-100 dark:bg-black/20 ${style.icon} shrink-0 mt-0.5`}>
                                <AlertCircle size={18} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2.5">
                                {/* Badge + Title */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                                        {alert.severity.toUpperCase()}
                                    </span>
                                    <span className={`text-sm font-semibold ${style.highlight}`}>
                                        Money Leak Detected
                                    </span>
                                </div>

                                {/* Main message */}
                                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>

                                {/* Metrics row */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-black/20 text-center">
                                        <p className="text-[9px] text-slate-500 uppercase">Spread</p>
                                        <p className={`text-sm font-bold ${style.highlight}`}>{alert.rate_spread.toFixed(1)}%</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-black/20 text-center">
                                        <p className="text-[9px] text-slate-500 uppercase">Monthly Cost</p>
                                        <p className="text-sm font-bold text-red-400">
                                            <TrendingDown size={10} className="inline mr-1" />
                                            {formatMoney(alert.monthly_net_loss)}
                                        </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-black/20 text-center">
                                        <p className="text-[9px] text-slate-500 uppercase">Annual Loss</p>
                                        <p className="text-sm font-bold text-red-300">{formatMoney(alert.annual_net_loss)}</p>
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <DollarSign size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-emerald-300">{alert.recommendation}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
