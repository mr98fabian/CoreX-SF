import { useEffect, useState, useMemo, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { apiFetch } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import UpgradeModal from '@/components/UpgradeModal';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    Search,
    SlidersHorizontal,
    X,
    Lock,
} from 'lucide-react';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPlanLimit } from '@/lib/planLimits';

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
    balance_before: number;
    balance_after: number;
    total_interest_saved: number;
    funding_balance_after: number;
    debt_progress_pct: number;
}

interface ExecutedTransaction {
    id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
    account_id?: number;
    account_name?: string;
}

interface HistoryResponse {
    transactions: ExecutedTransaction[];
    total: number;
    limit: number;
    offset: number;
}

interface AccountInfo {
    id: number;
    name: string;
    type: string;
    balance: number;
    interest_rate: number;
}

interface TacticalGPSResponse {
    movements: TacticalMovement[];
    freedom_date_velocity: string | null;
    freedom_date_standard: string | null;
    months_saved: number;
    interest_saved: number;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Color & icon mapping by movement type */
const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; labelKey: string }> = {
    attack: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: <Zap size={14} />, labelKey: 'actionPlan.debtAttack' },
    shield: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', icon: <Shield size={14} />, labelKey: 'actionPlan.payment' },
    min_payment: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: <ArrowRightLeft size={14} />, labelKey: 'actionPlan.payment' },
    income: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', icon: <DollarSign size={14} />, labelKey: 'actionPlan.income' },
    expense: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: <ArrowRightLeft size={14} />, labelKey: 'actionPlan.transfer' },
};

const getTypeStyle = (type: string) =>
    TYPE_STYLES[type] ?? TYPE_STYLES['expense'];

