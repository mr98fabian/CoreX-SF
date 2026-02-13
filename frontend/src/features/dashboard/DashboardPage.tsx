import { useEffect, useState } from 'react';
import { TrendingDown, Wallet, PiggyBank, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Component Imports
import DebtBurndownChart from './components/DebtBurndownChart';
import DebtAttackTable from './components/DebtAttackTable';
import RecentTransactions from './components/RecentTransactions';
import AttackEquityCard from './components/AttackEquityCard';
import FreedomClock from './components/FreedomClock';
import PeaceShield from './components/PeaceShield';
import PurchaseSimulator from './components/PurchaseSimulator';
import { TransactionDialog } from './components/TransactionDialog';

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
    velocity_target: VelocityTarget | null;
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
    const [data, setData] = useState<DashboardData | null>(null);
    const [projections, setProjections] = useState<VelocityProjections | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshDashboard = () => {
        // Simple reload to fetch fresh data for V1
        window.location.reload();
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard').then(res => res.json()),
            fetch('/api/velocity/projections').then(res => res.json())
        ])
            .then(([dashboardData, velocityData]) => {
                setData(dashboardData);
                setProjections(velocityData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error connecting to Engine:", err);
                setLoading(false);
            });
    }, []);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-emerald-500">
                <div className="text-xl font-mono animate-pulse">Initializing CoreX Engine v2...</div>
            </div>
        );
    }

    const totalDebt = data ? data.total_debt : 0;
    const liquidCash = data ? data.liquid_cash : 0;
    const yearsSaved = projections ? projections.years_saved : 0;
    const interestSaved = projections ? projections.interest_saved : 0;

    return (
        <div className="space-y-8 pb-10">
            {/* HEADER */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Good Morning, Fabian.</h1>
                    <div className="flex items-center gap-2 text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-medium">Velocity Engine v2 Online</span>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <TransactionDialog defaultType="income" onSuccess={refreshDashboard}>
                        <Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white">+ Income</Button>
                    </TransactionDialog>

                    <TransactionDialog defaultType="expense" onSuccess={refreshDashboard}>
                        <Button variant="destructive" className="bg-rose-600 hover:bg-rose-700">- Expense</Button>
                    </TransactionDialog>
                </div>
            </div>

            {/* ★ FREEDOM CLOCK — The Hero */}
            <FreedomClock />

            {/* ★ PEACE SHIELD — Defense Status */}
            <PeaceShield />

            {/* KPI CARDS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Card className="hover:border-rose-500/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Total Debt Load</CardTitle>
                        <TrendingDown className="h-4 w-4 text-rose-500" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{formatMoney(totalDebt)}</div>
                        <p className="text-xs text-zinc-500 mt-1">Real-time database sync</p>
                    </CardContent>
                </Card>

                <Card className="hover:border-emerald-500/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Liquid Availability</CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{formatMoney(liquidCash)}</div>
                        <p className="text-xs text-emerald-500 mt-1">Velocity Ready</p>
                    </CardContent>
                </Card>

                {/* ★ ATTACK EQUITY WIDGET (REPLACED TOTAL INCOME) */}
                {data && (
                    <AttackEquityCard
                        attackEquity={data.attack_equity}
                        chaseBalance={data.chase_balance}
                        shieldTarget={data.shield_target}
                        velocityTarget={data.velocity_target}
                        onSuccess={refreshDashboard}
                    />
                )}

                <Card className="hover:border-amber-500/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Projected Savings</CardTitle>
                        <PiggyBank className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500">{formatMoney(interestSaved)}</div>
                        <p className="text-xs text-zinc-500 mt-1">vs. Traditional Bank</p>
                    </CardContent>
                </Card>

                <Card className="hover:border-blue-500/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Time Accelerated</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{yearsSaved > 0 ? `${yearsSaved} years` : 'Calculating...'}</div>
                        <p className="text-xs text-blue-500 mt-1">Faster than the bank plan</p>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS, SIMULATOR & TRANSACTIONS */}
            <div className="grid gap-6 lg:grid-cols-7">
                {/* Main Chart */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-zinc-200">Debt Burndown Projection</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <DebtBurndownChart />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Simulator + Transactions */}
                <div className="lg:col-span-3 space-y-6">
                    {/* ★ PURCHASE SIMULATOR */}
                    <PurchaseSimulator />
                    <RecentTransactions />
                </div>
            </div>

            <DebtAttackTable />
        </div>
    );
}
