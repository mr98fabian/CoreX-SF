
import { motion } from "framer-motion";
import { CheckCircle, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MonthSnapshot {
    date: string;
    month_display: string;
    total_balance: number;
    events: string[];
    debts_active: number;
    interest_paid: number;
    is_freedom_month: boolean;
}

interface FreedomSimulation {
    timeline: MonthSnapshot[];
    freedom_date: string;
    freedom_month_display: string;
    total_months: number;
    total_interest_paid: number;
}

interface FreedomPathCalendarProps {
    simulation: FreedomSimulation | null;
    isLoading?: boolean;
}

export function FreedomPathCalendar({ simulation, isLoading }: FreedomPathCalendarProps) {
    if (isLoading) {
        return (
            <Card className="h-full border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                    <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Defensive check: ensure timeline exists and is an array
    if (!simulation || !Array.isArray(simulation.timeline) || simulation.timeline.length === 0) {
        return (
            <Card className="h-full border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle className="text-xl text-slate-900 dark:text-white">Camino a la Libertad</CardTitle>
                    <CardDescription>No hay datos de simulación disponibles.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const { timeline, freedom_date, total_months, total_interest_paid } = simulation;

    return (
        <Card className="h-full border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-xl transition-all duration-500 hover:border-emerald-400 dark:hover:border-emerald-500/20">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
                            <Flag className="h-5 w-5 text-emerald-400" />
                            Camino a la Libertad
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400">
                            Tu mapa mensual hacia la vida Sin Deudas.
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">
                            {total_months} Meses
                        </div>
                        <div className="text-xs text-slate-500">
                            Fecha Final: <span className="text-slate-700 dark:text-slate-300">{new Date(freedom_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <ScrollArea className="h-[400px] w-full pr-4">
                    <div className="relative border-l border-slate-200 dark:border-white/10 pl-6 space-y-8">
                        {timeline.map((month, index) => {
                            const isLast = index === timeline.length - 1;
                            const previousBalance = index > 0 ? timeline[index - 1].total_balance : month.total_balance; // Approx for first month
                            const principalPaid = index > 0 ? (previousBalance - month.total_balance) : 0;
                            const displayEvents = month.events || [];

                            return (
                                <motion.div
                                    key={month.date || index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="relative"
                                >
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white dark:border-black ring-4 ring-white dark:ring-black ${isLast ? "bg-emerald-500" :
                                        displayEvents.length > 0 ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-700"
                                        }`}>
                                        {isLast && <Flag className="h-2 w-2 text-white dark:text-black fill-current" />}
                                    </div>

                                    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-4 transition-colors hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider text-sm">
                                                {month.month_display}
                                            </h4>
                                            <span className="text-xs font-mono text-slate-500">
                                                Mes {index + 1}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-500">Balance Restante</span>
                                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                                    ${month.total_balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-slate-500">Reducción Principal</span>
                                                <span className="font-bold text-emerald-400 font-mono">
                                                    {index === 0 ? "---" : `-$${principalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                                </span>
                                            </div>
                                        </div>

                                        {displayEvents.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {displayEvents.map((evt, evtIdx) => (
                                                    <Badge key={evtIdx} variant="default" className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
                                                        <CheckCircle className="mr-1 h-3 w-3" />
                                                        {evt}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        {isLast && (
                                            <div className="mt-2 rounded bg-emerald-500/10 px-3 py-2 text-center text-sm font-bold text-emerald-400 border border-emerald-500/20">
                                                🎉 ¡LIBERTAD FINANCIERA ALCANZADA!
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>

                <div className="mt-6 flex justify-between rounded-xl bg-slate-100 dark:bg-slate-950 p-4 border border-slate-200 dark:border-white/5">
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase tracking-widest">Interés Total Pagado</span>
                        <span className="text-xl font-bold text-rose-400 font-mono">
                            ${total_interest_paid?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || "0.00"}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 uppercase tracking-widest">Estado</span>
                        <span className="text-xl font-bold text-slate-400 font-mono">
                            {total_months > 600 ? "Maxed Out" : "En Progreso"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
