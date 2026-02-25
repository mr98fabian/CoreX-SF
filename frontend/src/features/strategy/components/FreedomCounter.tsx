import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, CalendarCheck, Zap, Flame } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FreedomCounterData, StreakData } from "../hooks/useStrategyData";

interface Props {
    freedom: FreedomCounterData;
    streak: StreakData;
}

// Animated counter hook (KoreX UI Magic — "Money Count" effect)
function useAnimatedNumber(target: number, duration = 1500) {
    const [current, setCurrent] = useState(0);
    const frameRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const start = performance.now();
        const from = 0;

        const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
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
    const { formatDateShort } = useFormatMoney();
    const { t } = useLanguage();

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === "N/A") return t("strategy.freedom.calculating");
        try {
            return formatDateShort(dateStr);
        } catch {
            return dateStr;
        }
    };

    return (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 backdrop-blur-sm overflow-hidden relative h-full">
            {/* Subtle ambient glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-sm">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    {t("strategy.freedom.title")}
                </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {/* Main Counter — Animated Days */}
                <div className="text-center py-2">
                    <p className="text-4xl font-bold font-mono text-emerald-400 tracking-tight">
                        {animatedDays.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t("strategy.freedom.daysRecovered")}
                    </p>
                </div>

                {/* Velocity Power */}
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-amber-400" />
                            {t("strategy.freedom.velocityPower")}
                        </span>
                        <span className="text-sm font-bold font-mono text-amber-400">
                            {animatedPower.toFixed(0)}%
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(freedom.velocity_power, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Inline Stats */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30 p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                            <CalendarCheck className="h-3 w-3 text-emerald-400" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("strategy.freedom.korexTarget")}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {formatDate(freedom.current_freedom_date)}
                        </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30 p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("strategy.freedom.standard")}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-through">
                            {formatDate(freedom.standard_freedom_date)}
                        </p>
                    </div>
                </div>

                {/* Months Saved + Streak */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("strategy.freedom.monthsAccelerated")}</p>
                        <p className="text-base font-bold font-mono text-emerald-400">
                            {freedom.months_saved}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("strategy.freedom.attackStreak")}</p>
                        <div className="flex items-center gap-1">
                            <Flame className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-base font-bold font-mono text-orange-400">
                                {streak.current}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
