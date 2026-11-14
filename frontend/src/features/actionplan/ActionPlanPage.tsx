import { localDay } from '@/lib/localDay';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { apiFetch } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { AmberRule, BankHeader, Section } from '@/components/kx';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import UpgradeModal from '@/components/UpgradeModal';
import { WidgetHelp } from '@/components/WidgetHelp';
import { InsufficientFundsDialog } from '@/components/InsufficientFundsDialog';
import { useInsufficientFundsDialog } from '@/hooks/useInsufficientFundsDialog';
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
    ChevronLeft,
    ChevronRight,
    Zap,
    Shield,
    ArrowRightLeft,
    Clock,
    CheckCircle2,
    Loader2,
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
    // Continuous language: color only where it already means something —
    // amber = an attack (action), payday blue = income, debt rose = expense; the rest stay ink.
    attack: { bg: 'bg-kx-amber', text: 'text-kx-amber-soft', border: 'border-kx-amber', icon: <Zap size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeAttack' },
    shield: { bg: 'bg-kx-ink3', text: 'text-kx-ink2', border: 'border-kx-line', icon: <Shield size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeShield' },
    min_payment: { bg: 'bg-kx-ink3', text: 'text-kx-ink2', border: 'border-kx-line', icon: <ArrowRightLeft size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeMinPayment' },
    income: { bg: 'bg-kx-pay', text: 'text-kx-pay', border: 'border-kx-line', icon: <DollarSign size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeIncome' },
    expense: { bg: 'bg-kx-debt', text: 'text-kx-debt', border: 'border-kx-line', icon: <ArrowRightLeft size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeExpense' },
    obligation: { bg: 'bg-kx-ink3', text: 'text-kx-ink2', border: 'border-kx-line', icon: <Shield size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeObligation' },
    faltante: { bg: 'bg-kx-debt', text: 'text-kx-debt', border: 'border-kx-debt', icon: <ArrowRightLeft size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeShortfall' },
    velocity_chunk: { bg: 'bg-kx-amber', text: 'text-kx-amber-soft', border: 'border-kx-amber', icon: <Zap size={14} strokeWidth={1.75} />, labelKey: 'actionPlan.badgeVelocityChunk' },
};

const getTypeStyle = (type: string) =>
    TYPE_STYLES[type] ?? TYPE_STYLES['expense'];

/** Category color mapping for transaction badges */
const getCategoryColor = (): string => 'bg-transparent border border-kx-line text-kx-ink2';

// ═══════════════════════════════════════════════════════════════
// ACTION PLAN PAGE
// ═══════════════════════════════════════════════════════════════
export default function ActionPlanPage() {
    const { t, language } = useLanguage();
    const isMobile = useIsMobile();
    const { formatMoney } = useFormatMoney();
    usePageTitle(t('actionPlan.title'));
    const { toast } = useToast();
    const fundsDialog = useInsufficientFundsDialog();

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
            // Midday anchor: a bare YYYY-MM-DD parses as UTC midnight, which lands on
            // the previous day (and previous month) in negative-UTC timezones.
            const d = new Date(`${m.date}T12:00:00`);
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
        // committed payments: plain minimums AND the mission's obligations (cut to $0, statement, loan) — U-14
        const mins = filteredMovements.filter(m => m.type === 'min_payment' || m.type === 'obligation');
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
        } catch (err: unknown) {
            // Check for INSUFFICIENT_FUNDS and show dedicated popup
            if (fundsDialog.showIfInsufficientFunds(err)) {
                // Handled by popup
            } else {
                // Fallback: generic error toast
                let errorDetail = t('actionPlan.executionFailedDesc');
                try {
                    const errObj = err as Record<string, unknown>;
                    const rawMsg = (errObj?.message as string) ?? '';
                    // ApiError.message is the raw JSON body — try to parse it
                    try {
                        const parsed = JSON.parse(rawMsg);
                        const detail = parsed?.detail;
                        if (typeof detail === 'string') {
                            errorDetail = detail;
                        } else if (detail?.message) {
                            errorDetail = String(detail.message);
                        }
                    } catch {
                        // Not JSON — use the raw message if it's not empty
                        if (rawMsg && rawMsg.length < 200) {
                            errorDetail = rawMsg;
                        }
                    }
                } catch { /* use default */ }
                toast({
                    title: t('actionPlan.executionFailed'),
                    description: errorDetail,
                    variant: 'destructive',
                });
            }
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
            <div className="kx-scope -m-4 min-h-full md:-m-8">
                <div className="mx-auto max-w-5xl space-y-4 px-5 pt-6" aria-busy="true">
                    <p className="text-sm text-kx-ink2">{t('actionPlan.loading')}</p>
                    <div className="h-48 kx-shimmer rounded-[var(--kx-radius-card)]" />
                </div>
            </div>
        );
    }

    const today = localDay();

    return (
        <>
            <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-5xl space-y-6 px-5 pt-6">
                {/* ────── CONFIRMATION DIALOG ────── */}
                <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
                    <AlertDialogContent className="bg-kx-surface border-kx-line max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-kx-ink flex items-center gap-2">
                                <Zap className="text-kx-paid" size={20} />
                                {t('actionPlan.confirmExecution')}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-kx-ink3 space-y-4">
                                <p>{t('actionPlan.confirmQuestion')}</p>
                                {confirmTarget && (
                                    <div className="bg-kx-raised border border-kx-line rounded-lg p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-kx-ink font-medium">{confirmTarget.title}</span>
                                            <span className="text-lg font-bold text-kx-paid">{formatMoney(confirmTarget.amount)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-kx-ink2 ">
                                            <span className="bg-kx-raised border border-kx-line rounded-md px-2 py-0.5">{confirmTarget.source}</span>
                                            <span>→</span>
                                            <span className="bg-[color-mix(in_srgb,var(--kx-paid)_10%,transparent)] border border-[color-mix(in_srgb,var(--kx-paid)_20%,transparent)] text-kx-paid rounded-md px-2 py-0.5">{confirmTarget.destination}</span>
                                        </div>
                                        {confirmTarget.type === 'attack' && confirmTarget.daily_interest_saved > 0 && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-kx-line ">
                                                <TrendingDown size={14} className="text-kx-paid" />
                                                <span className="text-xs text-kx-paid">
                                                    {t('actionPlan.savesDay')} {formatMoney(confirmTarget.daily_interest_saved)}/{t('strategy.confidence.perDay').replace('/', '')} · ~{confirmTarget.days_shortened} {t('actionPlan.daysSooner')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-kx-raised border-kx-line text-kx-ink hover:bg-kx-raised hover:text-kx-ink ">
                                {t('actionPlan.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleConfirmExecute}
                                className="bg-kx-paid hover:bg-kx-paid text-kx-on-amber border-0"
                            >
                                <CheckCircle2 size={16} className="mr-1.5" />
                                {t('actionPlan.yesExecuted')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* ────── HEADER ────── */}
                {/* same order as before: title, then its line */}
                <div>
                    <BankHeader title={t('actionPlan.title')} />
                    <p className="mt-1.5 text-[13.5px] text-kx-ink2">{t('actionPlan.battlePlan')}</p>
                </div>
                <AmberRule />

                {/* ────── FREEDOM DATES — one ledger, the dates are the heroes ────── */}
                {freedomDateVelocity && freedomDateStandard && (
                    <div className="kx-rows overflow-hidden rounded-[var(--kx-radius-card)] border border-kx-line bg-kx-surface">
                        <div className="relative flex items-baseline justify-between gap-3 px-4 py-3">
                            <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full bg-kx-paid" />
                            <span className="text-[11px] font-bold uppercase tracking-[.14em] text-kx-paid">{t('actionPlan.withKorex')}</span>
                            <span className="kx-num font-editorial text-[22px] leading-none text-kx-ink">{formatFreedomDate(freedomDateVelocity)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--kx-line-soft)] px-4 py-3">
                            <span className="text-[11px] font-bold uppercase tracking-[.14em] text-kx-ink3">{t('actionPlan.withoutKorex')}</span>
                            <span className="kx-num font-editorial text-[17px] leading-none text-kx-ink3 line-through decoration-kx-debt/50">{formatFreedomDate(freedomDateStandard)}</span>
                        </div>
                        {monthsSaved > 0 && (
                            <div className="flex items-center gap-2 border-t border-[var(--kx-line-soft)] px-4 py-2.5 text-[12.5px] text-kx-ink2">
                                <Timer size={14} strokeWidth={1.75} className="text-kx-paid" />
                                <span><b className="kx-num font-editorial text-[15px] font-normal text-kx-paid">{monthsSaved}</b> {t('actionPlan.monthsCut')}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ────── MONTH NAVIGATOR — the calendar's arrows and editorial month ────── */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => setMonthOffset(prev => Math.max(prev - 1, 0))}
                            disabled={monthOffset === 0}
                            aria-label={language === 'es' ? 'Mes anterior' : 'Previous month'}
                            className="kx-press flex h-10 w-10 items-center justify-center rounded-full border border-kx-line bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-baseline gap-2">
                            <span className="font-editorial whitespace-nowrap text-[21px] leading-none text-kx-ink">{monthLabel}</span>
                            {monthOffset === 0 && (
                                <span className="kx-tech rounded-sm bg-kx-amber px-1.5 text-[10px] font-bold uppercase leading-[16px] text-kx-on-amber">
                                    {t('actionPlan.current')}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setMonthOffset(prev => Math.min(prev + 1, 1))}
                            disabled={monthOffset >= 1}
                            aria-label={language === 'es' ? 'Mes siguiente' : 'Next month'}
                            className="kx-press flex h-10 w-10 items-center justify-center rounded-full border border-kx-line bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Month summary — one quiet line of marks, scrollable on mobile */}
                    <div className="flex items-center gap-x-4 gap-y-1 overflow-x-auto px-1 text-[12px] text-kx-ink2 scrollbar-none md:flex-wrap">
                        {summary.incomeCount > 0 && (
                            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-kx-pay" aria-hidden="true" />{summary.incomeCount} {t('actionPlan.summaryIncome')} · <span className="kx-num">{formatMoney(summary.totalIncome)}</span></span>
                        )}
                        {summary.attackCount > 0 && (
                            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-kx-amber" aria-hidden="true" />{summary.attackCount} {t('actionPlan.summaryAttacks')} · <span className="kx-num">{formatMoney(summary.totalAttack)}</span></span>
                        )}
                        {summary.minCount > 0 && (
                            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-kx-ink3" aria-hidden="true" />{summary.minCount} {t('actionPlan.summaryMinPayments')} · <span className="kx-num">{formatMoney(summary.totalMin)}</span></span>
                        )}
                        {summary.shieldCount > 0 && (
                            <span className="flex items-center gap-1.5 whitespace-nowrap"><Shield size={11} strokeWidth={1.75} className="text-kx-ink3" aria-hidden="true" />{summary.shieldCount} {t('actionPlan.summaryShields')} · <span className="kx-num">{formatMoney(summary.totalShield)}</span></span>
                        )}
                    </div>
                </div>

                {/* ────── ACTION QUEUE — one ledger panel, hairline rows ────── */}
                <Section tone="neutral" bare
                    title={<>{t('actionPlan.scheduledMoves')} <span className="ml-1 font-normal normal-case tracking-normal text-kx-ink3">{filteredMovements.length} {filteredMovements.length !== 1 ? t('actionPlan.movementsThisMonth') : t('actionPlan.movement')}</span></>}
                    action={<WidgetHelp helpKey="actionPlanTable" />}>
                    <div className="kx-rows overflow-hidden rounded-[var(--kx-radius-card)] border border-kx-line bg-kx-surface">
                        {filteredMovements.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-kx-ink">{t('actionPlan.noMovements')} {monthLabel}</p>
                                <p className="mt-1 text-xs text-kx-ink2">{t('actionPlan.addAccountsHint')}</p>
                            </div>
                        ) : (
                            <>
                                {/* Table header — desktop only */}
                                <div className="hidden grid-cols-12 gap-3 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[.12em] text-kx-ink3 md:grid">
                                    <div className="col-span-2">{t('actionPlan.tableDate')}</div>
                                    <div className="col-span-3">{t('actionPlan.tableAction')}</div>
                                    <div className="col-span-2">{t('actionPlan.tableFrom')}</div>
                                    <div className="col-span-2">{t('actionPlan.tableTo')}</div>
                                    <div className="col-span-1 text-right">{t('actionPlan.tableAmount')}</div>
                                    <div className="col-span-1 text-center">{t('actionPlan.tableType')}</div>
                                    <div className="col-span-1 text-center">{t('actionPlan.tableExec')}</div>
                                </div>

                                {filteredMovements.map((m, i) => {
                                    const style = getTypeStyle(m.type);
                                    const key = `${m.date}-${m.title}`;
                                    const isToday = m.date === today;
                                    const isPast = m.date < today;
                                    const isExecuting = executingKey === key;
                                    const rowTone = isToday ? 'bg-[rgba(245,158,11,.06)]' : isPast ? 'opacity-50' : '';
                                    const band = isToday && <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full bg-kx-amber" />;
                                    const typeMark = (
                                        <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[.08em] ${style.text}`}>
                                            {style.icon}{t(style.labelKey)}
                                        </span>
                                    );
                                    const todayMark = isToday && (
                                        <span className="kx-tech rounded-sm bg-kx-amber px-1 text-[9px] font-bold uppercase leading-[14px] text-kx-on-amber">{t('actionPlan.today')}</span>
                                    );
                                    const impact = m.type === 'attack' && m.daily_interest_saved > 0 && (
                                        <>
                                            <span className="kx-num">{formatMoney(m.balance_before)} → {formatMoney(m.balance_after)}</span>
                                            {m.debt_progress_pct > 0 && <span className="font-semibold text-kx-paid"> ({m.debt_progress_pct}%)</span>}
                                            {' · '}{t('actionPlan.savesDay')} <span className="kx-num text-kx-paid">{formatMoney(m.total_interest_saved)}</span> {t('actionPlan.inInterest')}
                                        </>
                                    );
                                    const exec = isPast ? (
                                        <Clock size={14} strokeWidth={1.75} className="shrink-0 text-kx-ink3" />
                                    ) : (
                                        <button
                                            disabled={isExecuting}
                                            onClick={() => handleRequestExecute(m)}
                                            aria-label={t('actionPlan.tableExec')}
                                            className={`kx-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber ${isToday ? 'bg-kx-amber text-kx-on-amber' : 'border border-kx-line bg-kx-raised text-kx-ink2'}`}
                                        >
                                            {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={12} />}
                                        </button>
                                    );

                                    return isMobile ? (
                                        /* MOBILE: a ledger line — date, title, route, amount */
                                        <div key={`${m.date}-${m.title}-${i}`} className={`relative border-t border-[var(--kx-line-soft)] px-4 py-3 first:border-t-0 ${rowTone}`}>
                                            {band}
                                            <div className="flex items-start gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="kx-tech text-[11.5px] text-kx-ink2">{m.display_date}</span>
                                                        {todayMark}
                                                        {typeMark}
                                                    </div>
                                                    <p className="mt-1 text-[14.5px] font-semibold leading-snug text-kx-ink">{m.title}</p>
                                                    <p className="mt-0.5 text-[12px] text-kx-ink2">{impact || m.description}</p>
                                                    <p className="mt-1 truncate text-[12px] text-kx-ink3">{m.source} <span aria-hidden="true">→</span> <span className="text-kx-ink2">{m.destination}</span></p>
                                                </div>
                                                <div className="flex flex-none flex-col items-end gap-2">
                                                    <span className="kx-num font-editorial whitespace-nowrap text-[18px] leading-none text-kx-ink">{formatMoney(m.amount)}</span>
                                                    {exec}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* DESKTOP: the same 12-column row, as a ledger line */
                                        <div key={`${m.date}-${m.title}-${i}`} className={`relative grid grid-cols-12 gap-3 border-t border-[var(--kx-line-soft)] px-4 py-3 ${rowTone}`}>
                                            {band}
                                            <div className="col-span-2 flex items-center gap-2">
                                                <span className="kx-tech text-[13px] text-kx-ink2">{m.display_date}</span>
                                                {todayMark}
                                            </div>
                                            <div className="col-span-3 flex min-w-0 flex-col justify-center">
                                                <span className="truncate text-sm font-semibold text-kx-ink">{m.title}</span>
                                                <span className="truncate text-[11.5px] text-kx-ink2">{impact || m.description}</span>
                                            </div>
                                            <div className="col-span-2 flex min-w-0 items-center"><span className="truncate text-xs text-kx-ink2">{m.source}</span></div>
                                            <div className="col-span-2 flex min-w-0 items-center gap-1.5">
                                                <span className="text-kx-ink3" aria-hidden="true">→</span>
                                                <span className="truncate text-xs text-kx-ink">{m.destination}</span>
                                            </div>
                                            <div className="col-span-1 flex items-center justify-end">
                                                <span className="kx-num font-editorial whitespace-nowrap text-[16px] text-kx-ink">{formatMoney(m.amount)}</span>
                                            </div>
                                            <div className="col-span-1 flex items-center justify-center">{typeMark}</div>
                                            <div className="col-span-1 flex items-center justify-center">{exec}</div>
                                        </div>
                                    );
                                })}

                                {/* ── Locked debts: the same ledger, dimmed ── */}
                                {lockedDebts.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 border-t border-[var(--kx-line-soft)] px-4 py-2 text-[10.5px] font-bold uppercase tracking-[.12em] text-kx-ink3">
                                            <Lock size={11} strokeWidth={1.75} /> {lockedDebts.length} {t('actionPlan.lockedAccounts')}
                                        </div>
                                        {lockedDebts.map((debt) => (
                                            <div
                                                key={`locked-${debt.id}`}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setShowUpgrade(true)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowUpgrade(true); }}
                                                className="kx-press flex cursor-pointer select-none items-center gap-3 border-t border-[var(--kx-line-soft)] px-4 py-3 opacity-50 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber"
                                            >
                                                <Lock size={13} strokeWidth={1.75} className="flex-none text-kx-ink3" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-kx-ink2">{debt.name}</span>
                                                    <span className="block text-[11.5px] text-kx-ink3"><span className="kx-tech">{debt.interest_rate}% APR</span> · Balance: <span className="kx-num">{formatMoney(debt.balance)}</span></span>
                                                </span>
                                                <span className="flex-none text-[11px] font-semibold text-kx-amber">{isMobile ? t('actionPlan.upgradeToUnlock') : t('actionPlan.upgrade')}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </Section>

                {/* ────── EXECUTION HISTORY — search above, one ledger below ────── */}
                <Section tone="neutral" bare
                    title={<>{t('actionPlan.executionHistory')} <span className="ml-1 font-normal normal-case tracking-normal text-kx-ink3">{historyTotal} {t('actionPlan.executed')}</span></>}>
                    <div className="space-y-3">
                        {/* ── Search + Filter Toggle ── */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink3" />
                                <Input
                                    placeholder={language === 'es' ? 'Buscar transacciones...' : 'Search transactions...'}
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="h-10 rounded-xl border-kx-line bg-kx-surface pl-9 text-sm text-kx-ink placeholder:text-kx-ink3 focus-visible:ring-kx-amber"
                                />
                                {historySearch && (
                                    <button
                                        onClick={() => setHistorySearch('')}
                                        aria-label={language === 'es' ? 'Borrar búsqueda' : 'Clear search'}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-kx-ink3 hover:text-kx-ink"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowHistoryFilters(!showHistoryFilters)}
                                aria-expanded={showHistoryFilters}
                                className={`kx-press flex h-10 flex-none items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold ${activeFilterCount > 0 ? 'border-kx-amber text-kx-amber-soft' : 'border-kx-line text-kx-ink2'}`}
                            >
                                <SlidersHorizontal size={14} strokeWidth={1.75} />
                                {language === 'es' ? 'Filtros' : 'Filters'}
                                {activeFilterCount > 0 && (
                                    <span className="kx-num flex h-5 w-5 items-center justify-center rounded-full bg-kx-amber text-[10px] font-bold text-kx-on-amber">{activeFilterCount}</span>
                                )}
                            </button>
                        </div>

                        {/* ── Collapsible Filter Panel ── */}
                        {showHistoryFilters && (
                            <div className="grid grid-cols-1 gap-3 rounded-[var(--kx-radius-card)] border border-kx-line bg-kx-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-[.12em] text-kx-ink3">{language === 'es' ? 'Cuenta' : 'Account'}</label>
                                    <Select value={historyAccountFilter} onValueChange={setHistoryAccountFilter}>
                                        <SelectTrigger className="h-9 border-kx-line bg-kx-bg text-sm text-kx-ink">
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
                                    <label className="text-[11px] font-bold uppercase tracking-[.12em] text-kx-ink3">{language === 'es' ? 'Categoría' : 'Category'}</label>
                                    <Select value={historyCategoryFilter} onValueChange={setHistoryCategoryFilter}>
                                        <SelectTrigger className="h-9 border-kx-line bg-kx-bg text-sm text-kx-ink">
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
                                    <label className="text-[11px] font-bold uppercase tracking-[.12em] text-kx-ink3">{language === 'es' ? 'Desde' : 'From'}</label>
                                    <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)}
                                        className="h-9 border-kx-line bg-kx-bg text-sm text-kx-ink" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-[.12em] text-kx-ink3">{language === 'es' ? 'Hasta' : 'To'}</label>
                                    <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)}
                                        className="h-9 border-kx-line bg-kx-bg text-sm text-kx-ink" />
                                </div>
                                {activeFilterCount > 0 && (
                                    <div className="flex justify-end sm:col-span-2 lg:col-span-4">
                                        <button onClick={clearHistoryFilters} className="kx-press flex items-center gap-1 text-xs font-semibold text-kx-amber">
                                            <X size={12} />
                                            {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── History ledger ── */}
                        <div className="kx-rows overflow-hidden rounded-[var(--kx-radius-card)] border border-kx-line bg-kx-surface">
                            {historyLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 border-t border-[var(--kx-line-soft)] px-4 py-3 first:border-t-0">
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-48 bg-kx-raised" />
                                            <Skeleton className="h-3 w-32 bg-kx-raised" />
                                        </div>
                                        <Skeleton className="h-5 w-20 bg-kx-raised" />
                                    </div>
                                ))
                            ) : historyTxs.length === 0 ? (
                                <div className="px-4 py-10 text-center">
                                    <p className="text-sm text-kx-ink2">
                                        {historySearch || activeFilterCount > 0
                                            ? (language === 'es' ? 'No se encontraron transacciones con esos filtros' : 'No transactions match your filters')
                                            : t('actionPlan.noExecuted')
                                        }
                                    </p>
                                    {(historySearch || activeFilterCount > 0) && (
                                        <button onClick={clearHistoryFilters} className="kx-press mt-2 text-xs font-semibold text-kx-amber">
                                            {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                historyTxs.map((tx) => {
                                    const impact = getImpactForTx(tx);
                                    const isIncome = tx.amount > 0;
                                    return (
                                        <div key={tx.id} className="relative border-t border-[var(--kx-line-soft)] px-4 py-3 first:border-t-0">
                                            <span aria-hidden="true" className={`absolute bottom-3 left-0 top-3 w-[3px] rounded-full ${isIncome ? 'bg-kx-pay' : 'bg-kx-debt'}`} />
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="min-w-0 truncate text-[14.5px] font-semibold text-kx-ink">{tx.description}</p>
                                                <span className={`kx-num font-editorial flex-none whitespace-nowrap text-[17px] ${isIncome ? 'text-kx-paid' : 'text-kx-ink'}`}>
                                                    {isIncome ? '+' : ''}{formatMoney(tx.amount)}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-kx-ink3">
                                                <span className="kx-tech">{tx.date}</span>
                                                {tx.account_name && <span>· {tx.account_name}</span>}
                                                {tx.category && (
                                                    <span className={`rounded-full px-2 py-px text-[10px] font-medium ${getCategoryColor()}`}>{tx.category}</span>
                                                )}
                                                {impact.dailySaved > 0 && (
                                                    <span className="flex items-center gap-2 text-kx-paid">
                                                        <TrendingDown size={12} strokeWidth={1.75} />
                                                        <span className="kx-num">{formatMoney(impact.dailySaved)}{t('strategy.confidence.perDay')}</span>
                                                        <span className="kx-num">{formatMoney(impact.monthlySaved)}{t('actionPlan.perMonth')}</span>
                                                        <span className="kx-num text-kx-amber-soft">-{impact.daysShortened}{t('actionPlan.daysAbbr')}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* ── Pagination ── */}
                        {historyTotalPages > 1 && (
                            <div className="flex items-center justify-between px-1">
                                <button
                                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                                    disabled={historyPage === 0}
                                    className="kx-press flex items-center gap-1 text-[13px] font-semibold text-kx-ink2 disabled:opacity-30"
                                >
                                    <ChevronLeft size={16} />
                                    {language === 'es' ? 'Anterior' : 'Previous'}
                                </button>
                                <span className="kx-num text-xs text-kx-ink3">{historyPage + 1} / {historyTotalPages}</span>
                                <button
                                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages - 1, p + 1))}
                                    disabled={historyPage >= historyTotalPages - 1}
                                    className="kx-press flex items-center gap-1 text-[13px] font-semibold text-kx-ink2 disabled:opacity-30"
                                >
                                    {language === 'es' ? 'Siguiente' : 'Next'}
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </Section>
            </div>
            </div>

            <UpgradeModal
                open={showUpgrade}
                onOpenChange={setShowUpgrade}
                reason={t('upgrade.moreAccountsDesc')}
            />
            <InsufficientFundsDialog data={fundsDialog.errorData} onClose={fundsDialog.dismiss} />
        </>
    );
}
