import { RefreshCw, Loader2, AlertTriangle, Zap } from "lucide-react";
import { emitDataChanged, useDataSync } from '@/lib/dataSync';
import { WidgetHelp } from '@/components/WidgetHelp';
import { Button } from "@/components/ui/button";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from '@/lib/api';
import { useStrategyData } from "./hooks/useStrategyData";
import MorningBriefing from "./components/MorningBriefing";
import RiskyOpportunity from "./components/RiskyOpportunity";
import FreedomCounter from "./components/FreedomCounter";
import ConfidenceMeter from "./components/ConfidenceMeter";
import AttackDecisionHelper from "./components/AttackDecisionHelper";
import TacticalCashflowMap from "./components/TacticalCashflowMap";
import DebtAlertBanner from "./components/DebtAlertBanner";
import FloatKillBanner from "./components/FloatKillBanner";
import ClosingDayIntelPanel from "./components/ClosingDayIntelPanel";
import ArbitrageAlertPanel from "./components/ArbitrageAlertPanel";



export default function StrategyPage() {
    usePageTitle('Strategy');
    const { data, loading, error, refresh } = useStrategyData();
    const { toast } = useToast();

    // Execute the strategic transfer using existing backend endpoint
    const handleExecute = async () => {
        if (!data?.morning_briefing) return;

        const { recommended_action } = data.morning_briefing;

        try {
            await apiFetch('/api/strategy/execute', {
                method: "POST",
                body: JSON.stringify({
                    movements: [
                        {
                            title: `Strategic Attack → ${recommended_action.destination}`,
                            amount: recommended_action.amount,
                            source: "Checking",
                            destination: recommended_action.destination,
                        },
                    ],
                }),
            });

            toast({
                title: "⚡ Attack Executed",
                description: `${formatMoney(recommended_action.amount)} moved to ${recommended_action.destination}. Your freedom date just accelerated.`,
            });

            // Refresh data to show updated state
            refresh();
            emitDataChanged('strategy');
        } catch {
            toast({
                title: "Execution Error",
                description: "Could not complete the transfer. Please try again.",
                variant: "destructive",
            });
        }
    };

    // Listen for data changes from Dashboard or Accounts pages
    useDataSync('strategy', () => {
        refresh();
    });

    const handleDecisionSelect = (optionId: string) => {
        toast({
            title: "Strategy Selected",
            description: `You chose: ${optionId}. Preparing execution...`,
        });
        // Future: route to execution flow per option
    };

    const formatMoney = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    // --- Loading State ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
                    <p className="text-slate-400">Analyzing your financial strategy...</p>
                </div>
            </div>
        );
    }

    // --- Error State ---
    if (error || !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4 max-w-md">
                    <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
                    <p className="text-slate-300 font-medium">Strategy engine unavailable</p>
                    <p className="text-sm text-slate-500">{error || "Could not load strategy data"}</p>
                    <Button onClick={refresh} variant="outline" className="border-slate-700">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="h-6 w-6 text-amber-400" />
                        Strategy Command Center
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Your personalized attack intelligence. One decision. Maximum impact.
                    </p>
                </div>
                <Button
                    onClick={refresh}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-white"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Debt Health Alerts */}
            {data.debt_alerts?.length > 0 && (
                <DebtAlertBanner alerts={data.debt_alerts} />
            )}

            {/* Float Kill Opportunities — Grace Period Priority */}
            {data.float_kills?.length > 0 && (
                <FloatKillBanner opportunities={data.float_kills} />
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column — Morning Briefing (takes 2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                    {data.morning_briefing ? (
                        <div className="relative group">
                            <WidgetHelp helpKey="morningBriefing" />
                            <MorningBriefing
                                data={data.morning_briefing}
                                onExecute={handleExecute}
                            />
                        </div>
                    ) : data.risky_opportunity ? (
                        <div className="relative group">
                            <WidgetHelp helpKey="morningBriefing" />
                            <RiskyOpportunity
                                data={data.risky_opportunity}
                                onExecuted={refresh}
                            />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
                            <Zap className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                            <h3 className="text-lg font-semibold text-slate-300">
                                No Attack Available
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                                Your Peace Shield needs reinforcement first, or no active debts were found.
                                Check your accounts and shield settings.
                            </p>
                        </div>
                    )}

                    {/* Confidence Meter */}
                    <div className="relative group">
                        <WidgetHelp helpKey="confidenceMeter" />
                        <ConfidenceMeter data={data.confidence_meter} />
                    </div>
                </div>

                {/* Right Column — Freedom Counter + Decision Helper */}
                <div className="space-y-6">
                    <div className="relative group">
                        <WidgetHelp helpKey="freedomCounter" />
                        <FreedomCounter
                            freedom={data.freedom_counter}
                            streak={data.streak}
                        />
                    </div>

                    {data.decision_options && (
                        <div className="relative group">
                            <WidgetHelp helpKey="attackDecision" />
                            <AttackDecisionHelper
                                data={data.decision_options}
                                onSelect={handleDecisionSelect}
                            />
                        </div>
                    )}

                    {/* Arbitrage Alerts */}
                    {data.arbitrage_alerts?.length > 0 && (
                        <ArbitrageAlertPanel alerts={data.arbitrage_alerts} />
                    )}
                </div>
            </div>

            {/* Tactical Cashflow Map — full width */}
            <div className="relative group">
                <WidgetHelp helpKey="tacticalMap" />
                <TacticalCashflowMap />
            </div>

            {/* Closing Day Intelligence — full width */}
            {data.closing_day_intelligence?.length > 0 && (
                <ClosingDayIntelPanel intelligence={data.closing_day_intelligence} />
            )}
        </div>
    );
}
