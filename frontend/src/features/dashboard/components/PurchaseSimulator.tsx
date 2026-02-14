import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Calculator,
    Clock,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    Loader2,
} from 'lucide-react';

interface SimulationResult {
    purchase_amount: number;
    days_delayed: number;
    months_delayed: number;
    cost_in_interest: number;
    message: string;
}

// Preset quick-test amounts for common purchases
const PRESETS = [
    { label: 'Coffee ☕', amount: 7 },
    { label: 'Dinner 🍽️', amount: 85 },
    { label: 'New Shoes 👟', amount: 200 },
    { label: 'Weekend Trip ✈️', amount: 500 },
    { label: 'New Phone 📱', amount: 1200 },
    { label: 'Used Car 🚗', amount: 5000 },
];

/**
 * PurchaseSimulator — "The Cost of Living Future"
 * Converts any price tag into "time cost" — how many days
 * a purchase delays financial freedom.
 */
export default function PurchaseSimulator() {
    const [amount, setAmount] = useState<string>('');
    const [result, setResult] = useState<SimulationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const simulate = async (value: number) => {
        if (value <= 0) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await apiFetch<SimulationResult>('/api/simulator/time-cost', {
                method: 'POST',
                body: JSON.stringify({ amount: value }),
            });
            setResult(data);
        } catch {
            setError('Could not connect to the KoreX engine.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const value = parseFloat(amount);
        if (isNaN(value) || value <= 0) return;
        simulate(value);
    };

    const formatMoney = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const getSeverityColor = (days: number) => {
        if (days === 0) return 'text-emerald-400';
        if (days <= 30) return 'text-amber-400';
        if (days <= 90) return 'text-orange-400';
        return 'text-rose-400';
    };

    const getSeverityBg = (days: number) => {
        if (days === 0) return 'bg-emerald-500/10 border-emerald-900/30';
        if (days <= 30) return 'bg-amber-500/10 border-amber-900/30';
        if (days <= 90) return 'bg-orange-500/10 border-orange-900/30';
        return 'bg-rose-500/10 border-rose-900/30';
    };

    return (
        <Card className="border-slate-800 bg-slate-950/50 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800/50">
                <CardTitle className="flex items-center gap-2 text-zinc-200 text-base">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-900/30">
                        <Calculator size={16} className="text-amber-400" strokeWidth={1.5} />
                    </div>
                    Purchase Simulator
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">
                        "What does this REALLY cost?"
                    </span>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Input Form */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                        <DollarSign
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                            strokeWidth={1.5}
                        />
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter purchase amount..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-sm"
                            min="1"
                            step="0.01"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={loading || !amount}
                        className="bg-blue-600 hover:bg-slate-800 text-white px-6"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Analyze'}
                    </Button>
                </form>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => {
                                setAmount(String(p.amount));
                                simulate(p.amount);
                            }}
                            className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900/80 border border-zinc-800/50 text-slate-400 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                        >
                            {p.label} · ${p.amount}
                        </button>
                    ))}
                </div>

                {/* Error State */}
                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-900/30 text-rose-400 text-sm">
                        <AlertTriangle size={16} strokeWidth={1.5} />
                        {error}
                    </div>
                )}

                {/* Result Display */}
                {result && (
                    <div className={`p-4 rounded-xl border ${getSeverityBg(result.days_delayed)} space-y-3`}>
                        {/* Main Impact */}
                        <div className="text-center">
                            <div className={`text-4xl font-extrabold tabular-nums ${getSeverityColor(result.days_delayed)}`}>
                                {result.days_delayed === 0 ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle size={28} strokeWidth={1.5} />
                                        <span>Safe</span>
                                    </div>
                                ) : (
                                    <>+{result.days_delayed} days</>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                                {result.days_delayed > 0
                                    ? 'added to your debt-free timeline'
                                    : 'Minimal impact on your freedom date'}
                            </p>
                        </div>

                        {/* Detail Breakdown */}
                        {result.days_delayed > 0 && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                <div className="text-center p-2 rounded-lg bg-black/20">
                                    <div className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                                        <Clock size={10} strokeWidth={1.5} />
                                        Time Delay
                                    </div>
                                    <div className="text-sm font-bold text-zinc-200 mt-0.5">
                                        {result.months_delayed > 0
                                            ? `${result.months_delayed} mo, ${result.days_delayed % 30} days`
                                            : `${result.days_delayed} days`}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-black/20">
                                    <div className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                                        <DollarSign size={10} strokeWidth={1.5} />
                                        Extra Interest
                                    </div>
                                    <div className="text-sm font-bold text-rose-400 mt-0.5">
                                        {formatMoney(result.cost_in_interest)}
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-zinc-500 text-center italic">
                            {result.message}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
