import { useEffect, useState } from 'react';
import { TrendingDown, Wallet, PiggyBank, Calendar, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Component Imports
import DebtBurndownChart from './components/DebtBurndownChart';
// import DebtAttackTable from './components/DebtAttackTable';
import RecentTransactions from './components/RecentTransactions';
import AttackEquityCard from './components/AttackEquityCard';
import FreedomClock from './components/FreedomClock';
import PeaceShield from './components/PeaceShield';
import PurchaseSimulator from './components/PurchaseSimulator';
import { TransactionDialog } from './components/TransactionDialog';
import TacticalCalendar from './components/TacticalCalendar';
import { FreedomPathCalendar } from "./components/FreedomPathCalendar";
import { WhatIfSimulator } from "./components/WhatIfSimulator";

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
    calendar?: any[]; // Using loose type to avoid duplication complexity for now
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
                // Use the base simulate endpoint which combines base velocity + extra
                const res = await fetch(`/api/velocity/simulate?extra_cash=${extraCash}`);
                if (res.ok) {
                    const data = await res.json();
                    setSimulationData(data);
                }
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
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="text-xl font-mono text-emerald-400 animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                    Initializing CoreX Engine v2...
                </div>
            </div>
        );
    }

    const totalDebt = data ? data.total_debt : 0;
    const liquidCash = data ? data.liquid_cash : 0;
    const interestSaved = projections ? projections.interest_saved : 0;
    const yearsSaved = projections ? projections.years_saved : 0;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-700">
            {/* 1. HEADER SECTION (Greetings + Actions) */}
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end p-2">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Good Morning, Fabian.</h1>
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded-full w-fit border border-emerald-500/20 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-mono tracking-wider">VELOCITY ENGINE v2 ONLINE</span>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <TransactionDialog defaultType="income" onSuccess={refreshDashboard}>
                        <Button variant="outline" className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 backdrop-blur-sm">+ Income</Button>
                    </TransactionDialog>

                    <TransactionDialog defaultType="expense" onSuccess={refreshDashboard}>
                        <Button variant="destructive" className="shadow-lg shadow-rose-900/20">- Expense</Button>
                    </TransactionDialog>
                </div>
            </div>

            {/* 2. BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6">

                {/* A. Freedom Clock and Peace Shield/Attack Equity Row */}
                <div className="col-span-1 md:col-span-4 lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Freedom Clock (8 Cols) */}
                    <div className="lg:col-span-8">
                        <FreedomClock />
                    </div>

                    {/* Right Column (4 Cols) - Stacked Peace Shield & Attack Equity */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
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
                                    onSuccess={refreshDashboard}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* C. Primary KPIs (Row 2) */}
                {/* Total Debt */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-3 hover:border-rose-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-rose-400 transition-colors">Total Debt Load</CardTitle>
                        <TrendingDown className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white tracking-tight">{formatMoney(totalDebt)}</div>
                        <p className="text-xs text-zinc-500 mt-1">Real-time database sync</p>
                    </CardContent>
                </Card>

                {/* Liquid Cash */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-3 hover:border-emerald-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-emerald-400 transition-colors">Liquid Availability</CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white tracking-tight">{formatMoney(liquidCash)}</div>
                        <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                            <Zap size={12} className="fill-emerald-500" /> Velocity Ready
                        </p>
                    </CardContent>
                </Card>

                {/* Interest Saved */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-3 hover:border-amber-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-amber-400 transition-colors">Projected Savings</CardTitle>
                        <PiggyBank className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500 tracking-tight">{formatMoney(interestSaved)}</div>
                        <p className="text-xs text-zinc-500 mt-1">vs. Traditional Bank</p>
                    </CardContent>
                </Card>

                {/* Time Saved */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-3 hover:border-blue-500/40 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-blue-400 transition-colors">Time Accelerated</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {yearsSaved > 0 ? (
                                <span className='text-blue-100'>{yearsSaved} <span className="text-lg text-blue-400">years</span></span>
                            ) : (
                                <span className="text-lg text-zinc-500">Calculating...</span>
                            )}
                        </div>
                        <p className="text-xs text-blue-500 mt-1">Faster than the bank plan</p>
                    </CardContent>
                </Card>

                {/* D. Main Content Area (Row 3) */}

                {/* Tactical Calendar - Full Width */}
                <div className="col-span-1 md:col-span-4 lg:col-span-12">
                    {data?.calendar && (
                        <div className="animate-in slide-in-from-bottom-5 duration-700">
                            <TacticalCalendar days={data.calendar} shieldTarget={data.shield_target} />
                        </div>
                    )}
                </div>

                {/* Debt Burndown Chart - Full Width (12 Cols) */}
                <Card className="col-span-1 md:col-span-4 lg:col-span-12 flex flex-col relative overflow-hidden min-h-[400px]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="text-xl text-zinc-200 flex items-center gap-2">
                            <TrendingDown className="text-emerald-500" /> Burndown Projection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pl-0">
                        <DebtBurndownChart />
                    </CardContent>
                </Card>

                {/* E. Tools & Data (Row 4) */}
                {/* Purchase Simulator - 4 cols */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4">
                    <PurchaseSimulator />
                </div>

                {/* Recent Transactions - 8 cols */}
                <div className="col-span-1 md:col-span-2 lg:col-span-8">
                    <RecentTransactions />
                </div>
            </div>

            {/* 3. Detailed Data Table (Full Width) */}
            {/* Freedom Path & Simulator Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-[500px]">
                    <FreedomPathCalendar simulation={simulationData} isLoading={isSimLoading} />
                </div>
                <div className="space-y-6">
                    <WhatIfSimulator
                        currentExtra={extraCash}
                        onSimulate={setExtraCash}
                        isLoading={isSimLoading}
                    />
                    {/* Move Tactical Calendar here if user prefers, or keep duplicate for visibility. Keeping original for now. */}
                </div>
            </div>

            {/* <div className="mt-8">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <ShieldCheck className="text-gold-500" size={24} />
                    <h2 className="text-2xl font-bold text-white">Strategic Debt Analysis</h2>
                </div>
                <DebtAttackTable />
            </div> */}
        </div >
    );
}
