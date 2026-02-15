import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
    ListChecks,
    ChevronLeft,
    ChevronRight,
    Zap,
    Shield,
    ArrowRightLeft,
    Clock,
    CheckCircle2,
    Loader2,
    Calendar,
    History,
    Play,
    TrendingDown,
    Timer,
    DollarSign,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface TacticalMovement {
    day: number;
    date: string;
    display_date: string;
    title: string;
    description: string;
    amount: number;
    type: string;
    source: string;
    destination: string;
    daily_interest_saved: number;
    days_shortened: number;
}

interface ExecutedTransaction {
    id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
}

interface AccountInfo {
    id: number;
    name: string;
    type: string;
    balance: number;
    interest_rate: number;
}

// ─── Helpers ─────────────────────────────────────────────────
const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** Color & icon mapping by movement type */
const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
    attack: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: <Zap size={14} />, label: 'Debt Attack' },
    shield: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', icon: <Shield size={14} />, label: 'Shield' },
    min_payment: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: <ArrowRightLeft size={14} />, label: 'Min Payment' },
    income: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', icon: <DollarSign size={14} />, label: 'Income' },
    expense: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: <ArrowRightLeft size={14} />, label: 'Expense' },
};

const getTypeStyle = (type: string) =>
    TYPE_STYLES[type] ?? TYPE_STYLES['expense'];

