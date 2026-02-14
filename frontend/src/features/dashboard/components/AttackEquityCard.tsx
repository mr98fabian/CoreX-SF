import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sword, ShieldAlert, Zap, Calendar, Lightbulb, ShieldCheck, Trophy } from 'lucide-react';

interface AttackEquityCardProps {
    attackEquity: number;
    chaseBalance: number;
    shieldTarget: number;
    reservedForBills?: number; // New optional prop
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
    } | null;
    onSuccess: () => void;
}

export default function AttackEquityCard({
    attackEquity,
    chaseBalance,
    shieldTarget,
    reservedForBills = 0,
    velocityTarget,
    onSuccess
}: AttackEquityCardProps) {
    const [executing, setExecuting] = useState(false);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Rule: Show Execute button ONLY if we can fully pay off the target (or significantly attack it?)
    // User request: "Cuando el 'Attack Equity' sea mayor que la deuda... mostrar botón 'Execute Full Payoff'."
    // So strictly: if attackEquity >= velocityTarget.balance
    const canFullPayoff = velocityTarget && attackEquity >= velocityTarget.balance;
    const targetName = velocityTarget?.name || "No Debt";
    const targetBalance = velocityTarget?.balance || 0;

    const handleExecute = async () => {
        if (!velocityTarget) return;

        setExecuting(true);
        try {
            // Pay exact debt balance to clear it, or max equity?
            // "Execute Full Payoff" implies paying the balance.
            const payAmount = targetBalance;

            const payload = {
                movement_key: `attack-full-${new Date().getTime()}`,
                title: `FULL PAYOFF: ${targetName}`,
                amount: payAmount,
                date_planned: new Date().toISOString().split('T')[0],
                source: "Chase Cuenta",
                destination: targetName
            };

            await apiFetch('/api/strategy/execute', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Success!!
            onSuccess();
        } catch (error) {
            console.error("Attack failed", error);
            alert(`Attack Failed: ${error}`);
        } finally {
            setExecuting(false);
        }
    };

    return (
        <Card className="relative overflow-hidden group border-amber-500/30 bg-amber-950/10 hover:border-amber-500/60 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-amber-500 flex items-center gap-2">
                    Attack Equity <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Action</span>
                </CardTitle>
                <Sword className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
            </CardHeader>
            <CardContent className="relative z-10">
                <div className="flex flex-col gap-1 mb-4">
                    <div className="text-4xl font-extrabold text-gold-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] leading-tight">
                        {formatMoney(attackEquity)}
                    </div>

                    {reservedForBills > 0 ? (
                        <div className="flex flex-col gap-1 animate-fadeIn">
                            <span className="flex items-center gap-1.5 text-[10px] text-amber-500/80 font-medium px-2 py-0.5 bg-amber-950/40 rounded-full w-fit border border-amber-500/10">
                                <ShieldCheck className="h-3 w-3" />
                                <span>Reserved for bills: {formatMoney(reservedForBills)}</span>
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-600 pl-1">
                                <span>Liquid: {formatMoney(chaseBalance)}</span>
                                <span>-</span>
                                <span>Shield: {formatMoney(shieldTarget)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                                Chase: <span className="text-emerald-400">{formatMoney(chaseBalance)}</span>
                            </span>
                            <span>-</span>
                            <span className="flex items-center gap-1">
                                Shield: <span className="text-blue-400">{formatMoney(shieldTarget)}</span>
                            </span>
                        </div>
                    )}
                </div>

                {canFullPayoff ? (
                    <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
                        <Button
                            onClick={handleExecute}
                            disabled={executing}
                            variant="premium"
                            className="w-full shadow-lg shadow-amber-900/20"
                            size="sm"
                        >
                            {executing ? (
                                <span className="animate-pulse">Executing...</span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 fill-white" strokeWidth={1.5} />
                                    Execute Payoff ({formatMoney(targetBalance)})
                                </span>
                            )}
                        </Button>
                        <p className="text-[10px] text-zinc-500 text-center mt-2">
                            Target: <span className="text-rose-300 font-semibold">{targetName}</span>
                        </p>
                    </div>
                ) : (
                    <div>
                        {velocityTarget ? (
                            <div className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-950/30 p-2 rounded border border-amber-900/50">
                                <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
                                <span>Need {formatMoney(targetBalance - attackEquity)} more to kill {targetName}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-emerald-500 flex items-center gap-2">
                                <Trophy className="h-3 w-3" strokeWidth={1.5} />
                                No active debts. You are free.
                            </div>
                        )}
                    </div>
                )}

                {/* --- SMART ADVICE SECTION --- */}
                {velocityTarget && velocityTarget.action_date && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-bottom-3">
                        {/* Action Header */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500 font-medium uppercase tracking-wider">Próxima Acción</span>

                            {(() => {
                                const actionDate = new Date(velocityTarget.action_date);
                                const today = new Date();
                                actionDate.setHours(0, 0, 0, 0);
                                today.setHours(0, 0, 0, 0);

                                const isToday = actionDate.getTime() === today.getTime();
                                const isPast = actionDate.getTime() < today.getTime();

                                if (isToday) {
                                    return (
                                        <div className="flex items-center gap-1.5 text-emerald-950 bg-emerald-400 px-3 py-0.5 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse">
                                            <Calendar className="h-3 w-3" strokeWidth={2} />
                                            <span className="font-extrabold tracking-tight">HOY</span>
                                        </div>
                                    );
                                } else if (isPast) {
                                    return (
                                        <div className="flex items-center gap-1.5 text-rose-300 bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-900/50">
                                            <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
                                            <span className="font-bold">Acción Expirada</span>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-900/50">
                                            <Calendar className="h-3 w-3" strokeWidth={1.5} />
                                            <span className="font-mono">{actionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    );
                                }
                            })()}
                        </div>

                        {/* Justification Card */}
                        <div className="bg-zinc-950/50 rounded-lg p-3 border border-white/5 relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 left-0 w-0.5 h-full bg-amber-500/50" />
                            <div className="flex gap-2">
                                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                                <div className="space-y-1.5">
                                    <p className="text-sm text-zinc-300 leading-relaxed font-light">
                                        {velocityTarget.justification}
                                    </p>

                                    {/* Priority Reason */}
                                    {velocityTarget.priority_reason && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                            <Trophy className="h-3 w-3 text-amber-500" strokeWidth={1.5} />
                                            <span>{velocityTarget.priority_reason}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Peace Shield Note */}
                        {velocityTarget.shield_note && (
                            <div className="flex items-center gap-2 text-[10px] text-blue-400/80 px-2">
                                <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                                <span>{velocityTarget.shield_note}</span>
                            </div>
                        )}
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
