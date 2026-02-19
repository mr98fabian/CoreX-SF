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
    const pct = (balance - min) / range;

    if (pct < 0.25) return "bg-rose-900/70 border-rose-800/50 text-rose-200";
    if (pct < 0.45) return "bg-rose-800/50 border-rose-700/40 text-rose-200";
    if (pct < 0.55) return "bg-amber-900/50 border-amber-800/40 text-amber-200";
    if (pct < 0.70) return "bg-emerald-900/50 border-emerald-800/40 text-emerald-200";
    if (pct < 0.85) return "bg-emerald-800/60 border-emerald-700/40 text-emerald-200";
    return "bg-cyan-900/50 border-cyan-800/40 text-cyan-200";
}

function getHeatDot(balance: number, min: number, max: number): string {
    const range = max - min || 1;
    const pct = (balance - min) / range;

    if (pct < 0.25) return "bg-rose-500";
    if (pct < 0.45) return "bg-rose-400";
    if (pct < 0.55) return "bg-amber-500";
    if (pct < 0.70) return "bg-emerald-500";
    if (pct < 0.85) return "bg-emerald-400";
    return "bg-cyan-400";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMoney(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatMoneyShort(n: number) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

// --- Day Detail Panel (reusable for inline & mobile modal) ---
function DayDetailContent({
    selectedDay,
    minBal,
    maxBal,
    getPrevDay,
    onClose,
}: {
    selectedDay: ProjectionDay;
    minBal: number;
    maxBal: number;
    getPrevDay: (day: ProjectionDay) => ProjectionDay | null;
    onClose: () => void;
}) {
    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${getHeatDot(selectedDay.balance, minBal, maxBal)}`} />
                    <div className="min-w-0">
                        <span className="text-sm font-semibold text-white block truncate">
                            {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", {
                                weekday: "long", month: "long", day: "numeric", year: "numeric",
                            })}
                        </span>
                        {selectedDay.is_today && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                TODAY
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-white transition-colors shrink-0 p-1"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Balance + Delta */}
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-4">
                <span className="text-2xl font-bold font-mono text-white">
                    {formatMoney(selectedDay.balance)}
                </span>
                {(() => {
                    const prev = getPrevDay(selectedDay);
                    if (!prev) return null;
                    const delta = selectedDay.balance - prev.balance;
                    if (delta === 0) return null;
                    return (
                        <span className={`text-xs sm:text-sm font-mono ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {delta > 0 ? "+" : ""}{formatMoney(delta)} vs yesterday
                        </span>
                    );
                })()}
            </div>

            {/* Events: Income and Expenses */}
            {selectedDay.events.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                                        <span className="text-sm text-slate-300 truncate mr-2">{ev.name}</span>
                                        <span className="text-sm font-mono font-semibold text-emerald-400 shrink-0">
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
                                        <span className="text-sm text-slate-300 truncate mr-2">{ev.name}</span>
                                        <span className="text-sm font-mono font-semibold text-rose-400 shrink-0">
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
    );
}

// --- Main Component ---
export default function CashflowHeatCalendar() {
    const [data, setData] = useState<CashflowProjection | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<ProjectionDay | null>(null);

    const fetchProjection = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiFetch<CashflowProjection>('/api/cashflow/projection?months=5');
            setData(result);
        } catch {
            console.error("Failed to load projection");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProjection(); }, [fetchProjection]);

    // Lock body scroll when modal is open on mobile
    useEffect(() => {
        if (!selectedDay) return;
        const isMobile = window.innerWidth < 640;
        if (!isMobile) return;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [selectedDay]);

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
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-slate-500 flex-wrap">
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
                {/* Month grids — single column on mobile to prevent overlap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-4">
                    {months.slice(0, 5).map((month) => (
                        <div key={month.label} className="min-w-0">
                            <div className="text-xs text-slate-400 font-mono mb-2 tracking-wide">
                                {month.label}
                            </div>
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 gap-1.5 sm:gap-1 mb-1">
                                {WEEKDAYS.map(wd => (
                                    <div key={wd} className="text-[10px] sm:text-[9px] text-slate-600 text-center font-mono">
                                        {wd}
                                    </div>
                                ))}
                            </div>
                            {/* Day cells */}
                            {month.weeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7 gap-1.5 sm:gap-1 mb-1">
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
                                                    aspect-square rounded-md border text-xs sm:text-[10px] font-mono
                                                    flex flex-col items-center justify-center gap-0.5
                                                    transition-all duration-200 cursor-pointer relative
                                                    hover:scale-110 hover:z-10 hover:shadow-lg
                                                    min-h-[36px] sm:min-h-0
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

                {/* --- Centered Modal for Day Detail (all screen sizes) --- */}
                {selectedDay && (
                    <>
                        {/* Backdrop overlay */}
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                            onClick={() => setSelectedDay(null)}
                        />
                        {/* Centered modal card */}
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <div className="w-full max-w-lg pointer-events-auto rounded-2xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 animate-in zoom-in-95 slide-in-from-bottom-3 duration-300 max-h-[80vh] overflow-y-auto">
                                {/* Accent bar */}
                                <div className="h-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-500 rounded-t-2xl" />
                                <DayDetailContent
                                    selectedDay={selectedDay}
                                    minBal={minBal}
                                    maxBal={maxBal}
                                    getPrevDay={getPrevDay}
                                    onClose={() => setSelectedDay(null)}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Balance range footer */}
                <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-800/50">
                    <span>Min: <span className="font-mono font-semibold text-slate-300">{formatMoneyShort(minBal)}</span></span>
                    <span>Today: <span className="font-mono font-semibold text-amber-400">{formatMoneyShort(data.start_balance)}</span></span>
                    <span>Max: <span className="font-mono font-semibold text-slate-300">{formatMoneyShort(maxBal)}</span></span>
                </div>
            </CardContent>
        </Card>
    );
}