// ═══════════════════════════════════════════════════════════════
// ACTION PLAN PAGE
// ═══════════════════════════════════════════════════════════════
export default function ActionPlanPage() {
    usePageTitle('Action Plan');
    const { toast } = useToast();

    // ── State ────────────────────────────────────────────────
    const [movements, setMovements] = useState<TacticalMovement[]>([]);
    const [executedTxs, setExecutedTxs] = useState<ExecutedTransaction[]>([]);
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [executingKey, setExecutingKey] = useState<string | null>(null);

    // Confirmation dialog state
    const [confirmTarget, setConfirmTarget] = useState<TacticalMovement | null>(null);

    // Month navigator: 0 = current, 1 = next
    const [monthOffset, setMonthOffset] = useState(0);

    const currentMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthOffset);
        return { month: d.getMonth(), year: d.getFullYear() };
    }, [monthOffset]);

    const monthLabel = `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`;

    // ── Data Fetching ────────────────────────────────────────
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [gpsData, txData, accData] = await Promise.all([
                apiFetch<TacticalMovement[]>('/api/strategy/tactical-gps'),
                apiFetch<ExecutedTransaction[]>('/api/transactions/recent?limit=100'),
                apiFetch<AccountInfo[]>('/api/accounts'),
            ]);
            setMovements(Array.isArray(gpsData) ? gpsData : []);
            setAccounts(Array.isArray(accData) ? accData : []);
            // Filter only velocity executions for the history
            const velocityTxs = (Array.isArray(txData) ? txData : [])
                .filter((tx: ExecutedTransaction) => tx.description?.startsWith('Velocity Execution'));
            setExecutedTxs(velocityTxs);
        } catch (err) {
            console.error('Action Plan fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Filter movements by selected month ───────────────────
    const filteredMovements = useMemo(() => {
        return movements.filter((m) => {
            const d = new Date(m.date);
            return d.getMonth() === currentMonth.month && d.getFullYear() === currentMonth.year;
        });
    }, [movements, currentMonth]);

    // ── Summary counters ─────────────────────────────────────
    const summary = useMemo(() => {
        const attacks = filteredMovements.filter(m => m.type === 'attack');
        const shields = filteredMovements.filter(m => m.type === 'shield');
        const mins = filteredMovements.filter(m => m.type === 'min_payment');
        const incomes = filteredMovements.filter(m => m.type === 'income');
        const totalAttack = attacks.reduce((sum, m) => sum + m.amount, 0);
        const totalShield = shields.reduce((sum, m) => sum + m.amount, 0);
        const totalMin = mins.reduce((sum, m) => sum + m.amount, 0);
        const totalIncome = incomes.reduce((sum, m) => sum + m.amount, 0);
        return { attackCount: attacks.length, shieldCount: shields.length, totalAttack, totalShield, totalMin, totalIncome, minCount: mins.length, incomeCount: incomes.length };
    }, [filteredMovements]);

    // ── Execute handler (opens confirmation first) ──────────
    const handleRequestExecute = (movement: TacticalMovement) => {
        setConfirmTarget(movement);
    };

    const handleConfirmExecute = async () => {
        if (!confirmTarget) return;
        const movement = confirmTarget;
        setConfirmTarget(null);

        const key = `${movement.date}-${movement.title}`;
        setExecutingKey(key);
        try {
            await apiFetch('/api/strategy/execute', {
                method: 'POST',
                body: JSON.stringify({
                    movement_key: key,
                    title: movement.title,
                    amount: movement.amount,
                    date_planned: movement.date,
                    source: movement.source,
                    destination: movement.destination,
                }),
            });
            toast({
                title: '⚡ Movement Executed',
                description: `${formatMoney(movement.amount)} moved: ${movement.source} → ${movement.destination}`,
            });
            await fetchData();
        } catch {
            toast({
                title: 'Execution Failed',
                description: 'Could not complete the transfer. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setExecutingKey(null);
        }
    };

    // ── Calculate impact for executed transactions ───────────
    const getImpactForTx = (tx: ExecutedTransaction) => {
        // Extract the destination account name from the description
        // Format: "Velocity Execution: ATTACK: {name}" or "Velocity Execution: PAY OFF: {name}"
        const desc = tx.description.replace('Velocity Execution: ', '');
        const parts = desc.split(': ');
        const destName = parts.length > 1 ? parts.slice(1).join(': ') : parts[0];

        // Find the matching debt account to get interest rate
        const debtAcc = accounts.find(a =>
            a.type === 'debt' && a.name.toLowerCase() === destName.toLowerCase()
        );

        if (!debtAcc || !debtAcc.interest_rate) {
            return { dailySaved: 0, monthlySaved: 0, daysShortened: 0 };
        }

        const apr = debtAcc.interest_rate;
        const dailySaved = (tx.amount * (apr / 100)) / 365;
        const monthlySaved = dailySaved * 30;

        // Approximate days shortened: how many days of interest this payment covers
        const dailyDebtCost = (debtAcc.balance * (apr / 100)) / 365;
        const daysShortened = dailyDebtCost > 0 ? Math.round(tx.amount / dailyDebtCost) : 0;

        return { dailySaved, monthlySaved, daysShortened };
    };

    // ── Loading State ────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="text-xl font-mono text-emerald-400 animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                    Loading Action Plan...
                </div>
            </div>
        );
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-8">
            {/* ────── CONFIRMATION DIALOG ────── */}
            <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
                <AlertDialogContent className="bg-slate-950 border-white/10 max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white flex items-center gap-2">
                            <Zap className="text-emerald-400" size={20} />
                            Confirm Execution
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400 space-y-4">
                            <p>Did you already make this transfer?</p>
                            {confirmTarget && (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-300 font-medium">{confirmTarget.title}</span>
                                        <span className="text-lg font-bold text-emerald-400">{formatMoney(confirmTarget.amount)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="bg-white/5 border border-white/10 rounded-md px-2 py-0.5">{confirmTarget.source}</span>
                                        <span>→</span>
                                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md px-2 py-0.5">{confirmTarget.destination}</span>
                                    </div>
                                    {confirmTarget.type === 'attack' && confirmTarget.daily_interest_saved > 0 && (
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                            <TrendingDown size={14} className="text-emerald-400" />
                                            <span className="text-xs text-emerald-400">
                                                Saves {formatMoney(confirmTarget.daily_interest_saved)}/day · ~{confirmTarget.days_shortened} days sooner to freedom
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmExecute}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                        >
                            <CheckCircle2 size={16} className="mr-1.5" />
                            Yes, I executed this
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ────── HEADER ────── */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
                    Action Plan
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Your 2-month optimized battle plan. Confirm each movement after you execute it.
                </p>
            </div>

            {/* ────── MONTH NAVIGATOR ────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMonthOffset(prev => Math.max(prev - 1, 0))}
                        disabled={monthOffset === 0}
                        className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                    >
                        <ChevronLeft size={20} />
                    </Button>

                    <div className="flex items-center gap-2 min-w-[180px] justify-center">
                        <Calendar size={16} className="text-amber-400" />
                        <span className="text-lg font-semibold text-white">{monthLabel}</span>
                        {monthOffset === 0 && (
                            <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                                Current
                            </span>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMonthOffset(prev => Math.min(prev + 1, 1))}
                        disabled={monthOffset >= 1}
                        className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                    >
                        <ChevronRight size={20} />
                    </Button>
                </div>

                {/* Month summary pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    {summary.incomeCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1">
                            <DollarSign size={12} />
                            {summary.incomeCount} income · {formatMoney(summary.totalIncome)}
                        </div>
                    )}
                    {summary.attackCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                            <Zap size={12} />
                            {summary.attackCount} attacks · {formatMoney(summary.totalAttack)}
                        </div>
                    )}
                    {summary.minCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                            <ArrowRightLeft size={12} />
                            {summary.minCount} min payments · {formatMoney(summary.totalMin)}
                        </div>
                    )}
                    {summary.shieldCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1">
                            <Shield size={12} />
                            {summary.shieldCount} shields · {formatMoney(summary.totalShield)}
                        </div>
                    )}
                </div>
            </div>

            {/* ────── ACTION QUEUE TABLE ────── */}
            <Card className="relative overflow-hidden border-white/5 bg-slate-950/60 backdrop-blur-xl">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-zinc-200 flex items-center gap-2">
                        <ListChecks className="text-emerald-400" size={20} />
                        Scheduled Movements
                        <span className="text-xs text-slate-500 font-normal ml-2">
                            {filteredMovements.length} movement{filteredMovements.length !== 1 ? 's' : ''} this month
                        </span>
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {filteredMovements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Calendar size={40} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">No movements scheduled for {monthLabel}</p>
                            <p className="text-xs mt-1 text-slate-600">Add income and debt accounts to generate your action plan</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5">
                                <div className="col-span-2">Date</div>
                                <div className="col-span-3">Action</div>
                                <div className="col-span-2">From</div>
                                <div className="col-span-2">To</div>
                                <div className="col-span-1 text-right">Amount</div>
                                <div className="col-span-1 text-center">Type</div>
                                <div className="col-span-1 text-center">Exec</div>
                            </div>

                            {/* Movement Rows */}
                            {filteredMovements.map((m, i) => {
                                const style = getTypeStyle(m.type);
                                const key = `${m.date}-${m.title}`;
                                const isToday = m.date === today;
                                const isPast = m.date < today;
                                const isExecuting = executingKey === key;

                                return (
                                    <div
                                        key={`${m.date}-${m.title}-${i}`}
                                        className={`
                                            grid grid-cols-12 gap-3 px-4 py-3 rounded-lg transition-all duration-200
                                            ${isToday
                                                ? 'bg-emerald-500/5 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                                                : isPast
                                                    ? 'opacity-50 bg-white/[0.01]'
                                                    : 'bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/5'
                                            }
                                        `}
                                    >
                                        {/* Date */}
                                        <div className="col-span-2 flex items-center gap-2">
                                            {isToday && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                                            <span className={`text-sm font-mono ${isToday ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}>
                                                {m.display_date}
                                            </span>
                                            {isToday && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                    today
                                                </span>
                                            )}
                                        </div>

                                        {/* Title + impact inline */}
                                        <div className="col-span-3 flex flex-col justify-center">
                                            <span className="text-sm text-white font-medium truncate">{m.title}</span>
                                            {m.type === 'attack' && m.daily_interest_saved > 0 ? (
                                                <span className="text-[11px] text-emerald-500/80 flex items-center gap-1">
                                                    <TrendingDown size={10} />
                                                    saves {formatMoney(m.daily_interest_saved)}/day · {m.days_shortened}d sooner
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-slate-500 truncate">{m.description}</span>
                                            )}
                                        </div>

                                        {/* Source */}
                                        <div className="col-span-2 flex items-center">
                                            <span className="text-xs font-medium text-slate-300 bg-white/5 border border-white/10 rounded-md px-2 py-1 truncate">
                                                {m.source}
                                            </span>
                                        </div>

                                        {/* Destination */}
                                        <div className="col-span-2 flex items-center gap-1.5">
                                            <span className="text-slate-600">→</span>
                                            <span className={`text-xs font-medium ${style.text} ${style.bg} border ${style.border} rounded-md px-2 py-1 truncate`}>
                                                {m.destination}
                                            </span>
                                        </div>

                                        {/* Amount */}
                                        <div className={`col-span-1 flex items-center justify-end text-sm font-bold ${style.text}`}>
                                            {formatMoney(m.amount)}
                                        </div>

                                        {/* Type Badge */}
                                        <div className="col-span-1 flex items-center justify-center">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${style.text} ${style.bg} border ${style.border} rounded-full px-2 py-0.5`}>
                                                {style.icon}
                                                {m.type === 'min_payment' ? 'Min' : m.type.slice(0, 3)}
                                            </span>
                                        </div>

                                        {/* Execute Button */}
                                        <div className="col-span-1 flex items-center justify-center">
                                            {isPast ? (
                                                <Clock size={14} className="text-slate-600" />
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={isExecuting}
                                                    onClick={() => handleRequestExecute(m)}
                                                    className={`h-7 w-7 p-0 rounded-full transition-all ${isToday
                                                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/30'
                                                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                                                        }`}
                                                >
                                                    {isExecuting ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Play size={12} />
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ────── EXECUTION HISTORY (with Impact Metrics) ────── */}
            <Card className="border-white/5 bg-slate-950/60 backdrop-blur-xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-zinc-200 flex items-center gap-2">
                        <History className="text-amber-400" size={20} />
                        Execution History
                        <span className="text-xs text-slate-500 font-normal ml-2">
                            {executedTxs.length} executed
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {executedTxs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                            <CheckCircle2 size={32} className="mb-2 opacity-20" />
                            <p className="text-sm">No movements executed yet</p>
                            <p className="text-xs text-slate-600 mt-1">Use the play button above to start executing your plan</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {executedTxs.map((tx) => {
                                const impact = getImpactForTx(tx);
                                return (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm text-white font-medium truncate">
                                                    {tx.description.replace('Velocity Execution: ', '')}
                                                </p>
                                                <p className="text-[11px] text-slate-500 font-mono">{tx.date}</p>
                                            </div>
                                        </div>

                                        {/* Impact Metrics */}
                                        {impact.dailySaved > 0 && (
                                            <div className="flex items-center gap-4 mr-6">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <TrendingDown size={12} className="text-emerald-500" />
                                                    <span className="text-emerald-400 font-medium">
                                                        {formatMoney(impact.dailySaved)}<span className="text-emerald-600">/day</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <DollarSign size={12} className="text-emerald-500" />
                                                    <span className="text-emerald-400 font-medium">
                                                        {formatMoney(impact.monthlySaved)}<span className="text-emerald-600">/mo</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Timer size={12} className="text-amber-400" />
                                                    <span className="text-amber-400 font-medium">
                                                        -{impact.daysShortened}d
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{formatMoney(tx.amount)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
