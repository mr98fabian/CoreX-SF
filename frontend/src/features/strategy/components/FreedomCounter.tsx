import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, CalendarCheck, Zap, Flame } from "lucide-react";
import type { FreedomCounterData, StreakData } from "../hooks/useStrategyData";

interface Props {
    freedom: FreedomCounterData;
    streak: StreakData;
}

// Animated counter hook (CoreX UI Magic skill — "Money Count" effect)
function useAnimatedNumber(target: number, duration = 1500) {
    const [current, setCurrent] = useState(0);
    const frameRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const start = performance.now();
        const from = 0;

        const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for smooth financial feel
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(from + (target - from) * eased);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [target, duration]);

    return current;
}

export default function FreedomCounter({ freedom, streak }: Props) {
    const animatedDays = useAnimatedNumber(freedom.total_days_recovered, 2000);
    const animatedPower = useAnimatedNumber(freedom.velocity_power, 1500);

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === "N/A") return "Calculating...";
        try {
            return new Date(dateStr).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-sm overflow-hidden relative">
            {/* Subtle ambient glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Clock className="h-5 w-5 text-emerald-400" />
                    Freedom Counter
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Main Counter — Animated Days */}
                <div className="text-center py-4">
                    <p className="text-5xl font-bold font-mono text-emerald-400 tracking-tight">
                        {animatedDays.toFixed(1)}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                        Days of Freedom Recovered
                    </p>
                </div>

                {/* Velocity Power */}
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            Velocity Power
                        </span>
                        <span className="text-lg font-bold font-mono text-amber-400">
                            {animatedPower.toFixed(0)}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(freedom.velocity_power, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Inline Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs text-slate-500">KoreX Target</span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                            {formatDate(freedom.current_freedom_date)}
                        </p>
                    </div>
                    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-xs text-slate-500">Standard</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-400 line-through">
                            {formatDate(freedom.standard_freedom_date)}
                        </p>
                    </div>
                </div>

                {/* Months Saved + Streak */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div>
                        <p className="text-xs text-slate-500">Months Accelerated</p>
                        <p className="text-lg font-bold font-mono text-emerald-400">
                            {freedom.months_saved}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Attack Streak</p>
                        <div className="flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-orange-400" />
                            <span className="text-lg font-bold font-mono text-orange-400">
                                {streak.current}
                            </span>
                            {streak.current > 0 && (
                                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">
                                    {streak.total_attacks} total
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
