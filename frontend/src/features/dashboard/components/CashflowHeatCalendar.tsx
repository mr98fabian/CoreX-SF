import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowUpCircle, ArrowDownCircle, X } from "lucide-react";
import { apiFetch } from '@/lib/api';

// --- Types ---
interface CashflowEvent {
    name: string;
    amount: number;
    category: "income" | "expense";
}

interface ProjectionDay {
    date: string;
    balance: number;
    events: CashflowEvent[];
    is_today: boolean;
    zone: "past" | "today" | "future";
    day_label: string;
    day_num: number;
}

interface CashflowProjection {
    start_balance: number;
    today: string;
    total_days: number;
    days: ProjectionDay[];
}

// --- Color scale: balance → heat color ---
function getHeatColor(balance: number, min: number, max: number): string {
    const range = max - min || 1;
    const ratio = (balance - min) / range; // 0 to 1

    if (balance < 0) return "bg-rose-900/80 border-rose-700/40";
    if (ratio < 0.2) return "bg-rose-800/60 border-rose-700/30";
    if (ratio < 0.4) return "bg-amber-800/50 border-amber-700/30";
    if (ratio < 0.6) return "bg-emerald-900/50 border-emerald-700/30";
    if (ratio < 0.8) return "bg-emerald-800/60 border-emerald-600/30";
    return "bg-cyan-800/50 border-cyan-600/30";
}

