import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CalendarEvent {
    name: string;
    amount: number;
    type: 'bill' | 'income';
}

interface CalendarDay {
    date: string; // YYYY-MM-DD
    events: CalendarEvent[];
    ending_balance: number;
    is_critical: boolean;
    is_reinforcement: boolean;
    status: 'safe' | 'warning' | 'danger';
}

interface TacticalCalendarProps {
    days: CalendarDay[];
    shieldTarget: number;
}

export default function TacticalCalendar({ days, shieldTarget }: TacticalCalendarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            day: date.getDate(),
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            weekday: date.toLocaleDateString('en-US', { weekday: 'short' })
        };
    };

    if (!days || days.length === 0) return null;

    return (
        <Card className="border-blue-300 dark:border-blue-500/20 bg-white/50 dark:bg-black/40 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    TACTICAL CASHFLOW MAP
                </CardTitle>
            </CardHeader>

            <CardContent>
                <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-transparent"
                    style={{ scrollSnapType: 'x mandatory' }}
                >
                    {days.map((day, index) => {
                        const { day: dayNum, weekday } = formatDate(day.date);
                        const isDanger = day.status === 'danger';
                        const isWarning = day.status === 'warning';

                        return (
                            <motion.div
                                key={day.date}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={cn(
                                    "min-w-[80px] h-[110px] rounded-lg border flex flex-col items-center justify-between p-2 relative group transition-all duration-300 snap-start",
                                    isDanger ? "bg-rose-950/20 border-rose-500/30 hover:bg-rose-950/40" :
                                        isWarning ? "bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/40" :
                                            "bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:border-blue-400 dark:hover:border-blue-500/30"
                                )}
                            >
                                {/* Date Header */}
                                <div className="text-center w-full border-b border-slate-200 dark:border-white/5 pb-1">
                                    <div className="text-[10px] uppercase text-zinc-500 font-mono tracking-wider">{weekday}</div>
                                    <div className={cn("text-lg font-bold", isDanger ? "text-rose-400" : "text-slate-900 dark:text-white")}>{dayNum}</div>
                                </div>

                                {/* Events Indicators */}
                                <div className="flex flex-col gap-1 w-full flex-1 justify-center items-center">
                                    {day.events.slice(0, 2).map((event, i) => (
                                        <div key={i} className="flex items-center gap-1 w-full">
                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                                                event.type === 'bill' ? "bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                                            )} />
                                            <span className="text-[9px] text-zinc-400 truncate leading-none">
                                                {formatMoney(event.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    {day.events.length > 2 && <span className="text-[9px] text-zinc-600">+{day.events.length - 2} more</span>}
                                </div>

                                {/* Projected Balance (Always visible on hover, or simple dot if standard) */}
                                <div className="text-[10px] font-mono font-medium text-zinc-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    {formatMoney(day.ending_balance)}
                                </div>

                                {/* Status Line */}
                                {isDanger && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500 shadow-[0_0_10px_#f43f5e]" />
                                )}
                                {day.is_reinforcement && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                )}

                                {/* Hover Tooltip (Native Title for speed) */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-2 text-center transition-opacity z-10 rounded-lg">
                                    <span className="text-[10px] text-zinc-400 mb-1">Projected</span>
                                    <span className={cn("text-xs font-bold mb-2", isDanger ? "text-rose-400" : "text-blue-400")}>
                                        {formatMoney(day.ending_balance)}
                                    </span>
                                    {isDanger && <span className="text-[8px] text-rose-500 uppercase font-bold tracking-widest">Shield Breach</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex justify-between items-center mt-3 px-1 text-[10px] text-zinc-600">
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Bill Due</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Income</span>
                    </div>
                    <span className="flex items-center gap-1 text-blue-500/50">
                        <ShieldCheck className="w-3 h-3" />
                        Shield Target: {formatMoney(shieldTarget)}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
