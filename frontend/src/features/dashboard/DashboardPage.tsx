import { useEffect, useState, useCallback } from 'react';
import { WidgetHelp } from '@/components/WidgetHelp';
import UpgradeModal from '@/components/UpgradeModal';
import { apiFetch } from '@/lib/api';
import { emitDataChanged, useDataSync } from '@/lib/dataSync';
import { useAuth } from '../auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TrendingDown, Wallet, PiggyBank, Calendar, Zap, Lock, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { useToast } from '@/components/ui/use-toast';
import { withPlanLimit } from '@/lib/planLimits';

// Dashboard Components
import DebtBurndownChart from './components/DebtBurndownChart';
import RecentTransactions from './components/RecentTransactions';
import AttackEquityCard from './components/AttackEquityCard';
import FreedomClock from './components/FreedomClock';
import PeaceShield from './components/PeaceShield';
import PurchaseSimulator from './components/PurchaseSimulator';
import { TransactionDialog } from './components/TransactionDialog';
import CashflowHeatCalendar from './components/CashflowHeatCalendar';
import { DailyInterestTicker } from './components/DailyInterestTicker';
import { AnimatedCurrency } from '@/components/AnimatedCurrency';
import { TimeMachineCard } from './components/TimeMachineCard';
import { InsufficientFundsDialog } from '@/components/InsufficientFundsDialog';
import { useInsufficientFundsDialog } from '@/hooks/useInsufficientFundsDialog';

// Strategy Components (shared)
import MorningBriefing from '../strategy/components/MorningBriefing';
import RiskyOpportunity from '../strategy/components/RiskyOpportunity';
import DebtAlertBanner from '../strategy/components/DebtAlertBanner';

import { useStrategyData } from '../strategy/hooks/useStrategyData';

// Enhancement hooks — Skills: neuroventa, neuromarketing-conversion, ui-magic
import { useMotivationalQuote } from '@/hooks/useMotivationalQuote';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { useCelebration } from '@/hooks/useCelebration';
import { getCommanderRank, getEffectiveScore } from '@/hooks/useCommanderRank';
import { CommanderBadge } from '@/components/CommanderBadge';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useWeeklyDigest } from '@/hooks/useWeeklyDigest';
import { DebtFreeCountdown } from './components/DebtFreeCountdown';
import { HealthScoreGauge } from './components/HealthScoreGauge';
import { AchievementWall } from '@/components/AchievementWall';
import { BeforeAfterCard, recordStartingDebt } from './components/BeforeAfterCard';
import RecurringConfirmModal from './components/RecurringConfirmModal';
import { useRecurringDueToday } from '@/hooks/useRecurringDueToday';

interface VelocityTarget {
    name: string;
    balance: number;
    interest_rate: number;
    min_payment: number;
    action_date?: string;
    priority_reason?: string;
    justification?: string;
    shield_note?: string;
    daily_interest_saved?: number;
    next_payday?: string;
    recommended_source?: {
        type: 'cash' | 'uil' | 'heloc' | 'combined' | 'multi';
        source_name: string;
        amount: number;
        reason_es: string;
        interest_spread: number;
        allocation_plan?: Array<{
            source_name: string;
            source_type: string;
            amount: number;
            balance_after?: number;
        }>;
        weapon_allocations?: Array<{
            source_name: string;
            source_type: string;
            amount: number;
            apr?: number;
            spread?: number;
        }>;
    } | null;
    checking_account_name?: string;
}

interface DebtAlertData {
    severity: 'critical' | 'warning' | 'caution';
    debt_name: string;
    title: string;
    message: string;
    details: Record<string, number>;
    recommendation: string;
}

interface DashboardData {
    total_debt: number;
    liquid_cash: number;
    chase_balance: number;
    shield_target: number;
    attack_equity: number;
    reserved_for_bills?: number;
    velocity_target: VelocityTarget | null;
    velocity_weapons?: Array<{
        name: string;
        weapon_type: string;
        balance: number;
        credit_limit: number;
        available_credit: number;
        interest_rate: number;
    }>;
    calendar?: Record<string, unknown>[];
    unmonitored_debt?: number;
    locked_account_count?: number;
    debt_alerts?: DebtAlertData[];
    total_daily_interest?: number;
}