function getHeatDot(balance: number, min: number, max: number): string {
    const range = max - min || 1;
    const ratio = (balance - min) / range;

    if (balance < 0) return "bg-rose-500";
    if (ratio < 0.2) return "bg-rose-400";
    if (ratio < 0.4) return "bg-amber-500";
    if (ratio < 0.6) return "bg-emerald-500";
    if (ratio < 0.8) return "bg-emerald-400";
    return "bg-cyan-400";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const formatMoneyShort = (n: number) => {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
};

// --- Main Component ---
export default function CashflowHeatCalendar() {
    const [data, setData] = useState<CashflowProjection | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<ProjectionDay | null>(null);

    const fetchProjection = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiFetch<CashflowProjection>('/api/cashflow/projection?months=6');
            setData(result);
        } catch {
            console.error("Failed to load projection");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProjection(); }, [fetchProjection]);

    if (loading || !data) {
        return (
            <Card className="border-slate-800 bg-slate-950/50">
                <CardContent className="p-6">
                    <div className="h-32 flex items-center justify-center">
                        <div className="animate-pulse text-slate-600 text-sm">Loading cashflow heat map...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // --- Organize days into months ---
    const balances = data.days.map(d => d.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);

    type MonthGroup = { label: string; weeks: (ProjectionDay | null)[][] };
    const months: MonthGroup[] = [];

    let currentMonth = -1;
    let currentGroup: MonthGroup | null = null;

    for (const day of data.days) {
        const d = new Date(day.date + "T12:00:00");
        const m = d.getMonth();

        if (m !== currentMonth) {
            currentGroup = {
                label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
                weeks: [],
            };
            months.push(currentGroup);
            currentMonth = m;

            // Pad the first week with nulls for alignment
            // JS getDay: 0=Sun, convert to Mon-based: (getDay()+6)%7
            const dayOfWeek = (d.getDay() + 6) % 7;
            const firstWeek: (ProjectionDay | null)[] = Array(dayOfWeek).fill(null);
            firstWeek.push(day);
            currentGroup.weeks.push(firstWeek);
        } else if (currentGroup) {
            const lastWeek = currentGroup.weeks[currentGroup.weeks.length - 1];
            if (lastWeek.length >= 7) {
                currentGroup.weeks.push([day]);
            } else {
                lastWeek.push(day);
            }
        }
    }

    // Find previous day for delta calculation
    const getPrevDay = (day: ProjectionDay): ProjectionDay | null => {
        const idx = data.days.findIndex(d => d.date === day.date);
        return idx > 0 ? data.days[idx - 1] : null;
    };

    return (
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-white text-base">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-cyan-400" />
                        Cashflow Heat Map
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-rose-800" />
                            Low
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-amber-700" />
                            Tight
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-emerald-700" />
                            Good
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-cyan-600" />
                            Surplus
                        </div>
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-5">
                {/* Month grids side by side */}
                <div className="flex gap-6 overflow-x-auto pb-2">
                    {months.map((month) => (
                        <div key={month.label} className="shrink-0 min-w-[220px]">
                            <div className="text-xs text-slate-400 font-mono mb-2 tracking-wide">
                                {month.label}
                            </div>
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {WEEKDAYS.map(wd => (
                                    <div key={wd} className="text-[9px] text-slate-600 text-center font-mono">
                                        {wd}
                                    </div>
                                ))}
                            </div>
                            {/* Day cells */}
                            {month.weeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                                    {week.map((day, di) => {
                                        if (!day) {
                                            return <div key={`empty-${di}`} className="aspect-square" />;
                                        }

                                        const hasIncome = day.events.some(e => e.category === "income");
                                        const hasExpense = day.events.some(e => e.category === "expense");
                                        const isSelected = selectedDay?.date === day.date;

                                        return (
                                            <button
                                                key={day.date}
                                                onClick={() => setSelectedDay(isSelected ? null : day)}
                                                className={`
                                                    aspect-square rounded-md border text-[10px] font-mono
                                                    flex flex-col items-center justify-center gap-0.5
                                                    transition-all duration-200 cursor-pointer relative
                                                    hover:scale-110 hover:z-10 hover:shadow-lg
                                                    ${getHeatColor(day.balance, minBal, maxBal)}
                                                    ${day.is_today
                                                        ? "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)] z-10"
                                                        : ""}
                                                    ${isSelected
                                                        ? "ring-2 ring-white/60 scale-110"
                                                        : ""}
                                                `}
                                                title={`${day.date}: ${formatMoney(day.balance)}`}
                                            >
                                                <span className={`leading-none ${day.is_today ? "text-amber-300 font-bold" : "text-slate-300"}`}>
                                                    {day.day_num}
                                                </span>
                                                {/* Event dots */}
                                                {(hasIncome || hasExpense) && (
                                                    <div className="flex gap-0.5">
                                                        {hasIncome && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                                                        {hasExpense && <span className="w-1 h-1 rounded-full bg-rose-400" />}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* --- Click Popup: Day Detail Panel --- */}
                {selectedDay && (
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-xl p-4 animate-in slide-in-from-bottom-3 duration-300">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${getHeatDot(selectedDay.balance, minBal, maxBal)}`} />
                                <div>
                                    <span className="text-sm font-semibold text-white">
                                        {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", {
                                            weekday: "long", month: "long", day: "numeric", year: "numeric",
                                        })}
                                    </span>
                                    {selectedDay.is_today && (
                                        <span className="ml-2 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                            TODAY
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="text-slate-500 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Balance + Delta */}
                        <div className="flex items-baseline gap-4 mb-4">
                            <span className="text-2xl font-bold font-mono text-white">
                                {formatMoney(selectedDay.balance)}
                            </span>
                            {(() => {
                                const prev = getPrevDay(selectedDay);
                                if (!prev) return null;
                                const delta = selectedDay.balance - prev.balance;
                                if (delta === 0) return null;
                                return (
                                    <span className={`text-sm font-mono ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {delta > 0 ? "+" : ""}{formatMoney(delta)} vs yesterday
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Events: Income and Expenses */}
                        {selectedDay.events.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Expected Money In */}
                                {selectedDay.events.filter(e => e.category === "income").length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                                            <ArrowUpCircle className="h-3.5 w-3.5" />
                                            EXPECTED MONEY IN
                                        </div>
                                        {selectedDay.events
                                            .filter(e => e.category === "income")
                                            .map((ev, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
                                                    <span className="text-sm text-slate-300">{ev.name}</span>
                                                    <span className="text-sm font-mono font-semibold text-emerald-400">
                                                        +{formatMoney(Math.abs(ev.amount))}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}

                                {/* Expected Money Out */}
                                {selectedDay.events.filter(e => e.category === "expense").length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold">
                                            <ArrowDownCircle className="h-3.5 w-3.5" />
                                            EXPECTED MONEY OUT
                                        </div>
                                        {selectedDay.events
                                            .filter(e => e.category === "expense")
                                            .map((ev, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-900/30">
                                                    <span className="text-sm text-slate-300">{ev.name}</span>
                                                    <span className="text-sm font-mono font-semibold text-rose-400">
                                                        {formatMoney(ev.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 italic">No scheduled transactions for this day</p>
                        )}
                    </div>
                )}

                {/* Balance range footer */}
                <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-slate-800/50">
                    <span>Min: <span className="font-mono text-slate-400">{formatMoneyShort(minBal)}</span></span>
                    <span>Today: <span className="font-mono text-amber-400">{formatMoneyShort(data.start_balance)}</span></span>
                    <span>Max: <span className="font-mono text-slate-400">{formatMoneyShort(maxBal)}</span></span>
                </div>
            </CardContent>
        </Card>
    );
}
