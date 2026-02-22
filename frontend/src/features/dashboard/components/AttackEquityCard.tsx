import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sword, ShieldAlert, Zap, Calendar, Lightbulb, ShieldCheck, Trophy, Banknote, Link2, Home, Loader2 } from 'lucide-react';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface AttackEquityCardProps {
    attackEquity: number;
    chaseBalance: number;
    shieldTarget: number;
    reservedForBills?: number;
    velocityTarget: {
        name: string;
        balance: number;
        interest_rate: number;
        min_payment: number;
        action_date?: string;
        priority_reason?: string;
        justification?: string;
        shield_note?: string;
        daily_interest_saved?: number;
        recommended_source?: RecommendedSource | null;
        checking_account_name?: string;
    } | null;
    velocityWeapons?: Array<{
        name: string;
        weapon_type: string;
        balance: number;
        credit_limit: number;
        available_credit: number;
        interest_rate: number;
    }>;
    onExecuteAttack?: (transfers: Array<{ source: string; dest: string; amount: number; title: string }>) => void;
    executingAttack?: boolean;
}

const SOURCE_ICONS: Record<string, typeof Banknote> = {
    cash: Banknote,
    uil: Link2,
    heloc: Home,
    combined: Zap,
    multi: Banknote,
};

const SOURCE_LABELS: Record<string, string> = {
    cash: '💰 Cash',
    uil: '🔗 UIL',
    heloc: '🏠 HELOC',
    combined: '⚡ Combo',
    multi: '💰 Multi-Source',
};

const ACCOUNT_TYPE_ICON: Record<string, string> = {
    checking: '🏦',
    savings: '🐷',
    uil: '🔗',
    heloc: '🏠',
};