interface VelocityProjections {
    velocity_debt_free_date: string;
    standard_debt_free_date: string;
    months_saved: number;
    years_saved: number;
    interest_saved: number;
    velocity_power: number;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    usePageTitle(t('nav.dashboard'));
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.name?.split(' ')[0] || 'there';
    const [data, setData] = useState<DashboardData | null>(null);
    const [projections, setProjections] = useState<VelocityProjections | null>(null);
    const [loading, setLoading] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [executingAttack, setExecutingAttack] = useState(false);

    // Strategy data (for Morning Briefing)
    const { data: strategyData, refresh: refreshStrategy } = useStrategyData();

    // Enhancement hooks
    const motivationalQuote = useMotivationalQuote(language as 'en' | 'es');
    const streak = useLoginStreak();
    const { celebrate } = useCelebration();
    const sessionTimer = useSessionTimer();
    const weeklyDigest = useWeeklyDigest(data?.total_daily_interest ? data.total_daily_interest * 7 : undefined);

    // Recurring confirmation system
    const recurring = useRecurringDueToday();

    // Reusable function to re-fetch all dashboard data without full page reload
    const loadDashboardData = useCallback(async () => {
        try {
            const [dashboardData, velocityData] = await Promise.all([
                apiFetch<DashboardData>(withPlanLimit('/api/dashboard')),
                apiFetch<VelocityProjections>(withPlanLimit('/api/velocity/projections'))
            ]);
            setData(dashboardData);
            setProjections(velocityData);
        } catch (err) {
            console.error('Dashboard refresh failed:', err);
        }
    }, []);

    const refreshDashboard = () => {
        // Increment streak only when a transaction is registered — Skill: streak-v3
        streak.incrementStreakOnTransaction();
        // Celebrate the transaction — Skill: neuroventa §7
        celebrate('spark');
        // Re-fetch data and notify other pages
        setTimeout(async () => {
            await loadDashboardData();
            refreshStrategy();
            emitDataChanged('dashboard');
        }, 800);
    };

