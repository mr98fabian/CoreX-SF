import { AlertTriangle, AlertCircle, ShieldAlert, X, TrendingDown, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { DebtAlert } from '../hooks/useStrategyData';

interface Props {
    alerts: DebtAlert[];
}

const severityConfig = {
    critical: {
        icon: ShieldAlert,
        bg: 'bg-red-950/40',
        border: 'border-red-500/50',
        badge: 'bg-red-500/20 text-red-400',
        badgeText: 'CRITICAL',
        iconColor: 'text-red-400',
        titleColor: 'text-red-300',
        glow: 'shadow-red-500/10',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-amber-950/30',
        border: 'border-amber-500/40',
        badge: 'bg-amber-500/20 text-amber-400',
        badgeText: 'WARNING',
        iconColor: 'text-amber-400',
        titleColor: 'text-amber-300',
        glow: 'shadow-amber-500/10',
    },
    caution: {
        icon: AlertCircle,
        bg: 'bg-yellow-950/20',
        border: 'border-yellow-500/30',
        badge: 'bg-yellow-500/15 text-yellow-400',
        badgeText: 'CAUTION',
        iconColor: 'text-yellow-400',
        titleColor: 'text-yellow-300',
        glow: 'shadow-yellow-500/5',
    },
};

const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function DebtAlertBanner({ alerts }: Props) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    if (!alerts || alerts.length === 0) return null;

    const visible = alerts.filter(a => !dismissed.has(a.debt_name + a.severity));
    if (visible.length === 0) return null;

    const dismiss = (alert: DebtAlert) => {
        setDismissed(prev => new Set(prev).add(alert.debt_name + alert.severity));
    };

    return (
        <div className="space-y-3">
            {visible.map((alert, idx) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;

                return (
                    <div
                        key={`${alert.debt_name}-${alert.severity}-${idx}`}
                        className={`
                            relative rounded-xl border p-4 
                            ${config.bg} ${config.border} ${config.glow}
                            shadow-lg backdrop-blur-sm
                            animate-in slide-in-from-top-2 duration-300
                        `}
                    >
                        {/* Dismiss Button */}
                        <button
                            onClick={() => dismiss(alert)}
                            className="absolute top-3 right-3 p-1 rounded-lg
                                       text-slate-500 hover:text-slate-300 hover:bg-white/5
                                       transition-colors"
                            title="Dismiss"
                        >
                            <X size={14} />
                        </button>

                        <div className="flex items-start gap-3 pr-6">
                            {/* Icon */}
                            <div className={`p-2 rounded-lg bg-black/20 ${config.iconColor} shrink-0 mt-0.5`}>
                                <Icon size={20} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2">
                                {/* Header */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${config.badge}`}>
                                        {config.badgeText}
                                    </span>
                                    <h4 className={`text-sm font-bold ${config.titleColor}`}>
                                        {alert.title}
                                    </h4>
                                </div>

                                {/* Message */}
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    {alert.message}
                                </p>

                                {/* Details Bar */}
                                {alert.details && (
                                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                                        <span>Balance: {formatMoney(alert.details.balance)}</span>
                                        <span>APR: {alert.details.apr}%</span>
                                        {alert.details.shortfall !== undefined && (
                                            <span className="text-red-400 flex items-center gap-1">
                                                <TrendingDown size={12} />
                                                Shortfall: {formatMoney(alert.details.shortfall)}/mo
                                            </span>
                                        )}
                                        {alert.details.principal_pct !== undefined && (
                                            <span className="text-amber-400">
                                                Only {alert.details.principal_pct}% to principal
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Recommendation */}
                                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-black/20 border border-white/5">
                                    <ArrowRight size={14} className={`${config.iconColor} shrink-0 mt-0.5`} />
                                    <p className="text-xs text-slate-300">
                                        {alert.recommendation}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