export default function AttackEquityCard({
    attackEquity,
    chaseBalance,
    shieldTarget,
    reservedForBills = 0,
    velocityTarget,
    velocityWeapons = [],
    onExecuteAttack,
    executingAttack = false,
}: AttackEquityCardProps) {
    const { formatMoney } = useFormatMoney();
    const [showConfirm, setShowConfirm] = useState(false);

    const canFullPayoff = velocityTarget && attackEquity >= velocityTarget.balance;
    const targetName = velocityTarget?.name || "No Debt";
    const targetBalance = velocityTarget?.balance || 0;
    const rec = velocityTarget?.recommended_source;

    const canExecute = attackEquity > 0 && velocityTarget && rec;

    // Build transfer list from allocation_plan + weapon_allocations
    const allAllocations: AllocationEntry[] = [
        ...(rec?.allocation_plan || []),
        ...(rec?.weapon_allocations || []),
    ];

    const handleExecute = () => {
        if (!rec || !velocityTarget || !onExecuteAttack) return;

        // Build one transfer per source account
        const transfers = allAllocations.map((a) => ({
            source: a.source_name,
            dest: velocityTarget.name,
            amount: a.amount,
            title: `Attack ${velocityTarget.name} from ${a.source_name}`,
        }));

        if (transfers.length > 0) {
            onExecuteAttack(transfers);
        }
        setShowConfirm(false);
    };

    return (
        <>
            <Card className="relative overflow-hidden group border-amber-300 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/10 dark:to-slate-950 hover:border-amber-400 dark:hover:border-amber-500/60 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-500 flex items-center gap-2">
                        Attack Equity <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">Action</span>
                    </CardTitle>
                    <Sword className="h-4 w-4 text-amber-600 dark:text-amber-500" strokeWidth={1.5} />
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="flex flex-col gap-1 mb-4">
                        <div className="text-4xl font-extrabold text-amber-700 dark:text-amber-400 drop-shadow-none dark:drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] leading-tight">
                            {formatMoney(attackEquity)}
                        </div>

                        {reservedForBills > 0 ? (
                            <div className="flex flex-col gap-1 animate-fadeIn">
                                <span className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-500/80 font-medium px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 rounded-full w-fit border border-amber-300 dark:border-amber-500/10">
                                    <ShieldCheck className="h-3 w-3" />
                                    <span>Reserved for bills: {formatMoney(reservedForBills)}</span>
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-zinc-600 pl-1">
                                    <span>Liquid: {formatMoney(chaseBalance)}</span>
                                    <span>-</span>
                                    <span>Shield: {formatMoney(shieldTarget)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                                <span className="flex items-center gap-1">
                                    Chase: <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(chaseBalance)}</span>
                                </span>
                                <span>-</span>
                                <span className="flex items-center gap-1">
                                    Shield: <span className="text-blue-600 dark:text-blue-400">{formatMoney(shieldTarget)}</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Status indicator — informational only */}
                    {canFullPayoff ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30 p-2 rounded border border-emerald-300 dark:border-emerald-900/50">
                            <Zap className="h-3 w-3 fill-emerald-600 dark:fill-emerald-400" strokeWidth={1.5} />
                            <span>Ready to eliminate <span className="font-semibold text-slate-900 dark:text-white">{targetName}</span> ({formatMoney(targetBalance)})</span>
                        </div>
                    ) : (
                        <div>
                            {velocityTarget ? (
                                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-500/80 bg-amber-100 dark:bg-amber-950/30 p-2 rounded border border-amber-300 dark:border-amber-900/50">
                                    <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
                                    <span>Need {formatMoney(targetBalance - attackEquity)} more to kill {targetName}</span>
                                </div>
                            ) : (
                                <div className="text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
                                    <Trophy className="h-3 w-3" strokeWidth={1.5} />
                                    No active debts. You are free.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ EXECUTE ATTACK BUTTON ═══ */}
                    {canExecute && onExecuteAttack && rec && (
                        <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Recommendation badge */}
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-500">
                                    {(() => {
                                        const Icon = SOURCE_ICONS[rec.type] || Banknote;
                                        return <Icon className="h-3 w-3" strokeWidth={1.5} />;
                                    })()}
                                    <span>{rec.reason_es}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                    {SOURCE_LABELS[rec.type] || rec.type}
                                </span>
                            </div>

                            {/* Execute button */}
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
                                        EJECUTAR ATAQUE — {formatMoney(rec.amount)}
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* --- SMART ADVICE SECTION --- */}
                    {velocityTarget && velocityTarget.action_date && (
                        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-white/5 space-y-3 animate-in fade-in slide-in-from-bottom-3">
                            {/* Action Header */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-zinc-500 font-medium uppercase tracking-wider">Próxima Acción</span>

                                {(() => {
                                    const actionDate = new Date(velocityTarget.action_date);
                                    const today = new Date();
                                    actionDate.setHours(0, 0, 0, 0);
                                    today.setHours(0, 0, 0, 0);

                                    const isToday = actionDate.getTime() === today.getTime();
                                    const isPast = actionDate.getTime() < today.getTime();

                                    if (isToday) {
                                        return (
                                            <div className="flex items-center gap-1.5 text-white dark:text-emerald-950 bg-emerald-500 dark:bg-emerald-400 px-3 py-0.5 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse">
                                                <Calendar className="h-3 w-3" strokeWidth={2} />
                                                <span className="font-extrabold tracking-tight">HOY</span>
                                            </div>
                                        );
                                    } else if (isPast) {
                                        return (
                                            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-900/50">
                                                <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
                                                <span className="font-bold">Acción Expirada</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-900/50">
                                                <Calendar className="h-3 w-3" strokeWidth={1.5} />
                                                <span className="font-mono">{actionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>

                            {/* Justification Card */}
                            <div className="bg-amber-50/50 dark:bg-zinc-950/50 rounded-lg p-3 border border-amber-200 dark:border-white/5 relative overflow-hidden backdrop-blur-sm">
                                <div className="absolute top-0 left-0 w-0.5 h-full bg-amber-400 dark:bg-amber-500/50" />
                                <div className="flex gap-2">
                                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                                    <div className="space-y-1.5">
                                        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-light">
                                            {velocityTarget.justification}
                                        </p>

                                        {/* Priority Reason */}
                                        {velocityTarget.priority_reason && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-500">
                                                <Trophy className="h-3 w-3 text-amber-600 dark:text-amber-500" strokeWidth={1.5} />
                                                <span>{velocityTarget.priority_reason}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Peace Shield Note */}
                            {velocityTarget.shield_note && (
                                <div className="flex items-center gap-2 text-[10px] text-blue-600 dark:text-blue-400/80 px-2">
                                    <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                                    <span>{velocityTarget.shield_note}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- VELOCITY WEAPONS ARSENAL --- */}
                    {velocityWeapons.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Zap className="h-3 w-3 fill-cyan-400" strokeWidth={1.5} />
                                Arsenal Velocity
                            </span>
                            {velocityWeapons.map((w, i) => (
                                <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md bg-cyan-950/20 border border-cyan-500/10">
                                    <div className="flex flex-col">
                                        <span className="text-slate-300 font-medium">{w.name}</span>
                                        <span className="text-[9px] text-cyan-600">{w.interest_rate}% APR · {w.weapon_type.toUpperCase()}</span>
                                    </div>
                                    <span className="text-cyan-400 font-mono font-bold">{formatMoney(w.available_credit)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                </CardContent>
            </Card>

            {/* ═══ CONFIRMATION DIALOG ═══ */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="border-amber-500/30">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <Sword className="h-5 w-5" />
                            Confirmar Ataque
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                {/* Target summary */}
                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-500/20 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-zinc-500">Target:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{targetName} ({velocityTarget?.interest_rate}% APR)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-zinc-500">Total Ataque:</span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400">{formatMoney(rec?.amount || 0)}</span>
                                    </div>
                                </div>

                                {/* Per-account breakdown */}
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Desglose por cuenta:</span>
                                    {allAllocations.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{ACCOUNT_TYPE_ICON[a.source_type] || '💳'}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">{a.source_name}</span>
                                                    {a.balance_after !== undefined && (
                                                        <span className="text-[10px] text-slate-400 dark:text-zinc-600">Queda: {formatMoney(a.balance_after)}</span>
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
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleExecute}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                        >
                            <Zap className="h-4 w-4 mr-1 fill-white" strokeWidth={1.5} />
                            Confirmar Ataque
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
