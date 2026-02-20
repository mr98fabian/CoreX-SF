import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import {
    CheckCircle2,
    Clock,
    CalendarOff,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Sparkles,
    AlertTriangle,
    X,
} from 'lucide-react';
import type { DueItem, ConfirmResult } from '@/hooks/useRecurringDueToday';

interface Props {
    items: DueItem[];
    confirmedCount: number;
    lastConfirmResult: ConfirmResult | null;
    onConfirm: (itemId: number, actualAmount: number) => Promise<ConfirmResult | null>;
    onSnooze: (itemId: number, mode: '2h' | 'tomorrow' | 'skip_month') => Promise<boolean>;
    onDismiss: () => void;
}

export default function RecurringConfirmModal({
    items,
    confirmedCount,
    lastConfirmResult,
    onConfirm,
    onSnooze,
    onDismiss,
}: Props) {
    const { language } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const isEs = language === 'es';

    const [editingAmounts, setEditingAmounts] = useState<Record<number, string>>({});
    const [confirming, setConfirming] = useState<number | null>(null);
    const [snoozing, setSnoozing] = useState<number | null>(null);
    const [showSnoozeMenu, setShowSnoozeMenu] = useState<number | null>(null);
    const [justConfirmed, setJustConfirmed] = useState<number | null>(null);

    const handleConfirm = async (item: DueItem) => {
        setConfirming(item.id);
        const amountStr = editingAmounts[item.id];
        const actualAmount = amountStr ? parseFloat(amountStr) : item.expected_amount;

        if (isNaN(actualAmount) || actualAmount < 0) {
            setConfirming(null);
            return;
        }

        const result = await onConfirm(item.id, actualAmount);
        if (result?.ok) {
            setJustConfirmed(item.id);
            setTimeout(() => setJustConfirmed(null), 1500);
        }
        setConfirming(null);
    };

    const handleSnooze = async (itemId: number, mode: '2h' | 'tomorrow' | 'skip_month') => {
        setSnoozing(itemId);
        await onSnooze(itemId, mode);
        setSnoozing(null);
        setShowSnoozeMenu(null);
    };

    const totalItems = items.length + confirmedCount;
    const progress = totalItems > 0 ? (confirmedCount / totalItems) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onDismiss}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
                {/* Header — gradient accent bar */}
                <div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />

                <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-400" />
                            {isEs ? 'Confirmación del Día' : "Today's Check-In"}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isEs
                                ? `${items.length} pendiente${items.length !== 1 ? 's' : ''} por confirmar`
                                : `${items.length} item${items.length !== 1 ? 's' : ''} pending confirmation`}
                        </p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Progress bar */}
                {totalItems > 0 && (
                    <div className="px-6 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                                {confirmedCount}/{totalItems}
                            </span>
                        </div>
                    </div>
                )}

                {/* Variance alert — shown after confirming if amount differed */}
                {lastConfirmResult && lastConfirmResult.variance !== 0 && (
                    <div className="mx-6 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-xs">
                            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                            <span className="text-amber-300">
                                <strong>{lastConfirmResult.item_name}</strong>:{' '}
                                {lastConfirmResult.variance > 0 ? '+' : ''}
                                {formatMoney(lastConfirmResult.variance)} ({lastConfirmResult.variance_pct > 0 ? '+' : ''}
                                {lastConfirmResult.variance_pct}%)
                                {isEs ? ' vs. lo esperado' : ' vs. expected'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Items list */}
                <div className="px-6 pb-4 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
                    {items.map((item) => {
                        const isItemConfirming = confirming === item.id;
                        const isItemSnoozing = snoozing === item.id;
                        const isItemJustConfirmed = justConfirmed === item.id;

                        return (
                            <div
                                key={item.id}
                                className={`
                                    relative rounded-xl border transition-all duration-300
                                    ${isItemJustConfirmed
                                        ? 'border-emerald-500/40 bg-emerald-500/10 scale-[0.98]'
                                        : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600/50'
                                    }
                                `}
                            >
                                <div className="p-4">
                                    {/* Top row: name + category badge */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`
                                                w-8 h-8 rounded-lg flex items-center justify-center text-sm
                                                ${item.is_income
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-rose-500/20 text-rose-400'
                                                }
                                            `}>
                                                {item.is_income ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                                <p className="text-[10px] text-slate-500">
                                                    {item.account_name || (isEs ? 'Sin cuenta vinculada' : 'No linked account')}
                                                    {' · '}
                                                    {item.frequency === 'monthly' ? (isEs ? 'Mensual' : 'Monthly')
                                                        : item.frequency === 'weekly' ? (isEs ? 'Semanal' : 'Weekly')
                                                            : item.frequency === 'biweekly' ? (isEs ? 'Quincenal' : 'Biweekly')
                                                                : item.frequency === 'semi_monthly' ? (isEs ? 'Bimensual' : 'Semi-monthly')
                                                                    : item.frequency === 'annually' ? (isEs ? 'Anual' : 'Annual')
                                                                        : item.frequency}
                                                </p>
                                            </div>
                                        </div>
                                        {item.is_variable && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium uppercase tracking-wider">
                                                {isEs ? 'Variable' : 'Variable'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Amount input row */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editingAmounts[item.id] ?? item.expected_amount}
                                                onChange={(e) =>
                                                    setEditingAmounts(prev => ({ ...prev, [item.id]: e.target.value }))
                                                }
                                                className="w-full pl-7 pr-3 py-2 text-sm font-mono bg-slate-900/80 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all"
                                                disabled={isItemConfirming}
                                            />
                                            {item.is_variable && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600">
                                                    {isEs ? 'editable' : 'editable'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Confirm button */}
                                        <button
                                            onClick={() => handleConfirm(item)}
                                            disabled={isItemConfirming}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                                        >
                                            {isItemConfirming ? (
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <CheckCircle2 size={14} />
                                            )}
                                            {isEs ? 'Confirmar' : 'Confirm'}
                                        </button>
                                    </div>

                                    {/* Snooze options */}
                                    <div className="mt-2.5 flex items-center gap-2">
                                        {showSnoozeMenu === item.id ? (
                                            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                                                <button
                                                    onClick={() => handleSnooze(item.id, '2h')}
                                                    disabled={isItemSnoozing}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-[10px] text-slate-400 hover:text-white transition-all"
                                                >
                                                    <Clock size={10} /> 2h
                                                </button>
                                                <button
                                                    onClick={() => handleSnooze(item.id, 'tomorrow')}
                                                    disabled={isItemSnoozing}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-[10px] text-slate-400 hover:text-white transition-all"
                                                >
                                                    <ArrowRight size={10} /> {isEs ? 'Mañana' : 'Tomorrow'}
                                                </button>
                                                <button
                                                    onClick={() => handleSnooze(item.id, 'skip_month')}
                                                    disabled={isItemSnoozing}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-rose-900/30 border border-slate-700/50 text-[10px] text-slate-400 hover:text-rose-400 transition-all"
                                                >
                                                    <CalendarOff size={10} /> {isEs ? 'Saltar mes' : 'Skip month'}
                                                </button>
                                                <button
                                                    onClick={() => setShowSnoozeMenu(null)}
                                                    className="px-1.5 py-1 rounded-md text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowSnoozeMenu(item.id)}
                                                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
                                            >
                                                <Clock size={10} />
                                                {isEs ? 'Posponer...' : 'Snooze...'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* All confirmed celebration */}
                {items.length === 0 && confirmedCount > 0 && (
                    <div className="px-6 pb-6 text-center animate-in zoom-in-95 fade-in duration-500">
                        <div className="text-4xl mb-2">🎯</div>
                        <p className="text-sm font-bold text-emerald-400">
                            {isEs ? '¡Todo confirmado!' : 'All confirmed!'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {isEs
                                ? `${confirmedCount} transacción${confirmedCount !== 1 ? 'es' : ''} registrada${confirmedCount !== 1 ? 's' : ''} hoy`
                                : `${confirmedCount} transaction${confirmedCount !== 1 ? 's' : ''} logged today`}
                        </p>
                        <p className="text-xs text-amber-400/80 mt-2 flex items-center justify-center gap-1">
                            <Sparkles size={12} />
                            {isEs ? '+1 a tu racha de actividad' : '+1 to your activity streak'}
                        </p>
                        <button
                            onClick={onDismiss}
                            className="mt-4 px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white transition-colors"
                        >
                            {isEs ? 'Cerrar' : 'Close'}
                        </button>
                    </div>
                )}

                {/* Footer — disclaimer */}
                <div className="px-6 py-3 border-t border-slate-800/50 bg-slate-900/50">
                    <p className="text-[10px] text-slate-600 text-center">
                        {isEs
                            ? 'Confirmar registra la transacción y actualiza tu saldo automáticamente'
                            : 'Confirming logs the transaction and auto-updates your balance'}
                    </p>
                </div>
            </div>
        </div>
    );
}