    // ── Attack Equity Execute Handler (Multi-Account) ──────────
    const handleExecuteAttack = async (transfers: Array<{ source: string; dest: string; amount: number; title: string }>) => {
        setExecutingAttack(true);
        let totalExecuted = 0;
        try {
            // Execute each transfer sequentially
            for (const tx of transfers) {
                await apiFetch('/api/strategy/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        movement_key: `attack-equity-${Date.now()}-${tx.source.replace(/\s/g, '')}`,
                        title: tx.title,
                        amount: tx.amount,
                        date_planned: new Date().toISOString().split('T')[0],
                        source: tx.source,
                        destination: tx.dest,
                    }),
                });
                totalExecuted += tx.amount;
            }
            toast({
                title: '⚡ Ataque ejecutado',
                description: `$${totalExecuted.toLocaleString()} enviados a ${transfers[0]?.dest} desde ${transfers.length} cuenta(s). Balances actualizados.`,
            });
            // Re-fetch everything
            streak.incrementStreakOnTransaction();
            celebrate('spark');
            setTimeout(async () => {
                await loadDashboardData();
                refreshStrategy();
                emitDataChanged('dashboard');
            }, 800);
        } catch (err: unknown) {
            // Check for INSUFFICIENT_FUNDS
            if (fundsDialog.showIfInsufficientFunds(err)) return;
            // Generic error — parse JSON body for a readable message
            let msg = 'Error desconocido';
            try {
                const rawMsg = err instanceof Error ? err.message : '';
                const parsed = JSON.parse(rawMsg);
                const detail = parsed?.detail;
                if (typeof detail === 'string') {
                    msg = detail;
                } else if (detail?.message) {
                    msg = String(detail.message);
                }
            } catch {
                if (err instanceof Error && err.message.length < 200) {
                    msg = err.message;
                }
            }
            toast({ title: 'Error al ejecutar', description: msg, variant: 'destructive' });
        } finally {
            setExecutingAttack(false);
        }
    };

    // Listen for data changes from Accounts or Strategy pages
    useDataSync('dashboard', () => {
        loadDashboardData();
        refreshStrategy();
    });

    // ── Insufficient Funds popup ──────────────────────────────
    const fundsDialog = useInsufficientFundsDialog();

    // Wrap recurring confirm to also trigger streak + celebration
    const handleRecurringConfirm = async (itemId: number, actualAmount: number) => {
        try {
            const result = await recurring.confirmItem(itemId, actualAmount);
            if (result?.ok && !result.already_confirmed) {
                // Confirming a recurring item counts as a transaction for streak
                streak.incrementStreakOnTransaction();
                celebrate('spark');
                // Re-fetch dashboard data and notify other pages
                await loadDashboardData();
                emitDataChanged('dashboard');
            }
            return result;
        } catch (err: unknown) {
            if (fundsDialog.showIfInsufficientFunds(err)) return null;
            throw err;
        }
    };

    useEffect(() => {
        Promise.all([
            apiFetch<DashboardData>(withPlanLimit('/api/dashboard')),
            apiFetch<VelocityProjections>(withPlanLimit('/api/velocity/projections'))
        ])
            .then(([dashboardData, velocityData]) => {
                setData(dashboardData);
                setProjections(velocityData);
                // Snapshot starting debt for Before/After card (first visit only)
                if (dashboardData?.total_debt) {
                    recordStartingDebt(dashboardData.total_debt);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error connecting to Engine:", err);
                toast({ title: t('dashboard.connectionError'), description: t('dashboard.connectionErrorDesc'), variant: 'destructive' });
                setLoading(false);
            });
    }, [t, toast]);

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('dashboard.greeting.morning') : hour < 18 ? t('dashboard.greeting.afternoon') : t('dashboard.greeting.evening');

    if (loading) {
        return (
            <div className="space-y-4 pb-16 animate-in fade-in duration-500">
                {/* Header skeleton */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-1">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-6 w-40 rounded-full" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 rounded-md" />
                        <Skeleton className="h-9 w-24 rounded-md" />
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-4">
                    {/* Freedom Clock + Side panels */}
                    <Skeleton className="col-span-12 lg:col-span-8 h-48 rounded-xl" />
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <Skeleton className="flex-1 min-h-[90px] rounded-xl" />
                        <Skeleton className="flex-1 min-h-[90px] rounded-xl" />
                    </div>

                    {/* 4 KPI cards */}
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="col-span-6 lg:col-span-3">
                            <CardHeader className="pb-1 pt-4 px-4">
                                <Skeleton className="h-3 w-20" />
                            </CardHeader>
                            <CardContent className="px-4 pb-4 pt-2">
                                <Skeleton className="h-7 w-28 mb-1" />
                                <Skeleton className="h-2.5 w-16" />
                            </CardContent>
                        </Card>
                    ))}

                    {/* Morning Briefing */}
                    <Skeleton className="col-span-12 h-40 rounded-xl" />

                    {/* Heat Calendar */}
                    <Skeleton className="col-span-12 h-48 rounded-xl" />

                    {/* Burndown Chart */}
                    <Skeleton className="col-span-12 h-[380px] rounded-xl" />

                    {/* Tools row */}
                    <Skeleton className="col-span-12 lg:col-span-4 h-56 rounded-xl" />
                    <Skeleton className="col-span-12 lg:col-span-8 h-56 rounded-xl" />
                </div>
            </div>
        );
    }

    const totalDebt = data ? data.total_debt : 0;
    const liquidCash = data ? data.liquid_cash : 0;
    const interestSaved = projections ? projections.interest_saved : 0;
    const unmonitoredDebt = data?.unmonitored_debt || 0;
    const lockedCount = data?.locked_account_count || 0;
    const debtAlerts = data?.debt_alerts || [];

    return (
        <>
            {/* ═══ RECURRING CONFIRMATION MODAL — Show when items are due today ═══ */}
            {recurring.showModal && (
                <RecurringConfirmModal
                    items={recurring.items}
                    confirmedCount={recurring.confirmedCount}
                    lastConfirmResult={recurring.lastConfirmResult}
                    onConfirm={handleRecurringConfirm}
                    onSnooze={recurring.snoozeItem}
                    onDismiss={recurring.dismiss}
                />
            )}

            {/* ═══ LOGIN STREAK POPUP — Show on new day, dismiss on click/timeout ═══ */}
            {streak.showLoginPopup && !streak.hasTransactionToday && (
                <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-500 w-[calc(100%-2rem)] max-w-lg">
                    <div className="relative bg-gradient-to-r from-orange-500/90 via-amber-500/90 to-orange-600/90 backdrop-blur-xl text-white rounded-2xl px-5 py-4 shadow-2xl shadow-orange-900/30 border border-orange-400/30">
                        <button
                            onClick={streak.dismissPopup}
                            className="absolute top-2 right-3 text-white/60 hover:text-white text-lg transition-colors"
                        >✕</button>
                        <div className="flex items-center gap-3">
                            <div className="text-3xl animate-bounce">🔥</div>
                            <div>
                                <p className="font-bold text-sm tracking-wide">
                                    {language === 'es'
                                        ? `¡Racha activa: ${streak.score} puntos!`
                                        : `Active streak: ${streak.score} points!`}
                                </p>
                                <p className="text-[11px] text-white/80 mt-0.5">
                                    {language === 'es'
                                        ? 'Registra un ingreso o gasto hoy para sumar a tu racha 💪'
                                        : 'Log an income or expense today to grow your streak 💪'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4 pb-16 animate-in fade-in duration-700">
                {/* ═══════════════════════════════════════════════════════════
                 1. HEADER — Greeting + Action Buttons
               ═══════════════════════════════════════════════════════════ */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-1">
                    <div>
                        {/* Commander Rank greeting — Skill: neuroventa §2 */}
                        {(() => {
                            const plan = localStorage.getItem('korex-plan') || 'starter';
                            const isPaidUser = plan !== 'starter';
                            const effectiveScore = getEffectiveScore(streak.score, isPaidUser);
                            const cmdRank = getCommanderRank(effectiveScore);
                            const rankDisplay = language === 'es' ? cmdRank.fullDisplayEs : cmdRank.fullDisplayEn;
                            return (
                                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
                                    {greeting}, <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${cmdRank.material.color}, ${cmdRank.material.color}99)` }}>{rankDisplay}</span> {userName}{isPaidUser && <span title="VIP Member" className="ml-1 text-amber-400 animate-pulse">👑</span>}.
                                </h1>
                            );
                        })()}
                        {/* Motivational quote rotation — Skill: neuroventa §6 */}
                        {motivationalQuote && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mb-2 max-w-md animate-in fade-in duration-1000">
                                "{motivationalQuote}"
                            </p>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30 px-3 py-1 rounded-full w-fit border border-emerald-300 dark:border-emerald-500/20 backdrop-blur-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-mono tracking-wider">{t('dashboard.engineOnline')}</span>
                            </div>
                            {/* Login streak badge — Skill: monetization §5 */}
                            {streak.score >= 2 && (
                                <div className="flex items-center gap-1 bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full border border-orange-300 dark:border-orange-500/20 backdrop-blur-sm">
                                    <Flame size={12} className="fill-orange-500" />
                                    <span className="text-xs font-bold tabular-nums">{streak.rawStreak}</span>
                                    <span className="text-[10px] font-mono">{language === 'es' ? 'días' : 'days'}</span>
                                    {streak.score !== streak.rawStreak && (
                                        <span className="text-[9px] text-orange-500/50">({streak.score} pts)</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-2 items-center">
                            <TransactionDialog defaultType="income" onSuccess={refreshDashboard}>
                                <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-300 backdrop-blur-sm">{t('dashboard.income')}</Button>
                            </TransactionDialog>

                            <TransactionDialog defaultType="expense" onSuccess={refreshDashboard}>
                                <Button variant="destructive" size="sm" className="shadow-lg shadow-rose-900/20">{t('dashboard.expense')}</Button>
                            </TransactionDialog>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                            {language === 'es'
                                ? 'Registra ingresos o gastos no planificados'
                                : 'Log unplanned income or expenses'}
                        </p>
                    </div>
                </div>

                {/* Commander Rank Badge — Full visual widget */}
                <div className="relative group">
                    <WidgetHelp helpKey="commanderBadge" />
                    <CommanderBadge isPaid={(localStorage.getItem('korex-plan') || 'starter') !== 'starter'} />
                </div>

                {/* Debt-Free Countdown — Phase 2 Quick Win */}
                <div className="relative group">
                    <WidgetHelp helpKey="debtFreeCountdown" />
                    <DebtFreeCountdown
                        debtFreeDate={projections?.velocity_debt_free_date}
                        totalDebt={data?.total_debt}
                    />
                </div>

                {/* Session Timer — shows after 5+ min */}
                {sessionTimer.minutes >= 5 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-indigo-400">
                        <span>⏱️</span>
                        <span>{sessionTimer.message}</span>
                    </div>
                )}

                {/* Weekly Progress Digest Toast */}
                {weeklyDigest.shouldShow && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/15 text-xs">
                        <span className="text-gray-300">{weeklyDigest.message}</span>
                        <button onClick={weeklyDigest.dismiss} className="text-gray-500 hover:text-white text-[10px] shrink-0">✕</button>
                    </div>
                )}

                {/* Daily Interest Ticker — Skill: neuromarketing-conversion */}
                {data?.total_daily_interest && data.total_daily_interest > 0 && (
                    <DailyInterestTicker dailyInterest={data.total_daily_interest} />
                )}

                {/* ═══════════════════════════════════════════════════════════
                 1.5. DEBT ALERTS — Above the grid for critical visibility
               ═══════════════════════════════════════════════════════════ */}
                {debtAlerts.length > 0 && (
                    <DebtAlertBanner alerts={debtAlerts} />
                )}

                {/* ═══════════════════════════════════════════════════════════
                 2. MAIN BENTO GRID — Simplified (13 widgets)
               ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-12 gap-4">

                    {/* A. Freedom Clock (8 cols) + Peace Shield / Attack Equity (4 cols) */}
                    <div className="col-span-12 lg:col-span-8 relative group">
                        <WidgetHelp helpKey="velocityClock" />
                        <FreedomClock />
                    </div>
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <div className="flex-1 relative group">
                            <WidgetHelp helpKey="peaceShield" />
                            <PeaceShield />
                        </div>
                        <div className="flex-1 relative group">
                            <WidgetHelp helpKey="attackEquity" />
                            <div className="absolute inset-0 bg-gold-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            {data && (
                                <AttackEquityCard
                                    attackEquity={data.attack_equity}
                                    chaseBalance={data.chase_balance}
                                    shieldTarget={data.shield_target}
                                    reservedForBills={data.reserved_for_bills}
                                    velocityTarget={data.velocity_target}
                                    velocityWeapons={data.velocity_weapons}
                                    onExecuteAttack={handleExecuteAttack}
                                    executingAttack={executingAttack}
                                />
                            )}
                        </div>
                    </div>

                    {/* B. KPI Cards — 4x3 cols, compact */}
                    <Card className="col-span-6 lg:col-span-3 hover:border-rose-500/40 transition-all group relative">
                        <WidgetHelp helpKey="kpiCards" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-rose-400 transition-colors">{t('dashboard.totalDebt')}</CardTitle>
                            <TrendingDown className="h-3.5 w-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight"><AnimatedCurrency value={totalDebt} /></div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t('dashboard.totalDebtDesc')}</p>
                        </CardContent>
                    </Card>

                    {/* Unmonitored Debt KPI — only visible when accounts are locked */}
                    {lockedCount > 0 && (() => {
                        // Freedom Clock Impact: estimate extra months locked debt adds
                        const velocityPower = projections?.velocity_power || 0;
                        const extraMonths = velocityPower > 0
                            ? Math.ceil(unmonitoredDebt / velocityPower)
                            : 0;

                        return (
                            <Card
                                className="col-span-6 lg:col-span-3 border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 hover:border-rose-500/50 transition-all group relative overflow-hidden cursor-pointer"
                                onClick={() => setShowUpgradeModal(true)}
                            >
                                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                                    <CardTitle className="text-xs font-medium text-rose-400/80 flex items-center gap-1">
                                        <Lock size={10} /> {t('dashboard.unmonitoredDebt')}
                                    </CardTitle>
                                    <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                                        {lockedCount} {t('accounts.lockedBadge').toLowerCase()}
                                    </span>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                    <div className="text-xl md:text-2xl font-bold text-rose-500 tracking-tight">{formatMoney(unmonitoredDebt)}</div>
                                    {extraMonths > 0 ? (
                                        <p className="text-[10px] text-rose-400/60 mt-0.5 flex items-center gap-1">
                                            <Calendar size={9} /> +{extraMonths} {t('dashboard.extraMonths')} · {t('dashboard.upgradeAccelerate')}
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-rose-400/60 mt-0.5">{t('dashboard.upgradeTrackAll')}</p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })()}

                    <Card className="col-span-6 lg:col-span-3 hover:border-emerald-500/40 transition-all group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-emerald-400 transition-colors">{t('dashboard.liquidCash')}</CardTitle>
                            <Wallet className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight"><AnimatedCurrency value={liquidCash} /></div>
                            <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1">
                                <Zap size={10} className="fill-emerald-500" /> {t('dashboard.liquidCashDesc')}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="col-span-6 lg:col-span-3 hover:border-amber-500/40 transition-all group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-amber-400 transition-colors">{t('dashboard.interestSaved')}</CardTitle>
                            <PiggyBank className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-xl md:text-2xl font-bold text-amber-500 tracking-tight"><AnimatedCurrency value={interestSaved} /></div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t('dashboard.interestSavedDesc')}</p>
                        </CardContent>
                    </Card>


                    {/* C. Morning Briefing / Risky Opportunity — Full Width */}
                    <div className="col-span-12 relative group">
                        <WidgetHelp helpKey="morningBriefing" />
                        {strategyData?.morning_briefing ? (
                            <MorningBriefing
                                data={strategyData.morning_briefing}
                                recommendedSource={data?.velocity_target?.recommended_source}
                                onExecuteAttack={handleExecuteAttack}
                                executingAttack={executingAttack}
                            />
                        ) : strategyData?.risky_opportunity ? (
                            <RiskyOpportunity
                                data={strategyData.risky_opportunity}
                                onExecuted={refreshStrategy}
                            />
                        ) : (
                            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-black/50 p-6 text-center h-full flex flex-col items-center justify-center">
                                <Zap className="h-8 w-8 text-gray-400 dark:text-slate-700 mx-auto mb-2" />
                                <h3 className="text-base font-semibold text-slate-700 dark:text-gray-300">{t('dashboard.noAttackTitle')}</h3>
                                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                                    {t('dashboard.noAttackDesc')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* D. Cashflow Heat Calendar — Full Width (User's favorite tool) */}
                    <div className="col-span-12 relative group">
                        <WidgetHelp helpKey="heatCalendar" />
                        <CashflowHeatCalendar />
                    </div>

                    {/* ═══ PHASE 3: ENGAGEMENT ROW ══════════════════════════ */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Health Score Gauge */}
                        <div className="relative group h-full">
                            <WidgetHelp helpKey="healthScore" />
                            <HealthScoreGauge
                                shieldFillPercent={data ? Math.min(100, (data.liquid_cash / Math.max(1, data.shield_target)) * 100) : 0}
                                totalDebt={data?.total_debt ?? 0}
                                liquidCash={data?.liquid_cash ?? 0}
                                streakScore={streak.score}
                                commanderLevel={getCommanderRank(getEffectiveScore(streak.score, (localStorage.getItem('korex-plan') || 'starter') !== 'starter')).level}
                            />
                        </div>

                        {/* Achievement Wall */}
                        <div className="relative group h-full">
                            <WidgetHelp helpKey="achievementWall" />
                            <AchievementWall
                                context={{
                                    streakRaw: streak.rawStreak,
                                    streakScore: streak.score,
                                    commanderLevel: getCommanderRank(getEffectiveScore(streak.score, (localStorage.getItem('korex-plan') || 'starter') !== 'starter')).level,
                                    shieldPercent: data ? Math.min(100, (data.liquid_cash / Math.max(1, data.shield_target)) * 100) : 0,
                                    totalDebt: data?.total_debt ?? 0,
                                    debtsEliminated: 0,
                                    accountCount: 0,
                                    interestSaved: interestSaved ?? 0,
                                }}
                            />
                        </div>

                        {/* Before vs After */}
                        <div className="relative group">
                            <WidgetHelp helpKey="beforeAfter" />
                            <BeforeAfterCard
                                currentDebt={data?.total_debt ?? 0}
                            />
                        </div>
                    </div>

                    {/* E. Debt Burndown Chart — Full Width */}
                    <Card className="col-span-12 flex flex-col relative overflow-hidden min-h-[380px] group">
                        <WidgetHelp helpKey="burndownChart" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-lg text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                                <TrendingDown className="text-emerald-500" /> {t('dashboard.burndownTitle')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 pl-0">
                            <DebtBurndownChart />
                        </CardContent>
                    </Card>

                    {/* Time Machine Regret Trigger — Skill: neuromarketing-conversion §5 */}
                    {data?.total_daily_interest && data.total_daily_interest > 0 && (
                        <TimeMachineCard
                            dailyInterest={data.total_daily_interest}
                            registrationDate={user?.created_at}
                        />
                    )}

                    {/* F. Tools Row: Purchase Simulator (4 cols) + Recent Transactions (8 cols) */}
                    <div className="col-span-12 lg:col-span-4 relative group">
                        <WidgetHelp helpKey="purchaseSimulator" />
                        <PurchaseSimulator />
                    </div>
                    <div className="col-span-12 lg:col-span-8 relative group">
                        <WidgetHelp helpKey="recentTransactions" />
                        <RecentTransactions />
                    </div>

                </div>
            </div>

            <UpgradeModal
                open={showUpgradeModal}
                onOpenChange={setShowUpgradeModal}
                reason={t('upgrade.moreAccountsDesc')}
            />
            <InsufficientFundsDialog data={fundsDialog.errorData} onClose={fundsDialog.dismiss} />
        </>
    );
}

