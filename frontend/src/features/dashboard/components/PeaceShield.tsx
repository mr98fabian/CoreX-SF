import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ShieldCheck, ShieldAlert, Zap, Lock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCashflowStats } from '../../accounts/hooks/useCashflowStats';

interface ShieldData {
    shield_target: number;
    current_fill: number;
    fill_percentage: number;
    deficit: number;
    is_active: boolean;
    attack_authorized: boolean;
    status: string;
    message: string;
}

/**
 * PeaceShield — The Emergency Fund Defense System.
 * Shows a visual meter of the user's emergency buffer.
 * When the shield is fully charged, Velocity Attacks are authorized.
 * When depleted, attacks are paused and the shield fills first.
 */
export default function PeaceShield() {
    const [data, setData] = useState<ShieldData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [newTarget, setNewTarget] = useState("");

    // NEW: Hook for financial intelligence
    const { calculateStats } = useCashflowStats();
    const stats = calculateStats('monthly');
    const recommendedShield = stats.monthlyExpenses * 3;

    const fetchShield = () => {
        fetch('/api/peace-shield')
            .then(res => res.json())
            .then(d => {
                setData(d);
                setNewTarget(d.shield_target.toString());
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
                setError(true);
            });
    };

    useEffect(() => {
        fetchShield();
    }, []);

    const updateTarget = async () => {
        try {
            const res = await fetch('/api/user/me/shield', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: parseFloat(newTarget) })
            });
            if (res.ok) {
                toast.success("Peace Shield Updated");
                setEditOpen(false);
                fetchShield();
            } else {
                toast.error("Failed to update shield");
            }
        } catch (e) {
            toast.error("Error updating shield");
        }
    };

    const formatMoney = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    if (loading) {
        return (
            <Card className="border-slate-800 bg-slate-900/50 animate-pulse">
                <CardContent className="h-32 flex items-center justify-center">
                    <div className="text-slate-500 font-mono text-sm">Shield Status Loading...</div>
                </CardContent>
            </Card>
        );
    }


    if (error) {
        return (
            <Card className="border-red-900/40 bg-red-950/10">
                <CardContent className="h-32 flex flex-col items-center justify-center text-red-500">
                    <ShieldAlert size={24} className="mb-2 opacity-50" />
                    <span className="text-xs font-mono">Shield System Offline</span>
                    <Button variant="link" size="sm" onClick={fetchShield} className="text-red-400 mt-1 h-auto p-0 text-xs">Retry Connection</Button>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const isCharged = data.is_active;
    const fillPct = Math.min(100, data.fill_percentage);

    return (
        <Card className={`relative overflow-hidden border transition-all duration-500 group h-full flex flex-col justify-center ${isCharged
            ? 'border-emerald-900/40 bg-gradient-to-r from-zinc-950 to-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
            : 'border-amber-900/40 bg-gradient-to-r from-zinc-950 to-amber-950/10 shadow-[0_0_20px_rgba(245,158,11,0.08)]'
            }`}>
            <CardContent className="p-4">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-slate-800 text-white">
                            <DialogHeader>
                                <DialogTitle>Configure Peace Shield</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Target Amount (Peace Amount)</Label>
                                    <Input
                                        type="number"
                                        value={newTarget}
                                        onChange={(e) => setNewTarget(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                    <p className="text-xs text-slate-500">
                                        The amount of liquid cash you need to feel safe.
                                        Usually 3-6 months of expenses, or a fixed amount like $1,000.
                                    </p>
                                </div>

                                {/* RECOMMENDATION ENGINE */}
                                {stats.monthlyExpenses > 0 && (
                                    <div className="bg-emerald-900/10 border border-emerald-500/20 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck size={14} className="text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">AI Recommendation</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="text-lg font-bold text-white">{formatMoney(recommendedShield)}</div>
                                                <div className="text-[10px] text-emerald-500/70">3 Months of Living Expenses</div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                                onClick={() => setNewTarget(recommendedShield.toFixed(2))}
                                            >
                                                Apply
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Button onClick={updateTarget} className="w-full bg-emerald-600 hover:bg-emerald-700">
                                    Update Shield
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex items-center gap-4">
                    {/* Shield Icon */}
                    <div className={`p-3 rounded-2xl border ${isCharged
                        ? 'bg-emerald-500/10 border-emerald-900/30'
                        : 'bg-amber-500/10 border-amber-900/30 animate-pulse'
                        }`}>
                        {isCharged
                            ? <ShieldCheck size={24} className="text-emerald-400" />
                            : <ShieldAlert size={24} className="text-amber-400" />
                        }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-zinc-200">Peace Shield</h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isCharged
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                }`}>
                                {data.status}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2.5 rounded-full bg-zinc-900 border border-zinc-800/50 overflow-hidden mb-1.5">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${isCharged
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_#10b981]'
                                    : 'bg-gradient-to-r from-amber-700 to-amber-400'
                                    }`}
                                style={{ width: `${fillPct}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 font-mono">
                                {formatMoney(data.current_fill)} / {formatMoney(data.shield_target)}
                            </span>
                            <span className={`font-bold ${isCharged ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {fillPct}%
                            </span>
                        </div>
                    </div>

                    {/* Attack Status */}
                    <div className={`text-center px-3 py-2 rounded-xl border min-w-[90px] ${isCharged
                        ? 'bg-emerald-500/5 border-emerald-900/20'
                        : 'bg-zinc-900/50 border-zinc-800/50'
                        }`}>
                        {isCharged ? (
                            <>
                                <Zap size={18} className="text-emerald-400 mx-auto mb-0.5" />
                                <div className="text-[10px] font-bold text-emerald-400 uppercase">Attack</div>
                                <div className="text-[9px] text-emerald-500/70">Authorized</div>
                            </>
                        ) : (
                            <>
                                <Lock size={18} className="text-zinc-600 mx-auto mb-0.5" />
                                <div className="text-[10px] font-bold text-zinc-500 uppercase">Attack</div>
                                <div className="text-[9px] text-zinc-600">Paused</div>
                            </>
                        )}
                    </div>
                </div>

                {/* Deficit message when not fully charged */}
                {!isCharged && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-900/20 text-xs text-amber-400/80 flex items-center gap-2">
                        <Shield size={12} />
                        {data.message}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
