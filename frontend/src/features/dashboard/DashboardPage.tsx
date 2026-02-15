import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TrendingDown, Wallet, PiggyBank, Calendar, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';


// Dashboard Components
import DebtBurndownChart from './components/DebtBurndownChart';
import RecentTransactions from './components/RecentTransactions';
import AttackEquityCard from './components/AttackEquityCard';
import FreedomClock from './components/FreedomClock';
import PeaceShield from './components/PeaceShield';
import PurchaseSimulator from './components/PurchaseSimulator';
import { TransactionDialog } from './components/TransactionDialog';
import CashflowHeatCalendar from './components/CashflowHeatCalendar';
import { FreedomPathCalendar } from "./components/FreedomPathCalendar";
import { WhatIfSimulator } from "./components/WhatIfSimulator";

// Strategy Components (merged from Strategy page)
import MorningBriefing from '../strategy/components/MorningBriefing';
import FreedomCounter from '../strategy/components/FreedomCounter';
import ConfidenceMeter from '../strategy/components/ConfidenceMeter';
import AttackDecisionHelper from '../strategy/components/AttackDecisionHelper';
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

interface DashboardData {
    total_debt: number;
    liquid_cash: number;
    chase_balance: number;
    shield_target: number;
    attack_equity: number;
    reserved_for_bills?: number;
    velocity_target: VelocityTarget | null;
    calendar?: any[];
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
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.name?.split(' ')[0] || 'there';
    const [data, setData] = useState<DashboardData | null>(null);
    const [projections, setProjections] = useState<VelocityProjections | null>(null);
    const [loading, setLoading] = useState(true);

    // Strategy data (merged from Strategy page)
    const { data: strategyData } = useStrategyData();

    const refreshDashboard = () => {
        window.location.reload();
    };

    // Simulation State
    const [extraCash, setExtraCash] = useState(0);
    const [simulationData, setSimulationData] = useState<any>(null);
    const [isSimLoading, setIsSimLoading] = useState(false);

    // Fetch Simulation
    useEffect(() => {
        const fetchSim = async () => {
            setIsSimLoading(true);
            try {
                const data = await apiFetch(`/api/velocity/simulate?extra_cash=${extraCash}`);
                setSimulationData(data);
            } catch (error) {
                console.error("Simulation failed", error);
            } finally {
                setIsSimLoading(false);
            }
        };
        fetchSim();
    }, [extraCash]);

    useEffect(() => {
        Promise.all([
            apiFetch('/api/dashboard'),
            apiFetch('/api/velocity/projections')
        ])
            .then(([dashboardData, velocityData]) => {
                setData(dashboardData as any);
                setProjections(velocityData as any);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error connecting to Engine:", err);
                setLoading(false);
            });
    }, []);

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('dashboard.greeting.morning') : hour < 18 ? t('dashboard.greeting.afternoon') : t('dashboard.greeting.evening');

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="text-xl font-mono text-emerald-400 animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                    {t('dashboard.loading')}
                </div>
            </div>
        );
    }

    const totalDebt = data ? data.total_debt : 0;
    const liquidCash = data ? data.liquid_cash : 0;
    const interestSaved = projections ? projections.interest_saved : 0;
    const yearsSaved = projections ? projections.years_saved : 0;

    return (
        <div className="space-y-4 pb-16 animate-in fade-in duration-700">
            {/* ═══════════════════════════════════════════════════════════
                 1. HEADER — Greeting + Action Buttons
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-1">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">{greeting}, {userName}.</h1>
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
                 2. MAIN BENTO GRID
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
                        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatMoney(totalDebt)}</div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{t('dashboard.totalDebtDesc')}</p>
                    </CardContent>
                </Card>

                <Card className="col-span-6 lg:col-span-3 hover:border-emerald-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-emerald-400 transition-colors">{t('dashboard.liquidCash')}</CardTitle>
                        <Wallet className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatMoney(liquidCash)}</div>
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
                        <div className="text-2xl font-bold text-amber-500 tracking-tight">{formatMoney(interestSaved)}</div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{t('dashboard.interestSavedDesc')}</p>
                    </CardContent>
                </Card>

                <Card className="col-span-6 lg:col-span-3 hover:border-blue-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-blue-400 transition-colors">{t('dashboard.timeSaved')}</CardTitle>
                        <Calendar className="h-3.5 w-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {yearsSaved > 0 ? (
                                <span className='text-blue-800 dark:text-blue-100'>{yearsSaved} <span className="text-base text-blue-500 dark:text-blue-400">{t('dashboard.years')}</span></span>
                            ) : (
                                <span className="text-base text-zinc-500">{t('common.loading')}</span>
                            )}
                        </div>
                        <p className="text-[10px] text-blue-500 mt-0.5">{t('dashboard.timeSavedDesc')}</p>
                    </CardContent>
                </Card>

                {/* C. Strategy Intelligence — Morning Briefing (8 cols) + Freedom Counter (4 cols) */}
                <div className="col-span-12 lg:col-span-8">
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
                <div className="col-span-12 lg:col-span-4">
                    {strategyData && (
                        <FreedomCounter
                            freedom={strategyData.freedom_counter}
                            streak={strategyData.streak}
                        />
                    )}
                </div>

                {/* D. Confidence Meter (8 cols) + Decision Helper (4 cols) — side by side, balanced */}
                <div className="col-span-12 lg:col-span-8">
                    {strategyData && <ConfidenceMeter data={strategyData.confidence_meter} />}
                </div>
                <div className="col-span-12 lg:col-span-4">
                    {strategyData?.decision_options && (
                        <AttackDecisionHelper
                            data={strategyData.decision_options}
                        />
                    )}
                </div>

                {/* E. Cashflow Heat Calendar — Full Width */}
                <div className="col-span-12">
                    <CashflowHeatCalendar />
                </div>

                {/* F. Debt Burndown Chart — Full Width */}
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

                {/* G. Tools Row: Purchase Simulator (4 cols) + Recent Transactions (8 cols) */}
                <div className="col-span-12 lg:col-span-4">
                    <PurchaseSimulator />
                </div>
                <div className="col-span-12 lg:col-span-8">
                    <RecentTransactions />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                 3. FREEDOM PATH & SIMULATOR
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 h-[480px]">
                    <FreedomPathCalendar simulation={simulationData} isLoading={isSimLoading} />
                </div>
                <div className="h-[480px]">
                    <WhatIfSimulator
                        currentExtra={extraCash}
                        onSimulate={setExtraCash}
                        isLoading={isSimLoading}
                    />
                </div>
            </div>

        </div>
    );
}
