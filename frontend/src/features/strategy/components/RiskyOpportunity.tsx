import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Zap, Shield, AlertTriangle, ArrowRight, Clock, DollarSign, Loader2, CheckCircle2, TrendingDown, Rocket } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from '@/lib/api';
import type { RiskyOpportunityData } from "../hooks/useStrategyData";

interface Props {
    data: RiskyOpportunityData;
    onExecuted?: () => void;
}

const RISK_STYLES = {
    moderate: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        glow: 'bg-amber-500/5',
        label: 'strategy.riskyOpp.riskModerate',
    },
    high: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        glow: 'bg-orange-500/5',
        label: 'strategy.riskyOpp.riskHigh',
    },
    critical: {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
        glow: 'bg-rose-500/5',
        label: 'strategy.riskyOpp.riskCritical',
    },
};

export default function RiskyOpportunity({ data, onExecuted }: Props) {
    const { formatMoney } = useFormatMoney();
    const { t } = useLanguage();
    const [showConfirm, setShowConfirm] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [executed, setExecuted] = useState(false);

    const style = RISK_STYLES[data.risk_level];

    const handleExecute = async () => {
        if (!accepted) return;

        setExecuting(true);
        try {
            await apiFetch('/api/strategy/execute', {
                method: 'POST',
                body: JSON.stringify({
                    movement_key: `risky-${Date.now()}`,
                    title: `Shield Sacrifice → ${data.destination}`,
                    amount: data.risk_amount,
                    date_planned: new Date().toISOString().split('T')[0],
                    source: data.source_account,
                    destination: data.destination,
                }),
            });
            setExecuted(true);
            setShowConfirm(false);
            onExecuted?.();
        } catch (err) {
            console.error('Risky opportunity execution failed:', err);
        } finally {
            setExecuting(false);
        }
    };

    // After execution, show a success card
    if (executed) {
        return (
            <Card className="border-emerald-300 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/50 dark:via-black dark:to-black">
                <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-emerald-400">
                            {t('strategy.riskyOpp.success')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {formatMoney(data.risk_amount)} → {data.destination}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className={`relative overflow-hidden ${style.border} border bg-gradient-to-br from-white via-slate-50 to-white dark:from-black dark:via-slate-900 dark:to-black h-full`}>
                {/* Danger glow effects */}
                <div className={`absolute top-0 right-0 w-72 h-72 ${style.glow} rounded-full blur-3xl pointer-events-none`} />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

                <CardContent className="relative p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${style.bg} border ${style.border}`}>
                                <AlertTriangle className={`h-4 w-4 ${style.text}`} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    {t('strategy.riskyOpp.title')}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('strategy.riskyOpp.subtitle')}
                                </p>
                            </div>
                        </div>
                        <Badge className={`${style.bg} ${style.text} ${style.border}`}>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {t(style.label)}
                        </Badge>
                    </div>

                    {/* Action Card */}
                    <div className="rounded-xl bg-gray-100/80 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700/50 p-4 space-y-3 backdrop-blur-sm">
                        <div className={`flex items-center gap-2 text-sm font-medium ${style.text}`}>
                            <Zap className="h-4 w-4" />
                            {t('strategy.riskyOpp.shieldSacrifice')}
                        </div>

                        <div className="flex-1">
                            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                {formatMoney(data.risk_amount)}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-slate-600 dark:text-gray-300">
                                <span>{data.source_account}</span>
                                <ArrowRight className={`h-3.5 w-3.5 ${style.text}`} />
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {data.destination}
                                </span>
                                <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-400">
                                    {data.destination_apr}% APR
                                </Badge>
                            </div>
                        </div>

                        {/* Shield Drop Gauge */}
                        <div className="rounded-lg bg-gray-200/60 dark:bg-[#0f0f0f]/50 border border-slate-300 dark:border-neutral-700/30 p-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span>{t('strategy.riskyOpp.shieldDrops')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-bold font-mono">{data.shield_before}%</span>
                                    <ArrowRight className="h-3 w-3 text-slate-600" />
                                    <span className={`font-bold font-mono ${style.text}`}>{data.shield_after}%</span>
                                </div>
                            </div>
                            {/* Visual gauge */}
                            <div className="relative h-2 rounded-full bg-slate-300 dark:bg-neutral-800 overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-emerald-500/40 rounded-full transition-all"
                                    style={{ width: `${data.shield_before}%` }}
                                />
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${data.risk_level === 'critical' ? 'bg-rose-500' :
                                        data.risk_level === 'high' ? 'bg-orange-500' :
                                            'bg-amber-500'
                                        }`}
                                    style={{ width: `${data.shield_after}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 🚀 Benefit Summary — What you gain from this action */}
                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/20 border border-emerald-300 dark:border-emerald-500/20 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Rocket className="h-4 w-4" />
                            <span className="text-sm font-bold">{t('strategy.riskyOpp.benefitTitle')}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <TrendingDown className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {data.days_accelerated} {t('strategy.riskyOpp.daysCloser')}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('strategy.riskyOpp.freedomAcceleration')}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-emerald-100/60 dark:bg-neutral-800/40 p-2.5 text-center">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-400 mx-auto mb-1" />
                                <p className="text-base font-bold text-emerald-400 font-mono">
                                    {formatMoney(data.interest_saved_monthly)}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('strategy.riskyOpp.interestSaved')}</p>
                            </div>
                            <div className="rounded-lg bg-blue-100/60 dark:bg-neutral-800/40 p-2.5 text-center">
                                <Clock className={`h-3.5 w-3.5 ${style.text} mx-auto mb-1`} />
                                <p className={`text-base font-bold ${style.text} font-mono`}>
                                    {formatMoney(data.interest_saved_monthly * 12)}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('strategy.riskyOpp.annualSavings')}</p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center italic">
                            {t('strategy.riskyOpp.costEliminated')} {formatMoney(data.daily_cost_eliminated)}
                        </p>
                    </div>

                    {/* Take the Risk Button */}
                    <Button
                        onClick={() => setShowConfirm(true)}
                        className={`w-full h-11 font-bold text-sm tracking-wide ${data.risk_level === 'critical'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20'
                            : data.risk_level === 'high'
                                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20'
                                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20'
                            }`}
                    >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        {t('strategy.riskyOpp.takeRisk')}
                    </Button>
                </CardContent>
            </Card>

            {/* Confirmation Modal */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="bg-white dark:bg-black border-rose-300 dark:border-rose-500/30 max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <AlertTriangle className="h-5 w-5 text-rose-400" />
                            </div>
                            <AlertDialogTitle className="text-slate-900 dark:text-white">
                                {t('strategy.riskyOpp.confirmTitle')}
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-slate-600 dark:text-gray-300 space-y-3">
                            <p>{t('strategy.riskyOpp.confirmWarning')}</p>

                            <div className="rounded-lg bg-gray-100 dark:bg-[#0f0f0f] border border-gray-200 dark:border-neutral-800 p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">{t('strategy.riskyOpp.amount')}:</span>
                                    <span className="text-slate-900 dark:text-white font-bold font-mono">{formatMoney(data.risk_amount)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Shield:</span>
                                    <span>
                                        <span className="text-emerald-400 font-mono">{data.shield_before}%</span>
                                        <span className="text-slate-600 mx-2">→</span>
                                        <span className={`font-mono ${style.text}`}>{data.shield_after}%</span>
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">{t('strategy.riskyOpp.destination')}:</span>
                                    <span className="text-slate-900 dark:text-white">{data.destination}</span>
                                </div>
                            </div>

                            <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                                <p className="text-xs text-rose-300">
                                    {t('strategy.riskyOpp.disclaimer')}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer mt-2">
                        <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-neutral-800 text-rose-500 focus:ring-rose-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-gray-300">
                            {t('strategy.riskyOpp.checkboxLabel')}
                        </span>
                    </label>

                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel
                            className="bg-transparent border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            onClick={() => { setAccepted(false); }}
                        >
                            {t('strategy.riskyOpp.cancel')}
                        </AlertDialogCancel>
                        <Button
                            onClick={handleExecute}
                            disabled={!accepted || executing}
                            className={`${accepted
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-slate-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            {executing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="mr-2 h-4 w-4" />
                            )}
                            {t('strategy.riskyOpp.execute')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