/** Category color mapping for transaction badges */
const getCategoryColor = (category: string): string => {
    const lower = category.toLowerCase();
    if (lower.includes('income') || lower.includes('salary') || lower.includes('deposit')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    if (lower.includes('transport') || lower.includes('auto') || lower.includes('gas')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    if (lower.includes('entertainment') || lower.includes('streaming')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    if (lower.includes('shopping') || lower.includes('retail')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300';
    if (lower.includes('util') || lower.includes('bill') || lower.includes('electric')) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';
    if (lower.includes('health') || lower.includes('medical')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (lower.includes('housing') || lower.includes('rent') || lower.includes('mortgage')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (lower.includes('payment') || lower.includes('velocity') || lower.includes('attack')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300';
};

// ═══════════════════════════════════════════════════════════════
// ACTION PLAN PAGE
// ═══════════════════════════════════════════════════════════════
export default function ActionPlanPage() {
    const { t, language } = useLanguage();
    const isMobile = useIsMobile();
    const { formatMoney } = useFormatMoney();
    usePageTitle(t('actionPlan.title'));
    const { toast } = useToast();

    // ── State ────────────────────────────────────────────────
    const [movements, setMovements] = useState<TacticalMovement[]>([]);
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [executingKey, setExecutingKey] = useState<string | null>(null);

    // Freedom date projections from tactical-gps
    const [freedomDateVelocity, setFreedomDateVelocity] = useState<string | null>(null);
    const [freedomDateStandard, setFreedomDateStandard] = useState<string | null>(null);
    const [monthsSaved, setMonthsSaved] = useState(0);

    // Confirmation dialog state
    const [confirmTarget, setConfirmTarget] = useState<TacticalMovement | null>(null);

    // Upgrade modal
    const [showUpgrade, setShowUpgrade] = useState(false);

    // Month navigator: 0 = current, 1 = next
    const [monthOffset, setMonthOffset] = useState(0);

    // ── History filters & pagination state ────────────────────
    const [historyTxs, setHistoryTxs] = useState<ExecutedTransaction[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(0);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [historyAccountFilter, setHistoryAccountFilter] = useState('all');
    const [historyCategoryFilter, setHistoryCategoryFilter] = useState('all');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    const [showHistoryFilters, setShowHistoryFilters] = useState(false);
    const HISTORY_PER_PAGE = 15;

    // Format a date string (YYYY-MM-DD) into a locale-friendly label
    const formatFreedomDate = useCallback((isoDate: string | null): string => {
        if (!isoDate) return '—';
        try {
            const d = new Date(isoDate + 'T00:00:00');
            const locale = language === 'es' ? 'es-ES' : 'en-US';
            return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
        } catch { return isoDate; }
    }, [language]);

    const currentMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthOffset);
        return { month: d.getMonth(), year: d.getFullYear() };
    }, [monthOffset]);

    // Locale-aware month name
    const monthLabel = useMemo(() => {
        const locale = language === 'es' ? 'es-ES' : 'en-US';
        const date = new Date(currentMonth.year, currentMonth.month, 1);
        const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
        return `${name.charAt(0).toUpperCase() + name.slice(1)} ${currentMonth.year}`;
    }, [currentMonth, language]);

    // Unique category list from history results
    const historyCategories = useMemo(() => {
        const cats = new Set(historyTxs.map(tx => tx.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [historyTxs]);

    // Active filter count for badge indicator
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (historyAccountFilter !== 'all') count++;
        if (historyCategoryFilter !== 'all') count++;
        if (historyDateFrom) count++;
        if (historyDateTo) count++;
        return count;
    }, [historyAccountFilter, historyCategoryFilter, historyDateFrom, historyDateTo]);

    // ── Data Fetching — Scheduled Movements + Accounts ──────
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [gpsRaw, accData] = await Promise.all([
                apiFetch<TacticalGPSResponse>('/api/strategy/tactical-gps'),
                apiFetch<AccountInfo[]>('/api/accounts'),
            ]);

            // Handle both new object shape and legacy array
            if (gpsRaw && typeof gpsRaw === 'object' && !Array.isArray(gpsRaw)) {
                setMovements(Array.isArray(gpsRaw.movements) ? gpsRaw.movements : []);
                setFreedomDateVelocity(gpsRaw.freedom_date_velocity ?? null);
                setFreedomDateStandard(gpsRaw.freedom_date_standard ?? null);
                setMonthsSaved(gpsRaw.months_saved ?? 0);
            } else {
                // Legacy fallback: API returned plain array
                setMovements(Array.isArray(gpsRaw) ? (gpsRaw as unknown as TacticalMovement[]) : []);
            }
            setAccounts(Array.isArray(accData) ? accData : []);
        } catch (err) {
            console.error('Action Plan fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Fetch History — uses /api/transactions/all with filters ──
    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', String(HISTORY_PER_PAGE));
            params.set('offset', String(historyPage * HISTORY_PER_PAGE));
            if (historySearch.trim()) params.set('search', historySearch.trim());
            if (historyAccountFilter !== 'all') params.set('account_id', historyAccountFilter);
            if (historyCategoryFilter !== 'all') params.set('category', historyCategoryFilter);
            if (historyDateFrom) params.set('date_from', historyDateFrom);
            if (historyDateTo) params.set('date_to', historyDateTo);

            const data = await apiFetch<HistoryResponse>(`/api/transactions/all?${params.toString()}`);
            setHistoryTxs(data.transactions || []);
            setHistoryTotal(data.total || 0);
        } catch (err) {
            console.error('History fetch failed:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [historyPage, historySearch, historyAccountFilter, historyCategoryFilter, historyDateFrom, historyDateTo]);

    useEffect(() => { fetchData(); }, []);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Reset page when filters change
    useEffect(() => {
        setHistoryPage(0);
    }, [historySearch, historyAccountFilter, historyCategoryFilter, historyDateFrom, historyDateTo]);

    const historyTotalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PER_PAGE));

    const clearHistoryFilters = () => {
        setHistorySearch('');
        setHistoryAccountFilter('all');
        setHistoryCategoryFilter('all');
        setHistoryDateFrom('');
        setHistoryDateTo('');
    };

    // ── Filter movements by selected month ───────────────────
    const filteredMovements = useMemo(() => {
        return movements.filter((m) => {
            const d = new Date(m.date);
            return d.getMonth() === currentMonth.month && d.getFullYear() === currentMonth.year;
        });
    }, [movements, currentMonth]);

    // Locked debt accounts — debts beyond the plan limit, sorted by APR
    const lockedDebts = useMemo(() => {
        const limit = getPlanLimit();
        if (limit === undefined) return []; // unlimited plan
        const debtAccounts = accounts
            .filter(a => a.type === 'debt' && a.balance > 0)
            .sort((a, b) => b.interest_rate - a.interest_rate);
        return debtAccounts.slice(limit); // accounts beyond the limit are locked
    }, [accounts]);

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
                title: `⚡ ${t('actionPlan.movementExecuted')}`,
                description: `${formatMoney(movement.amount)} ${t('actionPlan.moved')}: ${movement.source} → ${movement.destination}`,
            });
            await fetchData();
        } catch {
            toast({
                title: t('actionPlan.executionFailed'),
                description: t('actionPlan.executionFailedDesc'),
                variant: 'destructive',
            });
        } finally {
            setExecutingKey(null);
        }
    };

    // ── Calculate impact for executed transactions ───────────
    const getImpactForTx = (tx: ExecutedTransaction) => {
        // Extract the destination account name from the description
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

        // Approximate days shortened
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
                    {t('actionPlan.loading')}
                </div>
            </div>
        );
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <>
            <div className="space-y-8">
                {/* ────── CONFIRMATION DIALOG ────── */}
                <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
                    <AlertDialogContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                                <Zap className="text-emerald-400" size={20} />
                                {t('actionPlan.confirmExecution')}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 space-y-4">
                                <p>{t('actionPlan.confirmQuestion')}</p>
                                {confirmTarget && (
                                    <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{confirmTarget.title}</span>
                                            <span className="text-lg font-bold text-emerald-400">{formatMoney(confirmTarget.amount)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                            <span className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md px-2 py-0.5">{confirmTarget.source}</span>
                                            <span>→</span>
                                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md px-2 py-0.5">{confirmTarget.destination}</span>
                                        </div>
                                        {confirmTarget.type === 'attack' && confirmTarget.daily_interest_saved > 0 && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                                <TrendingDown size={14} className="text-emerald-400" />
                                                <span className="text-xs text-emerald-400">
                                                    {t('actionPlan.savesDay')} {formatMoney(confirmTarget.daily_interest_saved)}/{t('strategy.confidence.perDay').replace('/', '')} · ~{confirmTarget.days_shortened} {t('actionPlan.daysSooner')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white">
                                {t('actionPlan.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleConfirmExecute}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                            >
                                <CheckCircle2 size={16} className="mr-1.5" />
                                {t('actionPlan.yesExecuted')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* ────── HEADER ────── */}
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
                        {t('actionPlan.title')}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('actionPlan.battlePlan')}
                    </p>
                </div>

                {/* ────── FREEDOM DATES BANNER ────── */}
                {freedomDateVelocity && freedomDateStandard && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 p-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-amber-950/40">
                        {/* WITH KoreX */}
                        <div className="flex-1 flex items-center gap-2">
                            <Zap size={16} className="text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-medium">{t('actionPlan.withKorex')}</p>
                                <p className="text-sm font-bold text-emerald-400">{formatFreedomDate(freedomDateVelocity)}</p>
                            </div>
                        </div>

                        {/* Arrow / separator */}
                        <div className="hidden sm:flex items-center text-slate-600">←</div>

                        {/* WITHOUT KoreX */}
                        <div className="flex-1 flex items-center gap-2">
                            <Clock size={16} className="text-red-400/70 shrink-0" />
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-red-400/50 font-medium">{t('actionPlan.withoutKorex')}</p>
                                <p className="text-sm font-semibold text-red-400/80 line-through decoration-red-500/40">{formatFreedomDate(freedomDateStandard)}</p>
                            </div>
                        </div>

                        {/* Months saved pill */}
                        {monthsSaved > 0 && (
                            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5 self-center">
                                <Timer size={14} className="text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-400">
                                    {monthsSaved} {t('actionPlan.monthsCut')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ────── MONTH NAVIGATOR ────── */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMonthOffset(prev => Math.max(prev - 1, 0))}
                            disabled={monthOffset === 0}
                            className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30"
                        >
                            <ChevronLeft size={20} />
                        </Button>

                        <div className="flex items-center gap-2 min-w-[180px] justify-center">
                            <Calendar size={16} className="text-amber-400" />
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">{monthLabel}</span>
                            {monthOffset === 0 && (
                                <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                                    {t('actionPlan.current')}
                                </span>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMonthOffset(prev => Math.min(prev + 1, 1))}
                            disabled={monthOffset >= 1}
                            className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30"
                        >
                            <ChevronRight size={20} />
                        </Button>
                    </div>

                    {/* Month summary pills — scrollable on mobile */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 md:flex-wrap scrollbar-none">
                        {summary.incomeCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 whitespace-nowrap">
                                <DollarSign size={12} />
                                {summary.incomeCount} {t('actionPlan.summaryIncome')} · {formatMoney(summary.totalIncome)}
                            </div>
                        )}
                        {summary.attackCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 whitespace-nowrap">
                                <Zap size={12} />
                                {summary.attackCount} {t('actionPlan.summaryAttacks')} · {formatMoney(summary.totalAttack)}
                            </div>
                        )}
                        {summary.minCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 whitespace-nowrap">
                                <ArrowRightLeft size={12} />
                                {summary.minCount} {t('actionPlan.summaryMinPayments')} · {formatMoney(summary.totalMin)}
                            </div>
                        )}
                        {summary.shieldCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1 whitespace-nowrap">
                                <Shield size={12} />
                                {summary.shieldCount} {t('actionPlan.summaryShields')} · {formatMoney(summary.totalShield)}
                            </div>
                        )}
                    </div>
                </div>

                {/* ────── ACTION QUEUE TABLE ────── */}
                <Card className="relative overflow-hidden border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950/60 backdrop-blur-xl">
                    {/* Ambient glow */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <ListChecks className="text-emerald-400" size={20} />
                            {t('actionPlan.scheduledMoves')}
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-2">
                                {filteredMovements.length} {filteredMovements.length !== 1 ? t('actionPlan.movementsThisMonth') : t('actionPlan.movement')}
                            </span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        {filteredMovements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                                <Calendar size={40} className="mb-3 opacity-30" />
                                <p className="text-sm font-medium">{t('actionPlan.noMovements')} {monthLabel}</p>
                                <p className="text-xs mt-1 text-slate-500 dark:text-slate-600">{t('actionPlan.addAccountsHint')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Table Header — hidden on mobile */}
                                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-white/5">
                                    <div className="col-span-2">{t('actionPlan.tableDate')}</div>
                                    <div className="col-span-3">{t('actionPlan.tableAction')}</div>
                                    <div className="col-span-2">{t('actionPlan.tableFrom')}</div>
                                    <div className="col-span-2">{t('actionPlan.tableTo')}</div>
                                    <div className="col-span-1 text-right">{t('actionPlan.tableAmount')}</div>
                                    <div className="col-span-1 text-center">{t('actionPlan.tableType')}</div>
                                    <div className="col-span-1 text-center">{t('actionPlan.tableExec')}</div>
                                </div>

                                {/* Movement Rows */}
                                {filteredMovements.map((m, i) => {
                                    const style = getTypeStyle(m.type);
                                    const key = `${m.date}-${m.title}`;
                                    const isToday = m.date === today;
                                    const isPast = m.date < today;
                                    const isExecuting = executingKey === key;

                                    return isMobile ? (
                                        /* ═══ MOBILE: Stacked card layout ═══ */
                                        <div
                                            key={`${m.date}-${m.title}-${i}`}
                                            className={`
                                            rounded-lg p-4 space-y-3 transition-all duration-200
                                            ${isToday
                                                    ? 'bg-emerald-500/5 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                                                    : isPast
                                                        ? 'opacity-50 bg-slate-50 dark:bg-white/[0.01]'
                                                        : 'bg-slate-50 dark:bg-white/[0.02] border border-transparent hover:border-slate-200 dark:hover:border-white/5'
                                                }
                                        `}
                                        >
                                            {/* Row 1: Date + Type + Execute */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {isToday && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                                                    <span className={`text-sm font-mono ${isToday ? 'text-emerald-300 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {m.display_date}
                                                    </span>
                                                    {isToday && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                            {t('actionPlan.today')}
                                                        </span>
                                                    )}
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${style.text} ${style.bg} border ${style.border} rounded-full px-2 py-0.5`}>
                                                        {style.icon}
                                                        {t(`actionPlan.badge${m.type === 'min_payment' ? 'MinPayment' : m.type.charAt(0).toUpperCase() + m.type.slice(1)}`)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${style.text}`}>{formatMoney(m.amount)}</span>
                                                    {isPast ? (
                                                        <Clock size={14} className="text-slate-400 dark:text-slate-600" />
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            disabled={isExecuting}
                                                            onClick={() => handleRequestExecute(m)}
                                                            className={`h-7 w-7 p-0 rounded-full transition-all ${isToday
                                                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/30'
                                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
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
                                            {/* Row 2: Title */}
                                            <div>
                                                <span className="text-sm text-slate-900 dark:text-white font-medium">{m.title}</span>
                                                {m.type === 'attack' && m.daily_interest_saved > 0 ? (
                                                    <div className="space-y-0.5 mt-0.5">
                                                        <p className="text-[11px] text-emerald-500/80 flex items-center gap-1">
                                                            <TrendingDown size={10} />
                                                            {formatMoney(m.balance_before)} → {formatMoney(m.balance_after)}
                                                            {m.debt_progress_pct > 0 && <span className="text-emerald-400 font-semibold">({m.debt_progress_pct}%)</span>}
                                                            · {t('actionPlan.savesDay')} {formatMoney(m.total_interest_saved)} {t('actionPlan.inInterest')}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{m.description}</p>
                                                )}
                                            </div>
                                            {/* Row 3: Source → Destination */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1">
                                                    {m.source}
                                                </span>
                                                <span className="text-slate-300 dark:text-slate-600">→</span>
                                                <span className={`text-xs font-medium ${style.text} ${style.bg} border ${style.border} rounded-md px-2 py-1`}>
                                                    {m.destination}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ═══ DESKTOP: Original grid row (untouched) ═══ */
                                        <div
                                            key={`${m.date}-${m.title}-${i}`}
                                            className={`
                                            grid grid-cols-12 gap-3 px-4 py-3 rounded-lg transition-all duration-200
                                            ${isToday
                                                    ? 'bg-emerald-500/5 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                                                    : isPast
                                                        ? 'opacity-50 bg-slate-50 dark:bg-white/[0.01]'
                                                        : 'bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-transparent hover:border-slate-200 dark:hover:border-white/5'
                                                }
                                        `}
                                        >
                                            {/* Date */}
                                            <div className="col-span-2 flex items-center gap-2">
                                                {isToday && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                                                <span className={`text-sm font-mono ${isToday ? 'text-emerald-300 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {m.display_date}
                                                </span>
                                                {isToday && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                        {t('actionPlan.today')}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Title + impact inline */}
                                            <div className="col-span-3 flex flex-col justify-center">
                                                <span className="text-sm text-slate-900 dark:text-white font-medium truncate">{m.title}</span>
                                                {m.type === 'attack' && m.daily_interest_saved > 0 ? (
                                                    <span className="text-[11px] text-emerald-500/80 flex items-center gap-1">
                                                        <TrendingDown size={10} />
                                                        {formatMoney(m.balance_before)} → {formatMoney(m.balance_after)}
                                                        {m.debt_progress_pct > 0 && <span className="text-emerald-400 font-semibold">({m.debt_progress_pct}%)</span>}
                                                        · {t('actionPlan.savesDay')} {formatMoney(m.total_interest_saved)} {t('actionPlan.inInterest')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{m.description}</span>
                                                )}
                                            </div>

                                            {/* Source */}
                                            <div className="col-span-2 flex items-center">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 truncate">
                                                    {m.source}
                                                </span>
                                            </div>

                                            {/* Destination */}
                                            <div className="col-span-2 flex items-center gap-1.5">
                                                <span className="text-slate-300 dark:text-slate-600">→</span>
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
                                                    {t(`actionPlan.badge${m.type === 'min_payment' ? 'MinPayment' : m.type.charAt(0).toUpperCase() + m.type.slice(1)}`)}
                                                </span>
                                            </div>

                                            {/* Execute Button */}
                                            <div className="col-span-1 flex items-center justify-center">
                                                {isPast ? (
                                                    <Clock size={14} className="text-slate-400 dark:text-slate-600" />
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={isExecuting}
                                                        onClick={() => handleRequestExecute(m)}
                                                        className={`h-7 w-7 p-0 rounded-full transition-all ${isToday
                                                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/30'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
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

                                {/* ── Locked Debt Phantom Rows ── */}
                                {lockedDebts.length > 0 && (
                                    <>
                                        {/* Separator */}
                                        <div className="flex items-center gap-3 px-4 py-2 mt-2">
                                            <div className="flex-1 h-px bg-rose-500/20" />
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400/60 flex items-center gap-1">
                                                <Lock size={10} /> {lockedDebts.length} {t('actionPlan.lockedAccounts')}
                                            </span>
                                            <div className="flex-1 h-px bg-rose-500/20" />
                                        </div>

                                        {lockedDebts.map((debt) => (
                                            isMobile ? (
                                                /* Mobile locked card */
                                                <div
                                                    key={`locked-${debt.id}`}
                                                    className="rounded-lg p-4 space-y-2 opacity-40 bg-slate-50 dark:bg-white/[0.01] border border-rose-500/10 relative overflow-hidden select-none cursor-pointer hover:opacity-60 hover:border-rose-500/30 transition-all"
                                                    onClick={() => setShowUpgrade(true)}
                                                >
                                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(244,63,94,0.03)_10px,rgba(244,63,94,0.03)_20px)] pointer-events-none" />
                                                    <div className="flex items-center justify-between relative">
                                                        <div className="flex items-center gap-2">
                                                            <Lock size={12} className="text-rose-400" />
                                                            <span className="text-sm text-slate-400 font-medium">{debt.name}</span>
                                                        </div>
                                                        <span className="text-xs font-mono text-rose-400/60">{debt.interest_rate}% APR</span>
                                                    </div>
                                                    <div className="flex items-center justify-between relative">
                                                        <span className="text-xs text-slate-500">Balance: {formatMoney(debt.balance)}</span>
                                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2" onClick={() => setShowUpgrade(true)}>
                                                            {t('actionPlan.upgradeToUnlock')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Desktop locked row */
                                                <div
                                                    key={`locked-${debt.id}`}
                                                    className="grid grid-cols-12 gap-3 px-4 py-3 rounded-lg opacity-40 bg-slate-50 dark:bg-white/[0.01] border border-rose-500/10 relative overflow-hidden select-none cursor-pointer hover:opacity-60 hover:border-rose-500/30 transition-all"
                                                    onClick={() => setShowUpgrade(true)}
                                                >
                                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(244,63,94,0.03)_10px,rgba(244,63,94,0.03)_20px)] pointer-events-none" />
                                                    <div className="col-span-2 flex items-center gap-2 relative">
                                                        <Lock size={12} className="text-rose-400" />
                                                        <span className="text-sm text-slate-400 font-mono">—</span>
                                                    </div>
                                                    <div className="col-span-3 flex flex-col justify-center relative">
                                                        <span className="text-sm text-slate-400 font-medium">{debt.name}</span>
                                                        <span className="text-[11px] text-rose-400/60">{debt.interest_rate}% APR · {formatMoney(debt.balance)}</span>
                                                    </div>
                                                    <div className="col-span-2 flex items-center relative">
                                                        <span className="text-xs text-slate-400/50">—</span>
                                                    </div>
                                                    <div className="col-span-2 flex items-center relative">
                                                        <span className="text-xs text-slate-400/50">—</span>
                                                    </div>
                                                    <div className="col-span-1 flex items-center justify-end relative">
                                                        <span className="text-sm text-slate-400/50">—</span>
                                                    </div>
                                                    <div className="col-span-1 flex items-center justify-center relative">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-400/60 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
                                                            <Lock size={8} /> {t('actionPlan.locked')}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-1 flex items-center justify-center relative">
                                                        <Button size="sm" variant="ghost" className="h-7 text-[9px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2" onClick={() => setShowUpgrade(true)}>
                                                            {t('actionPlan.upgrade')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ────── EXECUTION HISTORY (Enhanced with Search, Filters, Pagination) ────── */}
                <Card className="border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950/60 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <History className="text-amber-400" size={20} />
                            {t('actionPlan.executionHistory')}
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-2">
                                {historyTotal} {t('actionPlan.executed')}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* ── Search + Filter Toggle ── */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder={language === 'es' ? 'Buscar transacciones...' : 'Search transactions...'}
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-9 h-9 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm"
                                />
                                {historySearch && (
                                    <button
                                        onClick={() => setHistorySearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowHistoryFilters(!showHistoryFilters)}
                                className={`h-9 gap-1.5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 ${activeFilterCount > 0 ? 'border-amber-400/50 text-amber-500 dark:text-amber-400' : ''
                                    }`}
                            >
                                <SlidersHorizontal size={14} />
                                {language === 'es' ? 'Filtros' : 'Filters'}
                                {activeFilterCount > 0 && (
                                    <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px]">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                        </div>

                        {/* ── Collapsible Filter Panel ── */}
                        {showHistoryFilters && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Cuenta' : 'Account'}</label>
                                    <Select value={historyAccountFilter} onValueChange={setHistoryAccountFilter}>
                                        <SelectTrigger className="h-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm">
                                            <SelectValue placeholder={language === 'es' ? 'Todas' : 'All'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{language === 'es' ? 'Todas las cuentas' : 'All accounts'}</SelectItem>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Categoría' : 'Category'}</label>
                                    <Select value={historyCategoryFilter} onValueChange={setHistoryCategoryFilter}>
                                        <SelectTrigger className="h-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm">
                                            <SelectValue placeholder={language === 'es' ? 'Todas' : 'All'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{language === 'es' ? 'Todas las categorías' : 'All categories'}</SelectItem>
                                            {historyCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Desde' : 'From'}</label>
                                    <Input
                                        type="date"
                                        value={historyDateFrom}
                                        onChange={(e) => setHistoryDateFrom(e.target.value)}
                                        className="h-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Hasta' : 'To'}</label>
                                    <Input
                                        type="date"
                                        value={historyDateTo}
                                        onChange={(e) => setHistoryDateTo(e.target.value)}
                                        className="h-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm"
                                    />
                                </div>
                                {activeFilterCount > 0 && (
                                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={clearHistoryFilters} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white gap-1">
                                            <X size={12} />
                                            {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── History List ── */}
                        {historyLoading ? (
                            /* Skeleton Loader */
                            <div className="space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                        <Skeleton className="h-5 w-20" />
                                    </div>
                                ))}
                            </div>
                        ) : historyTxs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                                <CheckCircle2 size={32} className="mb-2 opacity-20" />
                                <p className="text-sm">
                                    {historySearch || activeFilterCount > 0
                                        ? (language === 'es' ? 'No se encontraron transacciones con esos filtros' : 'No transactions match your filters')
                                        : t('actionPlan.noExecuted')
                                    }
                                </p>
                                {(historySearch || activeFilterCount > 0) && (
                                    <Button variant="ghost" size="sm" onClick={clearHistoryFilters} className="mt-2 text-xs text-amber-400 hover:text-amber-300">
                                        {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {historyTxs.map((tx) => {
                                    const impact = getImpactForTx(tx);
                                    const isIncome = tx.amount > 0;
                                    return (
                                        <div
                                            key={tx.id}
                                            className="flex flex-col md:flex-row md:items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors gap-2"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                                    }`}>
                                                    {isIncome ? <DollarSign size={14} /> : <ArrowRightLeft size={14} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-slate-900 dark:text-white font-medium truncate">
                                                        {tx.description}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{tx.date}</span>
                                                        {tx.account_name && (
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-600">· {tx.account_name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 md:gap-3 pl-11 md:pl-0 flex-wrap">
                                                {/* Impact Metrics (only for velocity executions) */}
                                                {impact.dailySaved > 0 && (
                                                    <div className="flex items-center gap-2 md:gap-3">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <TrendingDown size={12} className="text-emerald-500" />
                                                            <span className="text-emerald-400 font-medium">
                                                                {formatMoney(impact.dailySaved)}<span className="text-emerald-600">{t('strategy.confidence.perDay')}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <DollarSign size={12} className="text-emerald-500" />
                                                            <span className="text-emerald-400 font-medium">
                                                                {formatMoney(impact.monthlySaved)}<span className="text-emerald-600">{t('actionPlan.perMonth')}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Timer size={12} className="text-amber-400" />
                                                            <span className="text-amber-400 font-medium">
                                                                -{impact.daysShortened}{t('actionPlan.daysAbbr')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Category Badge */}
                                                {tx.category && (
                                                    <Badge variant="secondary" className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getCategoryColor(tx.category)}`}>
                                                        {tx.category}
                                                    </Badge>
                                                )}

                                                {/* Amount */}
                                                <span className={`text-sm font-bold flex-shrink-0 ${isIncome ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}>
                                                    {isIncome ? '+' : ''}{formatMoney(tx.amount)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Pagination ── */}
                        {historyTotalPages > 1 && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                                    disabled={historyPage === 0}
                                    className="gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                >
                                    <ChevronLeft size={16} />
                                    {language === 'es' ? 'Anterior' : 'Previous'}
                                </Button>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                                    {historyPage + 1} / {historyTotalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages - 1, p + 1))}
                                    disabled={historyPage >= historyTotalPages - 1}
                                    className="gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                >
                                    {language === 'es' ? 'Siguiente' : 'Next'}
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <UpgradeModal
                open={showUpgrade}
                onOpenChange={setShowUpgrade}
                reason="Unlock all your debt accounts so KoreX can optimize every dollar of interest."
            />
        </>
    );
}
