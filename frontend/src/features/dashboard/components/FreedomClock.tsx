import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Clock, Flame } from 'lucide-react';
import TacticalActionBanner from './TacticalActionBanner';

interface FreedomData {
    velocity_debt_free_date: string;
    standard_debt_free_date: string;
    months_saved: number;
    years_saved: number;
    interest_saved: number;
    total_debt: number;
}

/**
 * FreedomClock — The heartbeat of CoreX.
 * A dynamic countdown showing the projected date of financial freedom.
 */
export default function FreedomClock() {
    const [data, setData] = useState<FreedomData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://127.0.0.1:8001/api/velocity/projections')
            .then(res => res.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Card className="border-blue-900/30 bg-gradient-to-br from-zinc-950 to-blue-950/20 animate-pulse">
                <CardContent className="h-48 flex items-center justify-center">
                    <div className="text-blue-500 font-mono text-sm">Calculating Freedom Date...</div>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const freedomDate = new Date(data.velocity_debt_free_date);
    const now = new Date();
    const totalDays = Math.max(0, Math.ceil((freedomDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;

    const standardDate = new Date(data.standard_debt_free_date);
    const standardDays = Math.max(0, Math.ceil((standardDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const daysAccelerated = standardDays - totalDays;

    const formatMoney = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    return (
        <Card className="relative overflow-hidden border-blue-900/40 bg-gradient-to-br from-zinc-950 via-blue-950/10 to-zinc-950 shadow-[0_0_60px_rgba(30,58,138,0.15)]">
            {/* Subtle pulsing glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

            <CardContent className="relative p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-900/30">
                            <Flame size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-200 tracking-wide uppercase">Freedom Date</h3>
                            <p className="text-[10px] text-slate-500 font-mono">CoreX Velocity Projection</p>
                        </div>
                    </div>
                    {daysAccelerated > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-900/30">
                            <Zap size={12} className="text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">{daysAccelerated} days faster</span>
                        </div>
                    )}
                </div>

                {/* Main Date Display */}
                <div className="text-center mb-6">
                    <div className="text-5xl font-extrabold tracking-tight text-white mb-2">
                        {freedomDate.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </div>
                    <p className="text-sm text-slate-500 font-mono">
                        Projected debt-free on this date
                    </p>
                </div>

                {/* Countdown Boxes */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="text-center p-4 rounded-xl bg-slate-900/60 border border-slate-800/50">
                        <div className="text-3xl font-extrabold text-white tabular-nums">{years}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Years</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
                        <div className="text-3xl font-extrabold text-white tabular-nums">{months}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Months</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
                        <div className="text-3xl font-extrabold text-blue-400 tabular-nums">{days}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Days</div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center justify-between text-xs border-t border-zinc-800/50 pt-4">
                    <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-zinc-500" />
                        <span className="text-zinc-500">Bank estimate:</span>
                        <span className="text-slate-400 font-medium line-through decoration-rose-500/50">
                            {standardDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Interest saved:</span>
                        <span className="text-emerald-400 font-bold">{formatMoney(data.interest_saved)}</span>
                    </div>
                </div>
            </CardContent>

            <TacticalActionBanner />
        </Card >
    );
}
