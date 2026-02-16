import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Flame, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import TacticalActionBanner from './TacticalActionBanner';
import { motion } from "framer-motion";
import { useFormatMoney } from '@/hooks/useFormatMoney';

interface FreedomData {
    velocity_debt_free_date: string;
    standard_debt_free_date: string;
    months_saved: number;
    years_saved: number;
    interest_saved: number;
    total_debt: number;
    velocity_power: number; // Added for Calculations
}

/**
 * FreedomClock — The heartbeat of CoreX.
 * Now featuring Velocity Intelligence: Score, Time Saved, and Simulation.
 */
export default function FreedomClock() {
    const [data, setData] = useState<FreedomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [extraPayment, setExtraPayment] = useState(0);
    const { formatMoney, locale } = useFormatMoney();

    useEffect(() => {
        apiFetch<FreedomData>('/api/velocity/projections')
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
                setError(true);
            });
    }, []);



    if (loading) {
        return (
            <Card className="border-blue-900/30 bg-gradient-to-br from-zinc-950 to-blue-950/20 animate-pulse h-full">
                <CardContent className="h-full flex items-center justify-center">
                    <div className="text-blue-500 font-mono text-sm">Calculating Velocity Metrics...</div>
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="border-red-900/40 bg-red-950/10 h-full">
                <CardContent className="h-full flex flex-col items-center justify-center text-red-500">
                    <Clock size={32} className="mb-2 opacity-50" />
                    <span className="text-xs font-mono">Projection System Offline</span>
                    <Button variant="link" size="sm" onClick={() => window.location.reload()} className="text-red-400 mt-1 h-auto p-0 text-xs">Retry</Button>
                </CardContent>
            </Card>
        );
    }

    // --- CALCULATIONS ---
    const now = new Date();
    const standardDate = new Date(data.standard_debt_free_date);
    const velocityDate = new Date(data.velocity_debt_free_date);

    // Guard: if the backend returned invalid/null dates, bail to error UI
    const datesInvalid = isNaN(standardDate.getTime()) || isNaN(velocityDate.getTime());

    if (datesInvalid) {
        return (
            <Card className="border-red-900/40 bg-red-950/10 h-full">
                <CardContent className="h-full flex flex-col items-center justify-center text-red-500">
                    <Clock size={32} className="mb-2 opacity-50" />
                    <span className="text-xs font-mono">Projection System Offline</span>
                    <Button variant="link" size="sm" onClick={() => window.location.reload()} className="text-red-400 mt-1 h-auto p-0 text-xs">Retry</Button>
                </CardContent>
            </Card>
        );
    }

    // Calculate Months for Score
    const getMonthsDifference = (d1: Date, d2: Date) => {
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    };

    const standardMonths = Math.max(1, getMonthsDifference(now, standardDate));
    const velocityMonths = Math.max(1, getMonthsDifference(now, velocityDate));

    // Velocity Score (Speed Multiplier)
    const velocityScore = (standardMonths / velocityMonths).toFixed(1);

    // --- SIMULATOR LOGIC ---
    // Approximation: New Time = TotalDebt / (Implied Monthly Pay + Extra)
    // Implied Monthly Pay = TotalDebt / VelocityMonths
    const impliedMonthlyPay = data.total_debt / velocityMonths;
    const simulatedNewPay = impliedMonthlyPay + extraPayment;
    const simulatedMonths = simulatedNewPay > 0 ? data.total_debt / simulatedNewPay : velocityMonths;
    const simulatedSavingsMonths = Math.max(0, velocityMonths - simulatedMonths);

    // Simulated Date
    const simulatedDate = new Date(now);
    simulatedDate.setMonth(now.getMonth() + Math.round(simulatedMonths));

    // Visualization Vars
    const displayDate = extraPayment > 0 ? simulatedDate : velocityDate;
    const totalDays = Math.max(0, Math.ceil((displayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;

    return (
        <Card className="relative overflow-hidden border-blue-200 dark:border-blue-900/40 bg-gradient-to-br from-white dark:from-zinc-950 via-blue-50 dark:via-blue-950/10 to-white dark:to-zinc-950 shadow-lg dark:shadow-[0_0_60px_rgba(30,58,138,0.15)] h-full flex flex-col justify-between group">
            {/* Subtle pulsing glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl transition-all duration-1000 ${extraPayment > 0 ? 'bg-emerald-500/10 scale-110' : 'animate-pulse'}`} />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

            <CardContent className="relative p-6">
                {/* Header: Velocity Score & Label */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-900/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <Flame size={20} className="text-blue-400 fill-blue-500/20" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-wide uppercase">Velocity Engine</h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/20">
                                    {velocityScore}x SPEED
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Paying off debt {velocityScore}x faster than the bank
                            </p>
                        </div>
                    </div>
                    {/* Time Accelerated — moved here from standalone KPI */}
                    <div className="text-right">
                        <p className="text-2xl font-extrabold text-blue-400 font-mono tracking-tight leading-none">
                            {data.years_saved > 0 ? data.years_saved.toFixed(1) : (data.months_saved / 12).toFixed(1)}
                            <span className="text-sm text-blue-500/60 ml-1">yrs</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Ahead of schedule</p>
                    </div>
                </div>

                {/* Main Date Display (The Heart) */}
                <div className="text-center mb-8 relative">
                    <motion.div
                        key={displayDate.toISOString()}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2"
                    >
                        {displayDate.toLocaleDateString(locale, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </motion.div>

                    <div className="flex flex-col items-center gap-1">
                        <p className={`text-sm font-mono tracking-tight transition-colors ${extraPayment > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {extraPayment > 0
                                ? `Wait... that's ${Math.round(simulatedSavingsMonths)} months SOONER!`
                                : `You cut ${(data.months_saved + (data.years_saved * 12)).toFixed(0)} months of payments.`
                            }
                        </p>
                        <div className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent mt-2" />
                    </div>
                </div>

                {/* Countdown Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 backdrop-blur-sm group-hover:border-slate-300 dark:group-hover:border-slate-700/60 transition-colors">
                        <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">{years}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-bold">Years</div>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm group-hover:border-slate-700/60 transition-colors">
                        <div className="text-3xl font-extrabold text-white tabular-nums">{months}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-bold">Months</div>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm group-hover:border-slate-700/60 transition-colors">
                        <div className={`text-3xl font-extrabold tabular-nums ${extraPayment > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>{days}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-bold">Days</div>
                    </div>
                </div>

                {/* Freedom Dates Comparison */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-red-950/30 border border-emerald-800/20 mb-6">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-400 text-xs">⚡</span>
                        <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">With KoreX</p>
                            <p className="text-sm font-bold text-emerald-300 truncate">
                                {velocityDate.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <div className="text-zinc-600 text-xs font-mono">→</div>

                    <div className="flex items-center gap-2 min-w-0">
                        <Clock size={12} className="text-red-400/60 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-widest text-red-400/70 font-bold">Without</p>
                            <p className="text-sm font-bold text-red-400/70 line-through truncate">
                                {standardDate.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <span className="ml-auto px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        {data.months_saved}mo cut
                    </span>
                </div>

                {/* Simulator (Bottom Section) */}
                <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-zinc-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <TrendingUp size={14} className={extraPayment > 0 ? "text-emerald-400" : ""} />
                            <span className="text-xs font-semibold uppercase tracking-wider">Acceleration Simulator</span>
                        </div>
                        {extraPayment > 0 && (
                            <span className="text-xs font-bold text-emerald-400 animate-pulse">
                                +{formatMoney(extraPayment)} / mo
                            </span>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Slider
                            value={[extraPayment]}
                            max={2000}
                            step={50}
                            onValueChange={(v) => setExtraPayment(v[0])}
                            className="py-2"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono uppercase">
                            <span>Current Plan</span>
                            <span>+ $2,000/mo</span>
                        </div>
                    </div>
                </div>
            </CardContent>

            {/* Action Banner forces layout stretch */}
            <div className="mt-auto">
                <TacticalActionBanner />
            </div>
        </Card >
    );
}
