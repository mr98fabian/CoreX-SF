import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import {
    useCashflowProjection,
    type ProjectionDay,
} from "../hooks/useCashflowProjection";

// --- Tooltip Component (inline) ---
function DayTooltip({ day, delta, position }: { day: ProjectionDay; delta: number | null; position: { x: number; y: number } }) {
    const formatMoney = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    const zoneBadge = {
        past: { text: "PAST", cls: "text-gray-400 bg-neutral-800/60" },
        today: { text: "TODAY", cls: "text-amber-400 bg-amber-400/10" },
        future: { text: "FUTURE", cls: "text-blue-400 bg-blue-400/10" },
    }[day.zone];

    return (
        <div
            className="fixed z-50 pointer-events-none px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700/60 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 min-w-[220px] max-w-[280px]"
            style={{ left: position.x, top: position.y - 10, transform: "translate(-50%, -100%)" }}
        >
            {/* Full date + zone badge */}
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs text-slate-600 dark:text-gray-300 font-medium">
                    {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "long", month: "short", day: "numeric", year: "numeric",
                    })}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${zoneBadge.cls}`}>
                    {zoneBadge.text}
                </span>
            </div>

            {/* Balance + Delta */}
            <div className="flex items-baseline gap-3 mb-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                    {formatMoney(day.balance)}
                </span>
                {delta !== null && delta !== 0 && (
                    <span className={`text-xs font-mono ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {delta > 0 ? "+" : ""}{formatMoney(delta)}
                    </span>
                )}
            </div>

            {/* Events */}
            {day.events.length > 0 && (
                <div className="space-y-1 border-t border-gray-200 dark:border-neutral-800 pt-2">
                    {day.events.map((ev, i) => (
                        <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-gray-400 truncate max-w-[140px]">{ev.name}</span>
                            <span className={`shrink-0 font-mono ${ev.category === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                                {ev.category === "income" ? "+" : ""}{formatMoney(ev.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TacticalCashflowMap() {
    const { data, loading, error } = useCashflowProjection(3);
    const [hoveredDay, setHoveredDay] = useState<ProjectionDay | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    if (loading) {
        return (
            <Card className="border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                <CardContent className="p-6">
                    <div className="h-48 flex items-center justify-center">
                        <div className="animate-pulse text-slate-600 text-sm">Loading projection...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                <CardContent className="p-6">
                    <div className="h-48 flex items-center justify-center text-rose-400 text-sm">
                        {error || "No projection data"}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // --- Calculate bar heights ---
    const balances = data.days.map((d) => d.balance);
    const maxBal = Math.max(...balances, 1);
    const minBal = Math.min(...balances, 0);
    const range = maxBal - minBal || 1;
    const barMaxHeight = 160; // px

    const getBarHeight = (balance: number) =>
        Math.max(4, ((balance - minBal) / range) * barMaxHeight);

    const getBarColor = (day: ProjectionDay) => {
        if (day.balance < 0) return "bg-rose-500";
        if (day.zone === "past") return "bg-slate-700/40";
        if (day.zone === "today") return "bg-gradient-to-t from-amber-500 to-amber-400";
        return "bg-gradient-to-t from-blue-600 to-cyan-400";
    };

    // Month labels
    const monthLabels: { label: string; offset: number }[] = [];
    let lastMonth = -1;
    data.days.forEach((d, i) => {
        const m = new Date(d.date + "T12:00:00").getMonth();
        if (m !== lastMonth) {
            monthLabels.push({
                label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" }),
                offset: i,
            });
            lastMonth = m;
        }
    });

    const formatMoney = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dayIndex = Math.floor((x / rect.width) * data.days.length);
        const clamped = Math.max(0, Math.min(dayIndex, data.days.length - 1));
        const day = data.days[clamped];
        if (day) {
            setHoveredDay(day);
            setTooltipPos({ x: e.clientX, y: rect.top });
        }
    };

    return (
        <Card className="border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white text-base">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-400" />
                        Tactical Cashflow Map
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-700" /> Past
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Today
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Future
                        </span>
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4">
                {/* Y-axis labels */}
                <div className="flex gap-1">
                    <div className="flex flex-col justify-between text-[10px] text-slate-600 font-mono w-14 shrink-0 py-1"
                        style={{ height: barMaxHeight + 32 }}>
                        <span>{formatMoney(maxBal)}</span>
                        <span>{formatMoney((maxBal + minBal) / 2)}</span>
                        <span>{formatMoney(minBal)}</span>
                    </div>

                    {/* Bars container — hover tracked via onMouseMove */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-x-auto overflow-y-visible cursor-crosshair"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoveredDay(null)}
                    >
                        <div
                            className="flex items-end gap-px relative"
                            style={{ height: barMaxHeight + 32, minWidth: data.days.length * 6 }}
                        >
                            {data.days.map((day) => {
                                const h = getBarHeight(day.balance);
                                const hasEvents = day.events.length > 0;
                                const hasIncome = day.events.some((e) => e.category === "income");
                                const hasExpense = day.events.some((e) => e.category === "expense");

                                return (
                                    <div
                                        key={day.date}
                                        className="flex flex-col items-center justify-end relative group"
                                        style={{ flex: "1 1 0", minWidth: 4 }}
                                    >
                                        {/* TODAY label */}
                                        {day.is_today && (
                                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                                                <span className="text-[9px] font-bold text-amber-400 font-mono tracking-widest whitespace-nowrap">
                                                    TODAY
                                                </span>
                                            </div>
                                        )}

                                        {/* Bar */}
                                        <div
                                            className={`w-full rounded-t-sm transition-all duration-300
                                                ${getBarColor(day)}
                                                ${day.is_today ? "ring-1 ring-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]" : ""}
                                                ${hoveredDay?.date === day.date ? "opacity-100 scale-x-125" : day.zone === "past" ? "opacity-40" : "opacity-80"}
                                                hover:opacity-100`}
                                            style={{ height: h }}
                                        />

                                        {/* Event dots */}
                                        {hasEvents && (
                                            <div className="flex gap-px mt-0.5">
                                                {hasIncome && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                )}
                                                {hasExpense && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                )}
                                            </div>
                                        )}

                                        {/* Day number (show every ~7 days or on today) */}
                                        {(day.is_today || day.day_num === 1 || day.day_num === 15) && (
                                            <span className={`text-[8px] mt-0.5 font-mono
                                                ${day.is_today ? "text-amber-400 font-bold" : "text-slate-600"}`}>
                                                {day.day_num}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Month labels */}
                        <div className="flex mt-1 relative" style={{ minWidth: data.days.length * 6 }}>
                            {monthLabels.map((ml) => (
                                <span
                                    key={ml.label + ml.offset}
                                    className="text-[10px] text-gray-500 font-mono absolute"
                                    style={{ left: `${(ml.offset / data.days.length) * 100}%` }}
                                >
                                    {ml.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary stats row */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-neutral-800/50">
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-500">
                            Balance today:{" "}
                            <span className="text-slate-900 dark:text-white font-mono font-semibold">
                                {formatMoney(data.start_balance)}
                            </span>
                        </div>
                        {balances.length > 0 && (
                            <div className="text-xs text-gray-500">
                                Projected min:{" "}
                                <span className={`font-mono font-semibold ${minBal < 0 ? "text-rose-400" : "text-gray-300"}`}>
                                    {formatMoney(Math.min(...balances.filter((_, i) => data.days[i].zone !== "past")))}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-emerald-400" /> Income
                        </span>
                        <span className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-rose-400" /> Expense
                        </span>
                    </div>
                </div>
            </CardContent>

            {/* Tooltip overlay */}
            {hoveredDay && (() => {
                const idx = data.days.findIndex(d => d.date === hoveredDay.date);
                const prevBal = idx > 0 ? data.days[idx - 1].balance : null;
                const delta = prevBal !== null ? hoveredDay.balance - prevBal : null;
                return <DayTooltip day={hoveredDay} delta={delta} position={tooltipPos} />;
            })()}
        </Card>
    );
}
