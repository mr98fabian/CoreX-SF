import { useEffect, useState } from 'react';
import UpgradeModal from '@/components/UpgradeModal';
import { apiFetch } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TrendingDown, Wallet, PiggyBank, Calendar, Zap, Lock } from 'lucide-react';
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

// Strategy Components (shared)
import MorningBriefing from '../strategy/components/MorningBriefing';
import DebtAlertBanner from '../strategy/components/DebtAlertBanner';

import { useStrategyData } from '../strategy/hooks/useStrategyData';

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
    calendar?: any[];
    unmonitored_debt?: number;
    locked_account_count?: number;
    debt_alerts?: DebtAlertData[];
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
    usePageTitle('Dashboard');
    const { user } = useAuth();
    const { t } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.name?.split(' ')[0] || 'there';
    const [data, setData] = useState<DashboardData | null>(null);
    const [projections, setProjections] = useState<VelocityProjections | null>(null);
    const [loading, setLoading] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Strategy data (for Morning Briefing)
    const { data: strategyData } = useStrategyData();

    const refreshDashboard = () => {
        window.location.reload();
    };

    useEffect(() => {
        Promise.all([
            apiFetch(withPlanLimit('/api/dashboard')),
            apiFetch(withPlanLimit('/api/velocity/projections'))
        ])
            .then(([dashboardData, velocityData]) => {
                setData(dashboardData as any);
                setProjections(velocityData as any);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error connecting to Engine:", err);
                toast({ title: 'Connection Error', description: 'Failed to load dashboard data. Retrying automatically...', variant: 'destructive' });
                setLoading(false);
            });
    }, []);

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
            <div className="space-y-4 pb-16 animate-in fade-in duration-700">
                {/* ═══════════════════════════════════════════════════════════
                 1. HEADER — Greeting + Action Buttons
               ═══════════════════════════════════════════════════════════ */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-1">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">{greeting}, {userName}.</h1>
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30 px-3 py-1 rounded-full w-fit border border-emerald-300 dark:border-emerald-500/20 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-mono tracking-wider">{t('dashboard.engineOnline')}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <TransactionDialog defaultType="income" onSuccess={refreshDashboard}>
                            <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-300 backdrop-blur-sm">{t('dashboard.income')}</Button>
                        </TransactionDialog>

                        <TransactionDialog defaultType="expense" onSuccess={refreshDashboard}>
                            <Button variant="destructive" size="sm" className="shadow-lg shadow-rose-900/20">{t('dashboard.expense')}</Button>
                        </TransactionDialog>
                    </div>
                </div>

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
                    <div className="col-span-12 lg:col-span-8">
                        <FreedomClock />
                    </div>
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <div className="flex-1">
                            <PeaceShield />
                        </div>
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 bg-gold-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            {data && (
                                <AttackEquityCard
                                    attackEquity={data.attack_equity}
                                    chaseBalance={data.chase_balance}
                                    shieldTarget={data.shield_target}
                                    reservedForBills={data.reserved_for_bills}
                                    velocityTarget={data.velocity_target}
                                />
                            )}
                        </div>
                    </div>

                    {/* B. KPI Cards — 4x3 cols, compact */}
                    <Card className="col-span-6 lg:col-span-3 hover:border-rose-500/40 transition-all group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-rose-400 transition-colors">{t('dashboard.totalDebt')}</CardTitle>
                            <TrendingDown className="h-3.5 w-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatMoney(totalDebt)}</div>
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
                                        <Lock size={10} /> Unmonitored Debt
                                    </CardTitle>
                                    <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                                        {lockedCount} locked
                                    </span>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                    <div className="text-xl md:text-2xl font-bold text-rose-500 tracking-tight">{formatMoney(unmonitoredDebt)}</div>
                                    {extraMonths > 0 ? (
                                        <p className="text-[10px] text-rose-400/60 mt-0.5 flex items-center gap-1">
                                            <Calendar size={9} /> +{extraMonths} extra {extraMonths === 1 ? 'month' : 'months'} · Upgrade to accelerate freedom
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-rose-400/60 mt-0.5">Upgrade to track all debts</p>
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
                            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatMoney(liquidCash)}</div>
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
                            <div className="text-xl md:text-2xl font-bold text-amber-500 tracking-tight">{formatMoney(interestSaved)}</div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t('dashboard.interestSavedDesc')}</p>
                        </CardContent>
                    </Card>


                    {/* C. Morning Briefing — Full Width (no more Freedom Counter beside it) */}
                    <div className="col-span-12">
                        {strategyData?.morning_briefing ? (
                            <MorningBriefing
                                data={strategyData.morning_briefing}
                            />
                        ) : (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-6 text-center h-full flex flex-col items-center justify-center">
                                <Zap className="h-8 w-8 text-slate-400 dark:text-slate-700 mx-auto mb-2" />
                                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Attack Available</h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    Your Peace Shield needs reinforcement first, or no active debts were found.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* D. Cashflow Heat Calendar — Full Width (User's favorite tool) */}
                    <div className="col-span-12">
                        <CashflowHeatCalendar />
                    </div>

                    {/* E. Debt Burndown Chart — Full Width */}
                    <Card className="col-span-12 flex flex-col relative overflow-hidden min-h-[380px]">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-lg text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                                <TrendingDown className="text-emerald-500" /> Burndown Projection
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 pl-0">
                            <DebtBurndownChart />
                        </CardContent>
                    </Card>

                    {/* F. Tools Row: Purchase Simulator (4 cols) + Recent Transactions (8 cols) */}
                    <div className="col-span-12 lg:col-span-4">
                        <PurchaseSimulator />
                    </div>
                    <div className="col-span-12 lg:col-span-8">
                        <RecentTransactions />
                    </div>
                </div>

            </div>

            <UpgradeModal
                open={showUpgradeModal}
                onOpenChange={setShowUpgradeModal}
                reason="Unlock all your debt accounts so CoreX can monitor and optimize every dollar."
            />
        </>
    );
}
