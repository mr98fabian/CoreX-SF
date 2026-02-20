import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { withPlanLimit } from '@/lib/planLimits';

// --- Type Definitions ---

interface ShieldStatus {
    percentage: number;
    is_active: boolean;
    health: string;
}

interface RecommendedAction {
    amount: number;
    destination: string;
    destination_apr: number;
    destination_balance: number;
    daily_cost: number;
    reason: string;
    gap_coverage?: {
        total_cost: number;
        debts: { name: string; shortfall: number; apr: number }[];
    } | null;
}

interface Impact {
    days_accelerated: number;
    interest_saved_monthly: number;
    freedom_hours_earned: number;
}

export interface MorningBriefingData {
    available_cash: number;
    attack_amount: number;
    shield_status: ShieldStatus;
    recommended_action: RecommendedAction;
    impact: Impact;
}

export interface DebtRanked {
    name: string;
    apr: number;
    balance: number;
    daily_cost: number;
    is_target: boolean;
}

export interface ConfidenceMeterData {
    debts_ranked: DebtRanked[];
    strategy: string;
    explanation: string;
}

export interface FreedomCounterData {
    current_freedom_date: string;
    standard_freedom_date: string;
    months_saved: number;
    interest_saved: number;
    total_days_recovered: number;
    velocity_power: number;
}

export interface StreakData {
    current: number;
    total_attacks: number;
}

export interface DecisionOption {
    id: string;
    label: string;
    amount: number;
    impact: string;
    description: string;
}

export interface DecisionOptionsData {
    options: DecisionOption[];
    recommended: string;
}

export interface DebtAlert {
    severity: 'critical' | 'warning' | 'caution';
    debt_name: string;
    title: string;
    message: string;
    details: Record<string, number>;
    recommendation: string;
}

export interface FloatKillOpportunity {
    name: string;
    balance: number;
    days_until_due: number;
    daily_interest_at_risk: number;
    monthly_interest_at_risk: number;
    can_kill: boolean;
    apr: number;
    priority: number;
    reason: string;
}

export interface ClosingDayIntel {
    name: string;
    closing_day: number;
    due_day: number;
    grace_period_days: number;
    cycle_position: string;
    days_until_close: number;
    days_until_due: number | null;
    float_days_if_buy_today: number;
    optimal_purchase_window: { start_day: number; end_day: number } | null;
    tips: Array<string | { type: string; message: string }>;
    credit_utilization: number | null;
}

export interface HybridKillAnalysis {
    strategy: string;
    kill_target_name?: string;
    kill_target_balance?: number;
    kill_target_apr?: number;
    freed_min_payment?: number;
    target_name?: string;
    avalanche_target_name?: string;
    remaining_equity_to_avalanche?: number;
    avalanche_target_apr?: number;
    benefit_monthly: number;
    benefit_total: number;
    avalanche_benefit_total?: number;
    advantage?: number;
    reasoning: string;
}

export interface ArbitrageAlert {
    severity: string;
    savings_account: string;
    savings_balance: number;
    savings_apy: number;
    debt_name: string;
    debt_apr: number;
    debt_balance: number;
    rate_spread: number;
    transferable_amount: number;
    monthly_net_loss: number;
    annual_net_loss: number;
    savings_earned_annually: number;
    debt_cost_annually: number;
    message: string;
    recommendation: string;
}

export interface StrategyCommandData {
    morning_briefing: MorningBriefingData | null;
    confidence_meter: ConfidenceMeterData;
    freedom_counter: FreedomCounterData;
    streak: StreakData;
    decision_options: DecisionOptionsData | null;
    debt_alerts: DebtAlert[];
    float_kills: FloatKillOpportunity[];
    closing_day_intelligence: ClosingDayIntel[];
    hybrid_kill_analysis: HybridKillAnalysis | null;
    arbitrage_alerts: ArbitrageAlert[];
}

// --- Hook ---

export function useStrategyData() {
    const [data, setData] = useState<StrategyCommandData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await apiFetch<StrategyCommandData>(withPlanLimit('/api/strategy/command-center'));
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load strategy data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}
