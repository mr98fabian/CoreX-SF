import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Movement {
    day: number;
    date: string; // ISO Date
    display_date: string; // Readable Date
    title: string;
    description: string;
    amount: number;
    type: 'pump' | 'payment' | 'expense' | 'attack';
    source: string;
    destination: string;
}

export default function TacticalActionBanner() {
    const [loading, setLoading] = useState(true);
    const [nextMove, setNextMove] = useState<Movement | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await apiFetch<Movement[]>('/api/strategy/tactical-gps');
            if (Array.isArray(data)) {
                // Find next move based on full date comparison
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize to start of day

                // Filter for moves today or in future
                const upcoming = data.filter((m: Movement) => {
                    const moveDate = new Date(m.date);
                    return moveDate >= today;
                });

                // Sort by date ascending
                upcoming.sort((a: Movement, b: Movement) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (upcoming.length > 0) {
                    setNextMove(upcoming[0]);
                } else {
                    setNextMove(null);
                }
            }
        } catch (error) {
            console.error("Failed to fetch tactical GPS", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [executing, setExecuting] = useState(false);

    const handleExecute = async () => {
        if (!nextMove) return;
        setExecuting(true);
        try {
            const payload = {
                movement_key: `${nextMove.title}-${nextMove.date}-${nextMove.amount}`, // Unique key
                title: nextMove.title,
                amount: nextMove.amount,
                date_planned: nextMove.date,
                source: nextMove.source,
                destination: nextMove.destination
            };

            await apiFetch('/api/strategy/execute', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Refresh data to show next move
            await fetchData();
        } catch (error) {
            console.error("Error executing action", error);
        } finally {
            setExecuting(false);
        }
    };

    if (loading) return <div className="h-8 animate-pulse bg-zinc-800/50 w-full rounded-b-xl" />;

    if (!nextMove) {
        return (
            <div className="flex items-center justify-center p-2 bg-emerald-950/30 border-t border-emerald-900/30 text-emerald-400 text-xs font-medium">
                <CheckCircle2 size={12} className="mr-2" strokeWidth={1.5} />
                All tactical moves executed for now.
            </div>
        );
    }

    const isAttack = nextMove.type === 'attack' || nextMove.type === 'pump';
    const bgColor = isAttack
        ? 'bg-gradient-to-r from-emerald-950/50 to-blue-950/50'
        : 'bg-zinc-900/50';

    const borderColor = isAttack ? 'border-emerald-500/20' : 'border-zinc-800';

    return (
        <div className={`flex items-center justify-between px-4 py-2 border-t ${borderColor} ${bgColor} backdrop-blur-sm transition-all duration-500`}>
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-1 rounded-full ${isAttack ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {isAttack ? <RefreshCw size={12} strokeWidth={1.5} /> : <ArrowRight size={12} strokeWidth={1.5} />}
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            {(() => {
                                const moveDate = new Date(nextMove.date);
                                const today = new Date();
                                moveDate.setHours(0, 0, 0, 0);
                                today.setHours(0, 0, 0, 0);

                                if (moveDate.getTime() === today.getTime()) return <span className="text-emerald-400 animate-pulse font-extrabold">HOY</span>;
                                if (moveDate.getTime() < today.getTime()) return <span className="text-rose-400 font-bold">EXPIRED</span>;
                                return nextMove.display_date;
                            })()}
                        </span>
                        <span className="text-xs font-medium text-zinc-200 truncate max-w-[180px]">
                            {nextMove.title}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <span className={`text-sm font-bold font-mono ${isAttack ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(nextMove.amount)}
                </span>

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] hover:bg-white/5 hover:text-white text-zinc-400 border border-transparent hover:border-zinc-700 rounded-md uppercase tracking-wider disabled:opacity-50"
                    onClick={handleExecute}
                    disabled={executing}
                >
                    {executing ? "EXECUTING..." : "EXECUTE"}
                </Button>
            </div>
        </div>
    );
}
